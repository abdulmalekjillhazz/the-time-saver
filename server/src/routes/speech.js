import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/AppError.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  ElevenLabsApiError,
  generateAndUploadAudioDrama,
  isBengaliStoryContent,
  withDefaultNarrationVoices,
} from '../services/elevenLabs.js';
import { CloudinaryApiError, isCloudinaryConfigured } from '../services/cloudinary.js';
import { generateGoogleTtsAudio, GoogleTtsApiError } from '../services/googleTts.js';
import { logger } from '../lib/logger.js';
import { parseStoryNarration } from '@smart-routine/shared';
import { evaluateContextSpeechWithAI } from '../services/contextEvaluation.js';

const MINUTE = 60 * 1000;
const audioDramaRequest = z.object({
  content: z.string().trim().min(1).max(5000),
}).strict();
const freeAudioDramaRequest = z.object({
  content: z.string().trim().min(1).max(8000),
  lang: z.enum(['bn', 'en']),
}).strict();
const briefingRequest = z.object({
  text: z.string().trim().min(1).max(1500),
  lang: z.enum(['bn', 'en']),
}).strict();
const pronounceRequest = z.object({
  text: z.string().trim().min(1).max(800),
  lang: z.enum(['bn', 'en']).default('en'),
  speaker: z.string().trim().max(40).optional(),
}).strict();
const evaluateContextRequest = z.object({
  transcript: z.string().trim().min(1).max(10000),
  situation: z.object({
    id: z.string().optional(),
    title: z.union([z.string(), z.record(z.string())]).optional(),
    description: z.union([z.string(), z.record(z.string())]).optional(),
    expectedKeywords: z.array(z.string()).optional(),
  }).passthrough().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  lang: z.enum(['bn', 'en']).default('bn'),
}).strict();

export const googleTtsError = (error) => {
  if (error instanceof GoogleTtsApiError && error.status === 429) {
    return new AppError(429, 'RATE_LIMITED', {
      en: 'Google voice service is busy. Please try again shortly.',
      bn: 'Google voice service ব্যস্ত আছে। একটু পরে আবার চেষ্টা করুন।',
    });
  }
  return new AppError(502, 'VOICE_UNAVAILABLE', {
    en: 'Google voice could not generate audio. Check the server TTS configuration and try again.',
    bn: 'Google voice অডিও তৈরি করতে পারেনি। সার্ভারের TTS configuration যাচাই করে আবার চেষ্টা করুন।',
  });
};

