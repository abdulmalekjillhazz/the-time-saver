import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/AppError.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  ElevenLabsApiError,
  generateAndUploadAudioDrama,
  hasCompleteNarrationVoiceConfig,
} from '../services/elevenLabs.js';
import { CloudinaryApiError, isCloudinaryConfigured } from '../services/cloudinary.js';
import { logger } from '../lib/logger.js';

const MINUTE = 60 * 1000;
const audioDramaRequest = z.object({
  content: z.string().trim().min(1).max(5000),
}).strict();

export const elevenLabsError = (error) => {
  if (error instanceof ElevenLabsApiError && error.status === 402) {
    return new AppError(402, 'PAYMENT_REQUIRED', {
      en: 'ElevenLabs credits are exhausted. Add credits and try again.',
      bn: 'ElevenLabs-এর ব্যবহারযোগ্য credit শেষ। credit যোগ করে আবার চেষ্টা করুন।',
    });
  }
  if (error instanceof ElevenLabsApiError && error.status === 429) {
    return new AppError(429, 'RATE_LIMITED', {
      en: 'Voice synthesis is rate limited. Please try again shortly.',
      bn: 'অডিও তৈরির অনুরোধ সীমা অতিক্রম করেছে। একটু পরে আবার চেষ্টা করুন।',
    });
  }
  if (error instanceof CloudinaryApiError) {
    return new AppError(502, 'CLOUDINARY_UNAVAILABLE', {
      en: error.status === 401 || error.status === 403
        ? 'Cloudinary rejected its credentials. Check the server configuration.'
        : 'Cloudinary could not save the generated story audio.',
      bn: 'Cloudinary-তে গল্পের অডিও সংরক্ষণ করা যায়নি। সার্ভার কনফিগারেশন যাচাই করুন।',
    });
  }
  return new AppError(502, 'UPSTREAM_UNAVAILABLE', {
    en: 'Voice synthesis unavailable.',
    bn: 'অডিও তৈরি করা যায়নি।',
  });
};
export const audioDramaError = elevenLabsError;

export function speechRouter({ config = {} } = {}) {
  const router = Router();
  router.use(rateLimit({ name: 'speech-api', limit: 60, windowMs: MINUTE }));

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
    rateLimit({ name: 'audio-drama-generation', limit: 30, windowMs: 15 * MINUTE }),
    validate({ body: audioDramaRequest }),
    async (req, res, next) => {
      try {
        const hasElevenLabs = Boolean(
          config.ELEVENLABS_API_KEY &&
          hasCompleteNarrationVoiceConfig(config) &&
          isCloudinaryConfigured()
        );
        if (!hasElevenLabs) {
          throw new AppError(503, 'UNAVAILABLE', {
            en: 'Configure ElevenLabs, all four narration voices, and Cloudinary before generating story audio.',
            bn: 'গল্পের অডিও তৈরির আগে ElevenLabs-এর চারটি voice এবং Cloudinary কনফিগার করুন।',
          });
        }
        const result = await generateAndUploadAudioDrama({
          content: req.body.content,
          config,
        });
        return res.json({
          cached: Boolean(result.cached),
          audioUrl: result.url,
        });
      } catch (err) {
        if (!(err instanceof AppError)) {
          logger.warn({ errName: err.name }, 'Story audio generation or Cloudinary save failed');
        }
        next(err instanceof AppError ? err : audioDramaError(err));
      }
    }
  );

  return router;
}
