import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/AppError.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  ElevenLabsApiError,
  generateAndUploadAudioDrama,
  parseNarrationSegments,
} from '../services/elevenLabs.js';
import {
  CloudinaryApiError,
  cloudinary,
  isCloudinaryConfigured,
  uploadBufferToCloudinary,
} from '../services/cloudinary.js';
import { logger } from '../lib/logger.js';

const MINUTE = 60 * 1000;
const audioDramaRequest = z.object({
  content: z.string().trim().min(1).max(30_000),
}).strict();

export const elevenLabsError = () => new AppError(502, 'UPSTREAM_UNAVAILABLE', {
  en: 'Voice synthesis unavailable.',
  bn: 'অডিও তৈরি করা যায়নি।',
});
export const audioDramaError = (error) => elevenLabsError(error);

async function generateAndSaveTtsDramaToCloudinary(content, config) {
  const segments = parseNarrationSegments(content);
  const contentHash = crypto.createHash('sha256').update(`tts-v1\n${content}`).digest('hex').slice(0, 24);
  const folder = 'smart-routine/audio-dramas';
  const publicId = `drama-tts-${contentHash}`;
  const fullPublicId = `${folder}/${publicId}`;

  // ১. প্রথমে চেক করবে Cloudinary-তে এই অডিও আগে থেকেই সেভ আছে কি না
  if (isCloudinaryConfigured()) {
    try {
      const existingFull = await cloudinary().client.resourceInfo(fullPublicId, 'video');
      const existingSegments = await Promise.all(
        segments.map((_, idx) => cloudinary().client.resourceInfo(`${folder}/${publicId}-segment-${idx + 1}`, 'video'))
      );
      if (existingFull?.secure_url && existingSegments.every((s) => s?.secure_url)) {
        return {
          cached: true,
          audioUrl: existingFull.secure_url,
          segments: segments.map((seg, idx) => ({
            speaker: seg.speaker,
            text: seg.text,
            url: existingSegments[idx].secure_url,
          })),
        };
      }
    } catch (lookupErr) {
      logger.warn({ err: lookupErr.message }, 'Cloudinary cache check skipped');
    }
  }

  // ২. নতুন ভয়েস তৈরি করা
  const generatedBuffers = await Promise.all(segments.map(async (seg) => {
    const cleanText = seg.text.slice(0, 200);
    const isBn = /[\u0980-\u09ff]/.test(cleanText);
    const tl = isBn ? 'bn' : 'en';
    const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${tl}&q=${encodeURIComponent(cleanText)}`;
    try {
      const res = await fetch(ttsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'TTS fetch failed for segment');
    }
    return null;
  }));

  // ৩. ভয়েসগুলো সরাসরি তোমার Cloudinary-তে স্থায়ীভাবে সেভ করা
  if (isCloudinaryConfigured() && generatedBuffers.every(Boolean)) {
    try {
      const uploadedSegments = await Promise.all(
        segments.map(async (seg, idx) => {
          const up = await uploadBufferToCloudinary({
            config,
            buffer: generatedBuffers[idx],
            publicId: `${publicId}-segment-${idx + 1}`,
            folder,
            resourceType: 'video',
            format: 'mp3',
          });
          return { speaker: seg.speaker, text: seg.text, url: up.secure_url };
        })
      );
      const fullBuffer = Buffer.concat(generatedBuffers);
      const uploadedFull = await uploadBufferToCloudinary({
        config,
        buffer: fullBuffer,
        publicId,
        folder,
        resourceType: 'video',
        format: 'mp3',
      });
      return {
        cached: false,
        audioUrl: uploadedFull.secure_url,
        segments: uploadedSegments,
      };
    } catch (uploadErr) {
      logger.warn({ err: uploadErr.message }, 'Cloudinary upload failed, serving inline');
    }
  }

  const inlineSegments = segments.map((seg, idx) => ({
    speaker: seg.speaker,
    text: seg.text,
    url: generatedBuffers[idx] ? `data:audio/mpeg;base64,${generatedBuffers[idx].toString('base64')}` : '',
  }));
  return {
    cached: true,
    audioUrl: inlineSegments.find((s) => s.url)?.url || '',
    segments: inlineSegments,
  };
}

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
          config.ELEVENLABS_STORYTELLER_VOICE_ID &&
          isCloudinaryConfigured()
        );
        if (hasElevenLabs) {
          try {
            const result = await generateAndUploadAudioDrama({
              content: req.body.content,
              config,
            });
            return res.json({
              cached: Boolean(result.cached),
              audioUrl: result.url || result.audioUrl,
              segments: result.segments,
            });
          } catch (cloudErr) {
            logger.warn({ err: cloudErr.message }, 'ElevenLabs failed, falling back to Cloudinary TTS storage');
          }
        }
        const fallbackResult = await generateAndSaveTtsDramaToCloudinary(req.body.content, config);
        return res.json(fallbackResult);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
