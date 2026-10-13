import { Upload } from '../models/Upload.js';
import { Lesson } from '../models/Lesson.js';
import { AppError, MSG } from '../lib/AppError.js';
import { randomToken } from '../lib/crypto.js';
import { cloudinary, signParams } from './cloudinary.js';

const FOLDER = 'smart-routine/lessons';
const MIN = 60 * 1000;
const SPECS = {
  image: { formats: 'jpg,png,webp', maxBytes: 5 * 1024 * 1024 },
  video: { formats: 'mp4,webm', maxBytes: 50 * 1024 * 1024 },
  audio: { formats: 'mp3,m4a,wav,aac,ogg', maxBytes: 20 * 1024 * 1024 },
};
const ATTACH_WINDOW_MS = 60 * MIN;

const bad = (en, bn) => new AppError(400, 'VALIDATION_FAILED', { en, bn });
const cloudinaryResourceType = (resourceType) => resourceType === 'audio' ? 'video' : resourceType;

// The server chooses the file name and folder. The browser only gets a signature for those exact values.
export async function createSignature(actor, resourceType) {
  return createUploadSignature(actor, resourceType, FOLDER);
}

async function createUploadSignature(actor, resourceType, folder) {
  const { config } = cloudinary();
  const spec = SPECS[resourceType];
  const publicId = `${folder}/${randomToken(16).replace(/[^A-Za-z0-9]/g, '').slice(0, 20)}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { allowed_formats: spec.formats, public_id: publicId, timestamp };

  await Upload.create({
    publicId,
    resourceType,
    uploadedBy: actor._id,
    expiresAt: new Date(Date.now() + ATTACH_WINDOW_MS),
  });

  return {
    cloudName: config.CLOUDINARY_CLOUD_NAME,
    apiKey: config.CLOUDINARY_API_KEY,
    timestamp,
    signature: signParams(params, config.CLOUDINARY_API_SECRET),
    publicId,
    allowedFormats: spec.formats,
    maxBytes: spec.maxBytes,
  };
}

function mediaUrl(cloudName, resourceType, publicId) {
  return `https://res.cloudinary.com/${cloudName}/${cloudinaryResourceType(resourceType)}/upload/${publicId}`;
}

export async function attachMedia(slug, actor, { publicId, resourceType }) {
  const { config, client } = cloudinary();
  const upload = await Upload.findOne({ publicId, uploadedBy: actor._id, status: 'pending' });
  if (!upload) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
  if (upload.resourceType !== resourceType) throw bad('Media type does not match the upload.', 'মিডিয়ার ধরন আপলোডের সাথে মেলেনি।');
  if (upload.expiresAt < new Date()) {
    await Upload.updateOne({ _id: upload._id }, { $set: { status: 'orphaned' } });
    throw bad('The upload window has closed. Upload again.', 'আপলোডের সময়সীমা শেষ। আবার আপলোড করুন।');
  }

  const info = await client.resourceInfo(publicId, cloudinaryResourceType(resourceType));
  if (!info) throw bad('The file was not uploaded.', 'ফাইলটি আপলোড হয়নি।');

  const spec = SPECS[resourceType];
  const allowed = spec.formats.split(',');
  if (info.bytes > spec.maxBytes || !allowed.includes(String(info.format).toLowerCase())) {
    // Refuse and remove the file, so a bad upload does not stay in storage.
    await client.destroy(publicId, cloudinaryResourceType(resourceType));
    await Upload.updateOne({ _id: upload._id }, { $set: { status: 'deleted', deletedAt: new Date() } });
    throw bad('The file is too large or in the wrong format.', 'ফাইলটি অনেক বড় বা ভুল ধরনের।');
  }

  const lesson = await Lesson.findOne({ slug });
  if (!lesson || lesson.status === 'archived') throw new AppError(404, 'NOT_FOUND', MSG.notFound);

  // Replacing old media marks the old file as orphaned, so the cleanup job removes it.
  if (lesson.media?.publicId) {
    await Upload.updateOne({ publicId: lesson.media.publicId, status: 'attached' }, { $set: { status: 'orphaned' } });
  }

  lesson.media = { publicId, resourceType, url: mediaUrl(config.CLOUDINARY_CLOUD_NAME, resourceType, publicId) };
  await lesson.save();
  await Upload.updateOne({ _id: upload._id }, { $set: { status: 'attached', attachedTo: slug } });
  return lesson;
}

export async function detachMedia(slug) {
  const lesson = await Lesson.findOne({ slug });
  if (!lesson) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
  if (lesson.media?.publicId) {
    await Upload.updateOne({ publicId: lesson.media.publicId, status: 'attached' }, { $set: { status: 'orphaned' } });
  }
  lesson.media = { publicId: null, resourceType: null, url: null };
  await lesson.save();
  return lesson;
}

// Run on a schedule (or by hand with scripts/cleanup-uploads.js).
// Pending uploads that were never attached are marked orphaned after their window closes.
// Orphaned files are destroyed in Cloudinary. A file that fails to delete stays orphaned and is retried next run.
export async function cleanupUploads({ now = new Date() } = {}) {
  const { client } = cloudinary();
  const expired = await Upload.updateMany(
    { status: 'pending', expiresAt: { $lt: now } },
    { $set: { status: 'orphaned' } }
  );

  const orphans = await Upload.find({ status: 'orphaned' }).lean();
  let deleted = 0;
  let failed = 0;
  for (const u of orphans) {
    try {
      // 'ok' or 'not found': either way the file is gone.
      await client.destroy(u.publicId, cloudinaryResourceType(u.resourceType));
      await Upload.updateOne({ _id: u._id }, { $set: { status: 'deleted', deletedAt: new Date() } });
      deleted += 1;
    } catch {
      failed += 1;
    }
  }
  return { markedOrphaned: expired.modifiedCount, deleted, failed };
}
