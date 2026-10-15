import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import { logger, serializeRequest } from './lib/logger.js';
import { requestId } from './middleware/requestId.js';
import { csrfProtection } from './middleware/csrf.js';
import { dbRequired } from './middleware/dbRequired.js';
import { rateLimit } from './middleware/rateLimit.js';
import { validate } from './middleware/validate.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { routinesRouter } from './routes/routines.js';
import { completionsRouter } from './routes/completions.js';
import { syncRouter } from './routes/sync.js';
import { pushRouter } from './routes/push.js';
import { alarmsRouter } from './routes/alarms.js';
import { lessonsRouter } from './routes/lessons.js';
import { quizzesRouter } from './routes/quizzes.js';
import { adminRouter } from './routes/admin.js';
import { modelRouter } from './routes/model.js';
import { assistantRouter } from './routes/assistant.js';
import { healthRouter } from './routes/health.js';
import { flagsRouter } from './routes/flags.js';
import { calendarRouter } from './routes/calendar.js';
import { summariesRouter } from './routes/summaries.js';
import { gamificationRouter } from './routes/gamification.js';
import { badgesRouter } from './routes/badges.js';
import { circlesRouter } from './routes/circles.js';
import { telegramRouter } from './routes/telegram.js';
import { configureCloudinary } from './services/cloudinary.js';
import { speechRouter } from './routes/speech.js';
import { islamicReflectionsRouter } from './routes/islamicReflections.js';

