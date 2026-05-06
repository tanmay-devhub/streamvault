const path = require('path');
const fs   = require('fs');
const { db }           = require('../utils/db');
const { logger }       = require('../utils/logger');
const ffmpegService    = require('../services/ffmpegService');
const s3Service        = require('../services/s3Service');
const whisperService   = require('../services/whisperService');

const TEMP_DIR = path.join(__dirname, '../../temp');

function cleanupDir(dir) {
  try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

async function processVideo({ videoId, s3OriginalKey, originalExt }) {
  const workDir   = path.join(TEMP_DIR, videoId);
  const inputPath = path.join(workDir, `original${originalExt}`);

  try {
    fs.mkdirSync(workDir, { recursive: true });

    logger.info(`[${videoId}] Downloading original from S3`);
    await s3Service.downloadFile(s3OriginalKey, inputPath);

    logger.info(`[${videoId}] Starting FFmpeg pipeline`);
    const { meta, thumbnailPath, renditions } = await ffmpegService.processVideo(
      inputPath,
      workDir,
      (stage, pct) => logger.info(`[${videoId}] ${stage}: ${pct}%`)
    );

    const s3Base = `videos/${videoId}`;

    // Thumbnail
    const thumbKey = `${s3Base}/thumbnail.jpg`;
    await s3Service.uploadFile(thumbnailPath, thumbKey, 'image/jpeg');

    // HLS renditions
    const renditionKeys = {};
    for (const r of renditions) {
      for (const file of fs.readdirSync(r.dir)) {
        const ext = path.extname(file).toLowerCase();
        const ct  = ext === '.m3u8' ? 'application/vnd.apple.mpegurl' : 'video/mp2t';
        await s3Service.uploadFile(path.join(r.dir, file), `${s3Base}/${r.name}/${file}`, ct);
      }
      renditionKeys[r.name] = `${s3Base}/${r.name}/playlist.m3u8`;
    }

    // Master playlist (relative paths — HLS proxy serves it correctly)
    const masterKey = `${s3Base}/master.m3u8`;
    await s3Service.uploadFile(
      path.join(workDir, 'master.m3u8'),
      masterKey,
      'application/vnd.apple.mpegurl'
    );

    await db.update(videoId, {
      status:       'ready',
      masterKey,
      thumbnailKey: thumbKey,
      renditionKeys,
      s3Prefix:     s3Base,
      duration:     meta.duration,
      resolution:   `${meta.width}x${meta.height}`,
      videoCodec:   meta.videoCodec,
      audioCodec:   meta.audioCodec,
    });

    logger.info(`[${videoId}] ✅ Processing complete`);

    // Delete the raw original from S3 — processed files are all that's needed
    await s3Service.deleteObject(s3OriginalKey).catch(() => {});

    // Transcription (non-fatal — failure doesn't fail the job)
    if (process.env.GROQ_API_KEY) {
      try {
        logger.info(`[${videoId}] Starting Whisper transcription`);
        const audioPath = path.join(workDir, 'audio.mp3');
        await ffmpegService.extractAudio(inputPath, audioPath);
        const transcript = await whisperService.transcribeVideo(audioPath);
        await db.saveTranscript(videoId, transcript);
        logger.info(`[${videoId}] ✅ Transcript saved (${transcript.segments?.length} segments, lang: ${transcript.language})`);
      } catch (tErr) {
        logger.error(`[${videoId}] Transcription failed (non-fatal): ${tErr.message}`);
      }
    }
  } catch (err) {
    logger.error(`[${videoId}] Processing failed: ${err.message}`);
    await db.update(videoId, { status: 'failed', errorMessage: err.message });
    throw err; // re-throw so pg-boss marks the job failed and schedules a retry
  } finally {
    cleanupDir(workDir);
  }
}

module.exports = { processVideo };
