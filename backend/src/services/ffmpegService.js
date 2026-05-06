const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');

// Allow overriding FFmpeg binary path via env
if (process.env.FFMPEG_PATH) ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
if (process.env.FFPROBE_PATH) ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

/**
 * HLS rendition profiles.
 * Each profile produces a sub-folder with its own playlist + segments.
 */
const HLS_PROFILES = [
  { name: '360p',  width: 640,  height: 360,  videoBitrate: '800k',  audioBitrate: '96k' },
  { name: '720p',  width: 1280, height: 720,  videoBitrate: '2500k', audioBitrate: '128k' },
  { name: '1080p', width: 1920, height: 1080, videoBitrate: '5000k', audioBitrate: '192k' },
];

const SEGMENT_DURATION = 6; // seconds per HLS segment

/**
 * Probe a video file for metadata (duration, resolution, bitrate, codec).
 */
function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('FFprobe timed out after 30s')),
      30_000
    );
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      clearTimeout(timer);
      if (err) return reject(new Error(`FFprobe failed: ${err.message}`));
      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');
      resolve({
        duration: Math.round(metadata.format.duration || 0),
        size: metadata.format.size,
        bitrate: metadata.format.bit_rate,
        width: videoStream?.width,
        height: videoStream?.height,
        videoCodec: videoStream?.codec_name,
        audioCodec: audioStream?.codec_name,
        fps: videoStream ? eval(videoStream.r_frame_rate) : null,
      });
    });
  });
}

/**
 * Extract a thumbnail JPEG from a video at a given timestamp.
 * @returns {Promise<string>} - Path to the thumbnail file
 */
