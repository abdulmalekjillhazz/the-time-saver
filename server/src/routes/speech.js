import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/AppError.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  ElevenLabsApiError,
  generateAndUploadAudioDrama,
} from '../services/elevenLabs.js';
import { CloudinaryApiError, isCloudinaryConfigured } from '../services/cloudinary.js';
import { logger } from '../lib/logger.js';

const MINUTE = 60 * 1000;
const audioDramaRequest = z.object({
  content: z.string().trim().min(1).max(30_000),
}).strict();

const elevenLabsUpstreamError = () => new AppError(502, 'UPSTREAM_UNAVAILABLE', {
  en: 'ElevenLabs could not synthesize this voice line. Check the configured voice ID and account access.',
  bn: 'ElevenLabs এই সংলাপের অডিও তৈরি করতে পারেনি। voice ID ও account access পরীক্ষা করুন।',
});
export const elevenLabsError = (error) => {
  if (!(error instanceof ElevenLabsApiError)) {
    return elevenLabsUpstreamError();
  }
  if (error.status === 429) {
    return new AppError(429, 'RATE_LIMITED', {
      en: 'ElevenLabs is temporarily rate-limiting requests. Wait a little and try again.',
      bn: 'ElevenLabs সাময়িকভাবে request সীমিত করেছে। একটু অপেক্ষা করে আবার চেষ্টা করুন।',
    });
  }
  if (error.status === 402 || ['paid_plan_required', 'quota_exceeded', 'payment_required'].includes(error.upstreamCode)) {
    return new AppError(402, 'PAYMENT_REQUIRED', {
      en: 'ElevenLabs has no usable credits for this request. Add credits and try again.',
      bn: 'ElevenLabs-এর ব্যবহারযোগ্য credit শেষ। credit যোগ করে আবার চেষ্টা করুন।',
    });
  }
  if (error.status === 401) {
    return new AppError(502, 'UPSTREAM_UNAVAILABLE', {
      en: 'ElevenLabs rejected the API key or its permissions. Check the server API key settings.',
      bn: 'ElevenLabs API key বা permission গ্রহণ করেনি। server-এর API key settings পরীক্ষা করুন।',
    });
  }
  if (error.status === 404) {
    return new AppError(502, 'UPSTREAM_UNAVAILABLE', {
      en: 'The configured ElevenLabs voice was not found for this API key.',
      bn: 'এই API key দিয়ে কনফিগার করা ElevenLabs voice পাওয়া যায়নি।',
    });
  }
  return elevenLabsUpstreamError();
};
export const audioDramaError = (error) => {
  if (error instanceof ElevenLabsApiError) return elevenLabsError(error);
  if (error instanceof CloudinaryApiError) {
    const rejectedCredentials = error.status === 401 || error.status === 403;
    return new AppError(502, 'CLOUDINARY_UNAVAILABLE', {
      en: rejectedCredentials
        ? 'Cloudinary rejected its credentials. Verify CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env.'
        : 'Cloudinary could not save the audio drama. Check Cloudinary account access and try again.',
      bn: rejectedCredentials
        ? 'Cloudinary credentials গ্রহণ করেনি। server/.env-এ CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY এবং CLOUDINARY_API_SECRET মিলিয়ে দেখুন।'
        : 'Cloudinary-তে অডিও ড্রামা রাখা যায়নি। Cloudinary account access পরীক্ষা করে আবার চেষ্টা করুন।',
    });
  }
  return new AppError(502, 'UPSTREAM_UNAVAILABLE', {
    en: 'The audio drama could not be generated and saved. Check the voice and Cloudinary configuration, then try again.',
    bn: 'অডিও ড্রামা তৈরি করে Cloudinary-তে রাখা যায়নি। voice ও Cloudinary সেটিং দেখে আবার চেষ্টা করুন।',
  });
};
export function speechRouter({ config = {} } = {}) {
  const router = Router();
  router.use(requireAuth);
  router.use(rateLimit({ name: 'speech-api', limit: 60, windowMs: MINUTE, by: 'user' }));
  router.get('/config', (_req, res) => {
    const voices = {
      father: Boolean(config.ELEVENLABS_API_KEY && config.ELEVENLABS_FATHER_VOICE_ID),
      mother: Boolean(config.ELEVENLABS_API_KEY && config.ELEVENLABS_MOTHER_VOICE_ID),
      son: Boolean(config.ELEVENLABS_API_KEY && config.ELEVENLABS_SON_VOICE_ID),
      storyteller: Boolean(config.ELEVENLABS_API_KEY && config.ELEVENLABS_STORYTELLER_VOICE_ID),
    };
    res.json({ elevenLabsVoices: voices, cloudinaryAudioReady: isCloudinaryConfigured() });
  });
  router.post(
    '/audio-drama',
    rateLimit({ name: 'audio-drama-generation', limit: 5, windowMs: 60 * MINUTE, by: 'user' }),
    validate({ body: audioDramaRequest }),
    async (req, res, next) => {
      try {
        const result = await generateAndUploadAudioDrama({
          content: req.body.content,
          config,
        });
        res.set('Cache-Control', 'no-store');
        res.json({
          audioUrl: result.url,
          segments: result.segments,
          cached: result.cached,
        });
      } catch (error) {
        logger.warn({
          errName: error.name,
          providerStatus: error.status,
          providerCode: error.upstreamCode,
          cloudinaryOperation: error.operation,
        }, 'Audio drama generation or Cloudinary save failed');
        next(audioDramaError(error));
      }
    },
  );
  return router;
}
