const {
  S3Client,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { pipeline } = require('stream/promises');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Upload a single file to S3 with multi-part support (handles large files).
 * @param {string} filePath  - Local path to file
 * @param {string} s3Key     - Destination key in S3
 * @param {string} [contentType]
 * @param {function} [onProgress] - (percentage) => void
 */
async function uploadFile(filePath, s3Key, contentType = 'application/octet-stream', onProgress) {
  const fileStream = fs.createReadStream(filePath);
  const fileSize = fs.statSync(filePath).size;

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: s3Key,
      Body: fileStream,
      ContentType: contentType,
    },
    queueSize: 4,         // 4 concurrent part uploads
    partSize: 10 * 1024 * 1024, // 10 MB parts
  });

  upload.on('httpUploadProgress', (progress) => {
    if (onProgress && progress.total) {
      onProgress(Math.round((progress.loaded / progress.total) * 100));
    }
  });

  const result = await upload.done();
  logger.info(`S3 upload complete: ${s3Key} (${(fileSize / 1e6).toFixed(2)} MB)`);
  return result.Location || `https://${BUCKET}.s3.amazonaws.com/${s3Key}`;
}

/**
 * Upload a Buffer or string directly to S3.
 */
async function uploadBuffer(buffer, s3Key, contentType = 'application/octet-stream') {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    },
  });
  const result = await upload.done();
  return result.Location || `https://${BUCKET}.s3.amazonaws.com/${s3Key}`;
}

/**
 * Upload an entire directory to S3 (used for HLS segments).
 */
async function uploadDirectory(localDir, s3Prefix, onFileUploaded) {
  const files = fs.readdirSync(localDir);
  const urls = {};

  for (const file of files) {
    const filePath = path.join(localDir, file);
    const s3Key = `${s3Prefix}/${file}`;

    const ext = path.extname(file).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.m3u8') contentType = 'application/vnd.apple.mpegurl';
    else if (ext === '.ts') contentType = 'video/mp2t';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.vtt') contentType = 'text/vtt';

    const url = await uploadFile(filePath, s3Key, contentType);
    urls[file] = url;
    if (onFileUploaded) onFileUploaded(file, url);
  }
  return urls;
}

/**
 * Delete a single S3 object.
 */
async function deleteObject(s3Key) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  logger.info(`S3 deleted: ${s3Key}`);
}

/**
 * Delete all objects with a given prefix (e.g. a video folder).
 */
async function deletePrefix(prefix) {
  const listed = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  if (!listed.Contents || listed.Contents.length === 0) return;

  const objects = listed.Contents.map((o) => ({ Key: o.Key }));
  await s3.send(
    new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: objects } })
  );
  logger.info(`S3 deleted ${objects.length} objects with prefix: ${prefix}`);
}

/**
 * Download a file from S3 to a local path (streamed — no full-buffer memory spike).
 */
async function downloadFile(s3Key, destPath) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  const response = await s3.send(command);
  await pipeline(response.Body, fs.createWriteStream(destPath));
  logger.info(`S3 download complete: ${s3Key}`);
}

/**
 * Return true if an S3 object exists, false if not found.
 * Throws on unexpected errors (auth failure, etc.).
 */
async function checkObjectExists(s3Key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: s3Key }));
    return true;
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NotFound') return false;
    throw err;
  }
}

/**
 * Generate a pre-signed URL for private objects.
 */
async function getPresignedUrl(s3Key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Generate a pre-signed URL that allows a browser to PUT a file directly to S3.
 * The Content-Type used here must match the Content-Type header sent by the browser.
 */
async function getPresignedUploadUrl(s3Key, contentType, expiresIn = 3600) {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: s3Key, ContentType: contentType });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Build a public URL for an S3 key (when ACL is public-read).
 */
function getPublicUrl(s3Key) {
  const region = process.env.AWS_REGION || 'us-east-1';
  if (region === 'us-east-1') {
    return `https://${BUCKET}.s3.amazonaws.com/${s3Key}`;
  }
  return `https://${BUCKET}.s3.${region}.amazonaws.com/${s3Key}`;
}

module.exports = {
  uploadFile,
  uploadBuffer,
  uploadDirectory,
  downloadFile,
  checkObjectExists,
  deleteObject,
  deletePrefix,
  getPresignedUrl,
  getPresignedUploadUrl,
  getPublicUrl,
};