function normalizeWord(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/['\u2019]s$/i, '')
    .replace(/^[^a-z0-9\u0980-\u09FF]+|[^a-z0-9\u0980-\u09FF]+$/gi, '');
}

const wordMeaningBatchSchema = z.object({
  lang: z.enum(['bn', 'en']),
  words: z.array(z.string().trim().min(1).max(80)).max(300)
    .transform((words) => [...new Set(words.map(normalizeWord).filter(Boolean))])
    .pipe(z.array(z.string().min(1)).min(1).max(300)),
}).strict();

// config is passed in, so tests can build the app without reading the real environment.
export function createApp({ config }) {
  configureCloudinary(config);
  const app = express();
  app.disable('x-powered-by');
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(helmet());
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      serializers: { req: serializeRequest },
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    })
  );
  app.use(
    cors({
      origin: true,
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    })
  );
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  // Health and readiness go before CSRF and the database guard, so monitors can always reach them.
  app.use('/api', healthRouter(config));

  // Public word lookup proxy so mobile browsers are never blocked by CSP or CORS.
  const serverWordCache = new Map();
  const wordMeaningInflight = new Map();
  const lookupWordMeaning = async (clean, lang) => {
    const cacheKey = `${lang}:${clean}`;
    if (serverWordCache.has(cacheKey)) return serverWordCache.get(cacheKey);
    if (wordMeaningInflight.has(cacheKey)) return wordMeaningInflight.get(cacheKey);

    const lookup = (async () => {
      let translatedMeaning = '';
      let englishDetails = '';
      const [translationResult, dictionaryResult] = await Promise.all([
        lang === 'bn'
          ? Promise.allSettled([
          fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=bn&dt=t&dt=bd&q=${encodeURIComponent(clean)}`, { signal: AbortSignal.timeout(4500) })
            .then((response) => (response.ok ? response.json() : null)),
          ])
          : Promise.resolve([]),
        Promise.allSettled([
          fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`, { signal: AbortSignal.timeout(4500) })
            .then((response) => (response.ok ? response.json() : null)),
        ]),
      ]);

      if (translationResult[0]?.status === 'fulfilled' && Array.isArray(translationResult[0].value)) {
        const data = translationResult[0].value;
        const primary = data?.[0]?.[0]?.[0];
        const alternatives = [];
        if (Array.isArray(data?.[1])) {
          for (const group of data[1]) {
            if (Array.isArray(group?.[1])) alternatives.push(...group[1].slice(0, 3));
          }
        }
        translatedMeaning = [
          primary && primary.toLowerCase() !== clean ? primary : '',
          ...alternatives.filter((word) => word && word !== primary),
        ].filter(Boolean).slice(0, 4).join(', ');
      }

      if (dictionaryResult[0].status === 'fulfilled' && Array.isArray(dictionaryResult[0].value)) {
        const entry = dictionaryResult[0].value[0];
        if (entry) {
          const phonetic = entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || '';
          const definition = entry.meanings?.[0]?.definitions?.[0]?.definition || '';
          const partOfSpeech = entry.meanings?.[0]?.partOfSpeech || '';
          englishDetails = [
            phonetic ? `[${phonetic}]` : '',
            partOfSpeech ? `(${partOfSpeech})` : '',
            definition,
          ].filter(Boolean).join(' ');
        }
      }

      if (!translatedMeaning && lang === 'bn') {
        const memoryResult = await Promise.allSettled([
          fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|bn`, { signal: AbortSignal.timeout(4500) })
            .then((response) => (response.ok ? response.json() : null)),
        ]);
        const translated = memoryResult[0]?.status === 'fulfilled'
          ? memoryResult[0].value?.responseData?.translatedText
          : '';
        if (
          translated &&
          !translated.startsWith('MYMEMORY WARNING') &&
          translated.toLowerCase() !== clean
        ) {
          translatedMeaning = translated;
        }
      }

      const meaning = [translatedMeaning, englishDetails].filter(Boolean).join(' — ');
      if (meaning) {
        serverWordCache.set(cacheKey, meaning);
        if (serverWordCache.size > 3000) serverWordCache.delete(serverWordCache.keys().next().value);
      }
      return meaning;
    })();

    wordMeaningInflight.set(cacheKey, lookup);
    try {
      return await lookup;
    } finally {
      wordMeaningInflight.delete(cacheKey);
    }
  };

  app.get('/api/word-meaning', async (req, res) => {
    const clean = normalizeWord(req.query.word);
    if (!clean || clean.length < 1) {
      return res.status(400).json({ ok: false, meaning: '' });
    }
    const lang = req.query.lang === 'en' ? 'en' : 'bn';
    try {
      const meaning = await lookupWordMeaning(clean, lang);
      return res.json({ ok: Boolean(meaning), term: clean, meaning });
    } catch {
      return res.status(502).json({ ok: false, term: clean, meaning: '' });
    }
  });

  app.use('/api', csrfProtection(config));

  app.post(
    '/api/word-meanings',
    validate({ body: wordMeaningBatchSchema }),
    dbRequired,
    rateLimit({ name: 'word-meaning-batch', limit: 10, windowMs: 60 * 1000, by: 'ip' }),
    async (req, res, next) => {
      try {
        const { words, lang } = req.body;
        const meanings = new Array(words.length);
        let nextIndex = 0;
        const worker = async () => {
          while (nextIndex < words.length) {
            const index = nextIndex;
            nextIndex += 1;
            const meaning = await lookupWordMeaning(words[index], lang);
            if (meaning) meanings[index] = { term: words[index], meaning };
          }
        };
        await Promise.all(Array.from({ length: Math.min(10, words.length) }, worker));

        const availableMeanings = meanings.filter(Boolean);
        if (availableMeanings.length === 0) {
          return res.status(502).json({ ok: false, error: { message: 'Word meanings are temporarily unavailable.' } });
        }
        const unavailable = words.filter((_, index) => !meanings[index]);
        return res.json({ ok: true, meanings: availableMeanings, unavailable });
      } catch (error) {
        return next(error);
      }
    },
  );

  app.use('/api', dbRequired);

  app.use('/api/auth', authRouter(config));
  app.use('/api/me', meRouter(config));
  app.use('/api/routines', routinesRouter());
  app.use('/api/completions', completionsRouter());
  app.use('/api/sync', syncRouter());
  app.use('/api/push', pushRouter(config));
  app.use('/api/alarms', alarmsRouter());
  app.use('/api/lessons', lessonsRouter(config));
  app.use('/api/quizzes', quizzesRouter());
  app.use('/api/admin', adminRouter(config));
  app.use('/api/model', modelRouter());
  app.use('/api/assistant', assistantRouter(config));
  app.use('/api/flags', flagsRouter());
  app.use('/api/calendar', calendarRouter());
  app.use('/api/summaries', summariesRouter(config));
  app.use('/api/gamification', gamificationRouter());
  app.use('/api/badges', badgesRouter());
  app.use('/api/circles', circlesRouter());
  app.use('/api/telegram', telegramRouter(config));
  app.use('/api/speech', speechRouter({ config }));
  app.use('/api/islamic-reflections', islamicReflectionsRouter());

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// Default export for Vercel and Serverless environments
let serverlessApp = null;

export default async function handler(req, res) {
  const mongooseModule = await import('mongoose');
  const mongoose = mongooseModule.default || mongooseModule;

  let config;
  try {
    const { loadEnv } = await import('./config/env.js');
    config = loadEnv();
  } catch (envErr) {
    console.warn('loadEnv fallback used:', envErr.message);
    config = {
      NODE_ENV: process.env.NODE_ENV || 'production',
      PORT: Number(process.env.PORT) || 5000,
      MONGODB_URI: (process.env.MONGODB_URI || '').trim(),
      CLIENT_ORIGIN: (process.env.CLIENT_ORIGIN || 'https://made-your-dream-bigger.vercel.app').replace(/\/+$/, ''),
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      ELEVENLABS_MODEL: process.env.ELEVENLABS_MODEL || 'eleven_v3',
      ELEVENLABS_FATHER_VOICE_ID: process.env.ELEVENLABS_FATHER_VOICE_ID,
      ELEVENLABS_MOTHER_VOICE_ID: process.env.ELEVENLABS_MOTHER_VOICE_ID,
      ELEVENLABS_SON_VOICE_ID: process.env.ELEVENLABS_SON_VOICE_ID,
      ELEVENLABS_STORYTELLER_VOICE_ID: process.env.ELEVENLABS_STORYTELLER_VOICE_ID,
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
      VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
      VAPID_SUBJECT: process.env.VAPID_SUBJECT,
      SCHEDULER_ENABLED: false,
    };
  }

  // Always connect to MongoDB if not already connected
  const mongoUri = config.MONGODB_URI || (process.env.MONGODB_URI || '').trim();
  if (mongoose.connection.readyState !== 1 && mongoUri) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    } catch (dbErr) {
      console.error('MongoDB connection failed:', dbErr.message);
    }
  }

  if (!serverlessApp) {
    serverlessApp = createApp({ config });
  }
  return serverlessApp(req, res);
}
