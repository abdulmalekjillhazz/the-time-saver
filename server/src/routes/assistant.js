import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { AppError, MSG } from '../lib/AppError.js';
import { answerQuestion, generateRoutineDraft, generatePersonalBriefing } from '../services/routineAssistant.js';
import { generateAdaptiveReplan, completeMicroRoutine } from '../services/adaptiveReplan.js';
import { generateHybridPredictions } from '../services/hybridPrediction.js';

const MINUTE = 60 * 1000;

export function assistantRouter(config) {
  const r = Router();
  r.use(requireAuth);
  r.use(rateLimit({ name: 'assistant', limit: 35, windowMs: MINUTE, by: 'user' }));

  r.post('/predict-hybrid', async (req, res, next) => {
    try {
      const lang = req.body?.lang === 'en' ? 'en' : 'bn';
      const routines = Array.isArray(req.body?.routines) ? req.body.routines : [];
      const result = await generateHybridPredictions({
        userId: req.userId,
        routines,
        lang,
        timezone: req.user?.timezone || 'Asia/Dhaka',
        config,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  r.post('/briefing', async (req, res, next) => {
    try {
      const lang = req.body?.lang === 'bn' ? 'bn' : 'en';
      const routines = Array.isArray(req.body?.routines) ? req.body.routines : [];
      const userName = req.user?.displayName || req.body?.userName || '';
      const briefingText = await generatePersonalBriefing({
        userName,
        lang,
        routines,
        config,
      });
      res.json({ briefingText, source: 'coach' });
    } catch (err) {
      next(err);
    }
  });

  r.post('/ask', async (req, res, next) => {
    try {
      const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
      if (!question) throw new AppError(400, 'VALIDATION_FAILED', MSG.invalid);
      const lang = req.body?.lang === 'bn' ? 'bn' : 'en';
      const routines = Array.isArray(req.body?.routines) ? req.body.routines : [];
      const answer = await answerQuestion({ question, lang, routines, config });
      res.json({ answer });
    } catch (err) {
      next(err);
    }
  });

  r.post('/generate', rateLimit({ name: 'assistant-generate', limit: 10, windowMs: MINUTE, by: 'user' }), async (req, res, next) => {
    try {
      const intent = typeof req.body?.intent === 'string' ? req.body.intent.trim() : '';
      if (!intent) throw new AppError(400, 'VALIDATION_FAILED', MSG.invalid);
      const lang = req.body?.lang === 'bn' ? 'bn' : 'en';
      const drafts = await generateRoutineDraft({ intent, lang, config });
      res.json({ drafts });
    } catch (err) {
      next(err);
    }
  });

  r.post('/replan', rateLimit({ name: 'assistant-replan', limit: 15, windowMs: MINUTE, by: 'user' }), async (req, res, next) => {
    try {
      const routineId = req.body?.routineId;
      if (!routineId) throw new AppError(400, 'VALIDATION_FAILED', MSG.invalid);
      const lang = req.body?.lang === 'bn' ? 'bn' : 'en';
      const plan = await generateAdaptiveReplan({
        routineId,
        userId: req.userId,
        lang,
        timezone: req.user?.timezone || 'Asia/Dhaka',
        config,
      });
      res.json(plan);
    } catch (err) {
      next(err);
    }
  });

  r.post('/micro-complete', rateLimit({ name: 'assistant-micro-complete', limit: 30, windowMs: MINUTE, by: 'user' }), async (req, res, next) => {
    try {
      const routineId = req.body?.routineId;
      if (!routineId) throw new AppError(400, 'VALIDATION_FAILED', MSG.invalid);
      const microNotes = req.body?.microNotes || '';
      const result = await completeMicroRoutine({
        routineId,
        userId: req.userId,
        date: req.body?.date,
        microNotes,
        timezone: req.user?.timezone || 'Asia/Dhaka',
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return r;
}