function extractThumbnail(inputPath, outputDir, timestamp = '00:00:03') {
  return new Promise((resolve, reject) => {
    const thumbPath = path.join(outputDir, 'thumbnail.jpg');
    ffmpeg(inputPath.replace(/\\/g, '/'))
      .inputOptions([`-ss ${timestamp}`])
      .outputOptions([
        '-vframes 1',
        '-vf scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
        '-q:v 2',
      ])
      .output(thumbPath)
      .on('end', () => resolve(thumbPath))
      .on('error', (err, _stdout, stderr) => {
        logger.error(`Thumbnail stderr: ${stderr}`);
        reject(new Error(`Thumbnail extraction failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Encode a single rendition to HLS.
 * @param {string} inputPath
 * @param {string} outputDir  - Where to write .m3u8 + .ts segments
 * @param {object} profile    - { name, width, height, videoBitrate, audioBitrate }
 * @param {function} [onProgress] - (percent) => void
 */
function encodeRendition(inputPath, outputDir, profile, onProgress) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const playlistPath = path.join(outputDir, 'playlist.m3u8');
    // Normalize to forward slashes — ffmpeg on Windows rejects backslashes in options
    const segmentPattern = path.join(outputDir, 'segment_%05d.ts').replace(/\\/g, '/');

    ffmpeg(inputPath.replace(/\\/g, '/'))
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        `-b:v ${profile.videoBitrate}`,
        '-maxrate ' + profile.videoBitrate,
        '-bufsize ' + (parseInt(profile.videoBitrate) * 2) + 'k',
        `-vf scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2`,
        '-c:a aac',
        `-b:a ${profile.audioBitrate}`,
        '-ac 2',
        '-ar 44100',
        '-hls_time ' + SEGMENT_DURATION,
        '-hls_list_size 0',
        '-hls_flags independent_segments',
        `-hls_segment_filename ${segmentPattern}`,
        '-f hls',
      ])
      .output(playlistPath)
      .on('start', (cmd) => logger.info(`FFmpeg [${profile.name}] started`))
      .on('progress', (progress) => {
        if (onProgress && progress.percent != null) {
          onProgress(Math.min(Math.round(progress.percent), 99));
        }
      })
      .on('end', () => {
        logger.info(`FFmpeg [${profile.name}] encoding complete`);
        resolve(playlistPath);
      })
      .on('error', (err, stdout, stderr) => {
        logger.error(`FFmpeg [${profile.name}] error: ${err.message}`);
        logger.error(`FFmpeg stderr: ${stderr}`);
        reject(new Error(`Encoding failed for ${profile.name}: ${err.message}`));
      })
      .run();
  });
}

/**
 * Generate HLS master playlist that references all renditions.
 * @param {object[]} renditions - [{ name, width, height, videoBitrate, playlistUrl }]
 * @param {string} outputPath   - Where to write master.m3u8
 */
function generateMasterPlaylist(renditions, outputPath) {
  const bandwidthMap = { '360p': 900000, '720p': 2700000, '1080p': 5200000 };
  let content = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

  for (const r of renditions) {
    const bandwidth = bandwidthMap[r.name] || 2700000;
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${r.width}x${r.height},NAME="${r.name}"\n`;
    content += `${r.playlistUrl}\n\n`;
  }

  fs.writeFileSync(outputPath, content);
  logger.info(`Master playlist written: ${outputPath}`);
}

/**
 * Full pipeline: probe → thumbnail → encode all renditions → master playlist.
 * Returns paths to all generated files and metadata.
 *
 * @param {string} inputPath   - Original uploaded video
 * @param {string} workDir     - Temp directory for HLS output
 * @param {function} [onProgress] - (stage, percent) => void
 */
async function processVideo(inputPath, workDir, onProgress = () => {}) {
  // 1. Probe
  onProgress('probing', 0);
  const meta = await probeVideo(inputPath);
  logger.info(`Video probe: ${JSON.stringify(meta)}`);
  onProgress('probing', 100);

  // 2. Thumbnail
  onProgress('thumbnail', 0);
  const thumbTimestamp = Math.min(3, Math.floor((meta.duration || 10) * 0.1));
  const thumbSecs = `00:00:${String(thumbTimestamp).padStart(2, '0')}`;
  const thumbnailPath = await extractThumbnail(inputPath, workDir, thumbSecs);
  onProgress('thumbnail', 100);

  // 3. Determine applicable renditions (don't upscale)
  const applicableProfiles = HLS_PROFILES.filter(
    (p) => !meta.height || p.height <= meta.height + 10
  );
  if (applicableProfiles.length === 0) applicableProfiles.push(HLS_PROFILES[0]);

  // 4. Encode each rendition
  const renditionResults = [];
  for (let i = 0; i < applicableProfiles.length; i++) {
    const profile = applicableProfiles[i];
    const renditionDir = path.join(workDir, profile.name);
    onProgress('encoding', Math.round((i / applicableProfiles.length) * 100));
    await encodeRendition(inputPath, renditionDir, profile, (pct) => {
      const overall = Math.round(((i + pct / 100) / applicableProfiles.length) * 100);
      onProgress('encoding', overall);
    });
    renditionResults.push({ ...profile, dir: renditionDir });
  }
  onProgress('encoding', 100);

  // 5. Master playlist (local — will be regenerated with S3 URLs after upload)
  const masterPath = path.join(workDir, 'master.m3u8');
  generateMasterPlaylist(
    renditionResults.map((r) => ({
      ...r,
      playlistUrl: `${r.name}/playlist.m3u8`,
    })),
    masterPath
  );

  return {
    meta,
    thumbnailPath,
    renditions: renditionResults,
    masterPlaylistPath: masterPath,
    workDir,
  };
}

/**
 * Extract mono 16kHz MP3 audio from a video — used as Whisper input.
 */
function extractAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath.replace(/\\/g, '/'))
      .outputOptions(['-vn', '-ar 16000', '-ac 1', '-f mp3'])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(new Error(`Audio extraction failed: ${err.message}`)))
      .run();
  });
}

/**
 * Regenerate master.m3u8 using absolute S3 playlist URLs.
 */
function generateMasterPlaylistWithS3Urls(renditions, outputPath, s3BaseUrl) {
  const bandwidthMap = { '360p': 900000, '720p': 2700000, '1080p': 5200000 };
  let content = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

  for (const r of renditions) {
    const bandwidth = bandwidthMap[r.name] || 2700000;
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${r.width}x${r.height},NAME="${r.name}"\n`;
    content += `${s3BaseUrl}/${r.name}/playlist.m3u8\n\n`;
  }

  fs.writeFileSync(outputPath, content);
}

module.exports = {
  probeVideo,
  extractThumbnail,
  extractAudio,
  encodeRendition,
  generateMasterPlaylist,
  generateMasterPlaylistWithS3Urls,
  processVideo,
  HLS_PROFILES,
};