export const elevenLabsError = (error) => {
  if (error instanceof ElevenLabsApiError && error.upstreamCode === 'english_only_policy') {
    return new AppError(400, 'VALIDATION_FAILED', {
      en: 'ElevenLabs-backed saved story audio supports English only.',
      bn: 'ElevenLabs-এ সংরক্ষিত গল্পের অডিও শুধু ইংরেজি ভাষার জন্য উপলভ্য।',
    });
  }
  if (error instanceof ElevenLabsApiError && error.status === 503) {
    return new AppError(503, 'UNAVAILABLE', {
      en: 'This story audio is not saved yet. Configure ElevenLabs to generate and save it.',
      bn: 'এই গল্পের অডিও এখনো সংরক্ষিত নেই। তৈরি ও সংরক্ষণ করতে ElevenLabs কনফিগার করুন।',
    });
  }
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
  const effectiveConfig = withDefaultNarrationVoices(config);
  router.use(rateLimit({ name: 'speech-api', limit: 60, windowMs: MINUTE }));

  router.get('/config', (_req, res) => {
    const voices = {
      father: Boolean(effectiveConfig.ELEVENLABS_API_KEY && effectiveConfig.ELEVENLABS_FATHER_VOICE_ID),
      mother: Boolean(effectiveConfig.ELEVENLABS_API_KEY && effectiveConfig.ELEVENLABS_MOTHER_VOICE_ID),
      son: Boolean(effectiveConfig.ELEVENLABS_API_KEY && effectiveConfig.ELEVENLABS_SON_VOICE_ID),
      storyteller: Boolean(effectiveConfig.ELEVENLABS_API_KEY && effectiveConfig.ELEVENLABS_STORYTELLER_VOICE_ID),
    };
    res.json({
      elevenLabsVoices: voices,
      cloudinaryAudioReady: isCloudinaryConfigured(),
    });
  });

  router.post(
    '/pronounce',
    rateLimit({ name: 'speech-pronounce', limit: 40, windowMs: 15 * MINUTE }),
    validate({ body: pronounceRequest }),
    async (req, res, next) => {
      try {
        const audio = await generateGoogleTtsAudio({
          text: req.body.text,
          lang: req.body.lang,
        });
        res.set({
          'Cache-Control': 'private, no-store',
          'Content-Length': String(audio.length),
          'Content-Type': 'audio/mpeg',
          'X-Audio-Source': 'google-tts',
        });
        return res.send(audio);
      } catch (error) {
        return next(googleTtsError(error));
      }
    }
  );

  router.post(
    '/briefing',
    requireAuth,
    rateLimit({ name: 'google-tts-briefing', limit: 20, windowMs: 15 * MINUTE, by: 'user' }),
    validate({ body: briefingRequest }),
    async (req, res, next) => {
      try {
        const audio = await generateGoogleTtsAudio({
          text: req.body.text,
          lang: req.body.lang,
        });
        res.set({
          'Cache-Control': 'private, no-store',
          'Content-Length': String(audio.length),
          'Content-Type': 'audio/mpeg',
          'X-Audio-Source': 'google-tts',
        });
        return res.send(audio);
      } catch (error) {
        logger.warn({
          errName: error.name,
          status: error.status,
          upstreamCode: error.upstreamCode,
        }, 'Google TTS briefing synthesis failed');
        return next(googleTtsError(error));
      }
    }
  );

  router.post(
    '/audio-drama/free',
    rateLimit({ name: 'free-audio-drama', limit: 15, windowMs: 15 * MINUTE }),
    validate({ body: freeAudioDramaRequest }),
    async (req, res, next) => {
      try {
        const audio = await generateGoogleTtsAudio({
          text: parseStoryNarration(req.body.content).map(({ text }) => text).join('\n'),
          lang: req.body.lang,
        });
        logger.info({ audioSource: 'google-tts', storyAudio: true }, 'story audio generated');
        res.set({
          'Cache-Control': 'private, no-store',
          'Content-Length': String(audio.length),
          'Content-Type': 'audio/mpeg',
          'X-Audio-Source': 'google-tts',
        });
        return res.send(audio);
      } catch (error) {
        logger.warn({
          errName: error.name,
          status: error.status,
          upstreamCode: error.upstreamCode,
        }, 'Free Google TTS story synthesis failed');
        return next(googleTtsError(error));
      }
    }
  );

  router.post(
    '/audio-drama',
    rateLimit({ name: 'audio-drama-generation', limit: 30, windowMs: 15 * MINUTE }),
    validate({ body: audioDramaRequest }),
    async (req, res, next) => {
      try {
        if (isBengaliStoryContent(req.body.content)) {
          throw new AppError(400, 'VALIDATION_FAILED', {
            en: 'ElevenLabs-backed saved story audio supports English only.',
            bn: 'ElevenLabs-এ সংরক্ষিত গল্পের অডিও শুধু ইংরেজি ভাষার জন্য উপলভ্য।',
          });
        }
        if (!isCloudinaryConfigured()) {
          throw new AppError(503, 'UNAVAILABLE', {
            en: 'Configure Cloudinary to look up saved story audio.',
            bn: 'সংরক্ষিত গল্পের অডিও খুঁজতে Cloudinary কনফিগার করুন।',
          });
        }
        const result = await generateAndUploadAudioDrama({
          content: req.body.content,
          config: effectiveConfig,
        });
        logger.info({
          audioSource: 'cloudinary',
          cached: Boolean(result.cached),
          sentenceCount: result.segments.length,
          storyAudio: true,
        }, 'story audio ready');
        return res.json(result);
      } catch (err) {
        if (!(err instanceof AppError)) {
          logger.warn({ errName: err.name }, 'Story audio generation or Cloudinary save failed');
        }
        next(err instanceof AppError ? err : audioDramaError(err));
      }
    }
  );

  router.post(
    '/audio-drama/offline',
    rateLimit({ name: 'audio-drama-offline-download', limit: 5, windowMs: 15 * MINUTE }),
    validate({ body: audioDramaRequest }),
    async (req, res, next) => {
      try {
        const result = await generateAndUploadAudioDrama({
          content: req.body.content,
          config: effectiveConfig,
        });
        const response = await fetch(result.url, { signal: AbortSignal.timeout(30_000) });
        if (!response.ok) {
          logger.warn({ status: response.status }, 'Cloudinary story audio download failed');
          throw new AppError(502, 'CLOUDINARY_UNAVAILABLE', {
            en: 'The generated story audio could not be downloaded for offline use.',
            bn: 'তৈরি করা গল্পের অডিও অফলাইনে ব্যবহারের জন্য ডাউনলোড করা যায়নি।',
          });
        }
        const audio = Buffer.from(await response.arrayBuffer());
        if (!audio.length) {
          throw new AppError(502, 'CLOUDINARY_UNAVAILABLE', {
            en: 'The generated story audio was empty and could not be saved offline.',
            bn: 'তৈরি করা গল্পের অডিও খালি ছিল, তাই অফলাইনে সংরক্ষণ করা যায়নি।',
          });
        }
        res.set({
          'Cache-Control': 'private, no-store',
          'Content-Length': String(audio.length),
          'Content-Type': 'audio/mpeg',
        });
        return res.send(audio);
      } catch (err) {
        if (!(err instanceof AppError)) {
          logger.warn({ errName: err.name }, 'Offline story audio download failed');
        }
        next(err instanceof AppError ? err : audioDramaError(err));
      }
    }
  );

  router.post(
    '/evaluate-context',
    rateLimit({ name: 'speech-evaluate-context', limit: 20, windowMs: 15 * MINUTE }),
    validate({ body: evaluateContextRequest }),
    async (req, res, next) => {
      try {
        const { transcript, situation = {}, durationSeconds = 0, lang = 'bn' } = req.body;
        const evaluation = await evaluateContextSpeechWithAI({
          transcript,
          situation,
          durationSeconds,
          lang,
          config: effectiveConfig,
        });
        return res.json({
          success: true,
          evaluation,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
