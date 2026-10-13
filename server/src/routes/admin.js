import { Router } from 'express';
import { z } from 'zod';
import {
  lessonDraftSchema,
  lessonEditSchema,
  dailyLessonEditSchema,
  roleChangeSchema,
  mfaCodeSchema,
  uploadSignatureSchema,
  attachMediaSchema,
  auditQuerySchema,
} from '@smart-routine/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { requireStaff, requireAdmin, requireRole, requireCloudinary } from '../middleware/roles.js';
import { writeAudit, listAudit } from '../services/audit.js';
import * as mfa from '../services/mfa.js';
import { setRole } from '../services/roles.js';
import { createDraft, updateLesson, submitForReview, publishLesson, approveAiDraft, archiveLesson, listAllLessons } from '../services/lessons.js';
import { createSignature, attachMedia, detachMedia, cleanupUploads } from '../services/uploads.js';
import { effectiveFlags, setFlag } from '../services/flags.js';
import { FLAG_DEFAULTS } from '@smart-routine/shared';
import { AppError, MSG } from '../lib/AppError.js';
import { sha256 } from '../lib/crypto.js';
import { SESSION_COOKIE } from '../lib/cookies.js';
import { Session } from '../models/Session.js';
import { DailyLesson } from '../models/DailyLesson.js';
import { generateLessonDraftsWithGemini } from '../services/geminiLessons.js';
import {
  generateAdminDailyLessonAudio,
  generateDailyLesson,
  listAdminDailyLessons,
  updateAdminDailyLesson,
} from '../services/dailyLesson.js';
import { listAdminLandingQuizzes, saveLandingQuiz } from '../services/landingQuizzes.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const aiLessonCountSchema = z.object({
  count: z.number().int().min(1).max(12),
  context: z.string().trim().max(3000).default(''),
}).strict();
const dailyStoryRegenerationSchema = z.object({
  context: z.string().trim().max(1000).default(''),
}).strict();
const localizedQuizTextSchema = z.object({
  bn: z.string().trim().min(1).max(600),
  en: z.string().trim().min(1).max(600),
}).strict();
const landingQuizSchema = z.object({
  question: z.object({
    bn: z.string().trim().min(1).max(300),
    en: z.string().trim().min(1).max(300),
  }).strict(),
  options: z.array(z.object({
    bn: z.string().trim().min(1).max(160),
    en: z.string().trim().min(1).max(160),
  }).strict()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: localizedQuizTextSchema,
}).strict();

export function adminRouter(config) {
  const r = Router();
  r.use(requireAuth);

  r.get('/status', (req, res) => {
    const verifiedAt = req.session?.mfaVerifiedAt ? new Date(req.session.mfaVerifiedAt).getTime() : 0;
    res.json({
      role: req.user.role ?? 'user',
      mfaEnabled: Boolean(req.user.mfa?.enabled),
      mfaVerified: Date.now() - verifiedAt <= 12 * HOUR,
    });
  });

  // Two-factor setup and sign-in. Staff only, but these run before MFA is active.
  r.get('/mfa/setup', requireStaff, rateLimit({ name: 'mfa-setup-resume', limit: 20, windowMs: HOUR, by: 'user' }), async (req, res, next) => {
    try {
      res.json({ setup: await mfa.getPendingSetup(req.userId, req.user.email, config) });
    } catch (err) {
      next(err);
    }
  });

  r.post('/mfa/setup', requireStaff, rateLimit({ name: 'mfa-setup', limit: 5, windowMs: HOUR, by: 'user' }), async (req, res, next) => {
    try {
      res.json(await mfa.beginSetup(req.userId, req.user.email, config));
    } catch (err) {
      next(err);
    }
  });

  r.post('/mfa/confirm', requireStaff, rateLimit({ name: 'mfa-confirm', limit: 10, windowMs: HOUR, by: 'user' }), validate({ body: mfaCodeSchema }), async (req, res, next) => {
    try {
      await mfa.confirmSetup(req.userId, req.body.code, config);
      await writeAudit({ actor: req.user, action: 'mfa.enabled', targetType: 'user', targetId: req.userId, requestId: req.id });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  r.post('/mfa/verify', requireStaff, rateLimit({ name: 'mfa-verify', limit: 10, windowMs: MINUTE, by: 'user' }), validate({ body: mfaCodeSchema }), async (req, res, next) => {
    try {
      const session = await Session.findOne({ currentHash: sha256(req.cookies[SESSION_COOKIE]) }).lean();
      await mfa.verifyForSession(req.userId, session._id, req.body.code, config);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Everything below needs staff role, two-factor sign-in, and a recent code.
  r.use(requireAdmin());

  r.get('/audit-log', requireRole('viewer', 'editor', 'owner'), validate({ query: auditQuerySchema }), async (req, res, next) => {
    try {
      res.json(await listAudit(req.query));
    } catch (err) {
      next(err);
    }
  });

  r.get('/flags', requireRole('owner'), async (_req, res, next) => {
    try {
      res.json({ flags: await effectiveFlags() });
    } catch (err) {
      next(err);
    }
  });

  r.post('/users/:id/role', requireRole('owner'), validate({ body: roleChangeSchema }), async (req, res, next) => {
    try {
      const target = await setRole(req.user, req.params.id, req.body.role);
      await writeAudit({ actor: req.user, action: 'role.change', targetType: 'user', targetId: req.params.id, summary: `role=${req.body.role}`, requestId: req.id });
      res.json({ user: { id: String(target._id), role: target.role } });
    } catch (err) {
      next(err);
    }
  });

  r.get('/lessons', requireRole('viewer', 'editor', 'owner'), async (_req, res, next) => {
    try {
      const lessons = await listAllLessons();
      res.json({
        lessons: lessons.map((l) => ({
          id: String(l._id),
          slug: l.slug,
          status: l.status,
          title: l.title,
          body: l.body,
          quiz: l.quiz,
          authorId: String(l.createdBy),
          aiDrafted: Boolean(l.aiDrafted),
          createdAt: l.createdAt,
          media: l.media?.url ? { type: l.media.resourceType, url: l.media.url } : null,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  r.get('/landing-quizzes', requireRole('viewer', 'editor', 'owner'), async (_req, res, next) => {
    try {
      res.json({ quizzes: await listAdminLandingQuizzes() });
    } catch (err) {
      next(err);
    }
  });

  r.put('/landing-quizzes/:slot', requireRole('editor', 'owner'), rateLimit({
    name: 'admin-landing-quiz-save', limit: 30, windowMs: MINUTE, by: 'user',
  }), validate({ body: landingQuizSchema }), async (req, res, next) => {
    try {
      const slot = Number(req.params.slot);
      if (![1, 2].includes(slot)) throw new AppError(400, 'VALIDATION_FAILED', MSG.invalid);
      const quiz = await saveLandingQuiz(slot, req.body, req.user._id);
      await writeAudit({
        actor: req.user,
        action: 'landing_quiz.publish',
        targetType: 'landing_quiz',
        targetId: String(slot),
        summary: `slot=${slot}`,
        requestId: req.id,
      });
      res.json({ quiz });
    } catch (err) {
      next(err);
    }
  });

  r.get('/daily-lessons', requireRole('viewer', 'editor', 'owner'), async (_req, res, next) => {
    try {
      res.json({ lessons: await listAdminDailyLessons() });
    } catch (err) {
      next(err);
    }
  });

  r.patch('/daily-lessons/:id', requireRole('editor', 'owner'), validate({ body: dailyLessonEditSchema }), async (req, res, next) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
        throw new AppError(400, 'VALIDATION_FAILED', MSG.invalid);
      }
      const { lesson } = await updateAdminDailyLesson(req.params.id, req.body);
      await writeAudit({
        actor: req.user,
        action: 'daily_lesson.update',
        targetType: 'daily_lesson',
        targetId: lesson._id,
        summary: `date=${lesson.date}; locale=${lesson.locale}`,
        requestId: req.id,
      });
      res.json({ lesson: { id: String(lesson._id), date: lesson.date, locale: lesson.locale } });
    } catch (err) {
      next(err);
    }
  });

  r.post(
    '/daily-lessons/:id/regenerate',
    requireRole('owner'),
    rateLimit({ name: 'admin-daily-story-regeneration', limit: 2, windowMs: HOUR, by: 'user' }),
    validate({ body: dailyStoryRegenerationSchema }),
    async (req, res, next) => {
      try {
        if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
          throw new AppError(400, 'VALIDATION_FAILED', MSG.invalid);
        }
        const target = await DailyLesson.findById(req.params.id).select('date locale').lean();
        if (!target) {
          throw new AppError(404, 'NOT_FOUND', { en: 'Daily lesson not found.', bn: 'দৈনিক পাঠ পাওয়া যায়নি।' });
        }
        const result = await generateDailyLesson({
          date: target.date,
          locale: target.locale,
          config,
          force: true,
          context: req.body.context,
          strictAI: true,
        });
        await writeAudit({
          actor: req.user,
          action: 'daily_lesson.regenerate',
          targetType: 'daily_lesson',
          targetId: result.dailyLesson._id,
          summary: `date=${target.date}; locale=${target.locale}`,
          requestId: req.id,
        });
        res.json({ lesson: { id: String(result.dailyLesson._id), date: result.dailyLesson.date, locale: result.dailyLesson.locale } });
      } catch (err) {
        next(err);
      }
    }
  );

  r.post(
    '/daily-lessons/:id/narration',
    requireRole('owner'),
    rateLimit({ name: 'admin-daily-narration', limit: 3, windowMs: HOUR, by: 'user' }),
    async (req, res, next) => {
      try {
        if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
          throw new AppError(400, 'VALIDATION_FAILED', MSG.invalid);
        }
        const { lesson, reused } = await generateAdminDailyLessonAudio(req.params.id, config);
        await writeAudit({
          actor: req.user,
          action: reused ? 'daily_lesson.narration_reused' : 'daily_lesson.narration_generated',
          targetType: 'daily_lesson',
          targetId: lesson._id,
          summary: `date=${lesson.date}; locale=${lesson.locale}`,
          requestId: req.id,
        });
        res.json({
          lesson: {
            id: String(lesson._id),
            date: lesson.date,
            locale: lesson.locale,
            audio: lesson.audio,
          },
          reused,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  r.post('/lessons', requireRole('editor', 'owner'), validate({ body: lessonDraftSchema }), async (req, res, next) => {
    try {
      const lesson = await createDraft(req.user, req.body);
      await writeAudit({ actor: req.user, action: 'lesson.create', targetType: 'lesson', targetId: lesson._id, summary: `slug=${lesson.slug}`, requestId: req.id });
      res.status(201).json({ lesson: { id: String(lesson._id), slug: lesson.slug, status: lesson.status } });
    } catch (err) {
      next(err);
    }
  });

  r.patch('/lessons/:slug', requireRole('editor', 'owner'), validate({ body: lessonEditSchema }), async (req, res, next) => {
    try {
      const lesson = await updateLesson(req.params.slug, req.body);
      await writeAudit({
        actor: req.user,
        action: 'lesson.update',
        targetType: 'lesson',
        targetId: lesson._id,
        summary: `slug=${lesson.slug}; status=${lesson.status}`,
        requestId: req.id,
      });
      res.json({ lesson: { slug: lesson.slug, status: lesson.status, version: lesson.version } });
    } catch (err) {
      next(err);
    }
  });

  r.post(
    '/lessons/ai-drafts',
    requireRole('owner'),
    rateLimit({ name: 'admin-ai-lesson-drafts', limit: 2, windowMs: HOUR, by: 'user' }),
    validate({ body: aiLessonCountSchema }),
    async (req, res, next) => {
      try {
        const lessons = await generateLessonDraftsWithGemini(config, req.user, req.body.count, req.body.context);
        await writeAudit({
          actor: req.user,
          action: 'lesson.ai_draft_batch',
          targetType: 'lesson',
          summary: `count=${lessons.length}`,
          requestId: req.id,
        });
        res.status(201).json({ created: lessons.length, lessons: lessons.map((lesson) => ({ slug: lesson.slug, status: lesson.status })) });
      } catch (err) {
        next(err);
      }
    }
  );

  r.post('/lessons/:slug/submit', requireRole('editor', 'owner'), async (req, res, next) => {
    try {
      const lesson = await submitForReview(req.params.slug, req.user);
      await writeAudit({ actor: req.user, action: 'lesson.submit', targetType: 'lesson', targetId: lesson._id, summary: `slug=${lesson.slug}`, requestId: req.id });
      res.json({ lesson: { slug: lesson.slug, status: lesson.status } });
    } catch (err) {
      next(err);
    }
  });

  r.post('/lessons/:slug/approve', requireRole('owner'), async (req, res, next) => {
    try {
      const lesson = await approveAiDraft(req.params.slug, req.user);
      await writeAudit({ actor: req.user, action: 'lesson.ai_draft_approve', targetType: 'lesson', targetId: lesson._id, summary: `slug=${lesson.slug}`, requestId: req.id });
      res.json({ lesson: { slug: lesson.slug, status: lesson.status } });
    } catch (err) {
      next(err);
    }
  });

  r.post('/lessons/:slug/publish', requireRole('editor', 'owner'), async (req, res, next) => {
    try {
      const lesson = await publishLesson(req.params.slug, req.user);
      await writeAudit({ actor: req.user, action: 'lesson.publish', targetType: 'lesson', targetId: lesson._id, summary: `slug=${lesson.slug}`, requestId: req.id });
      res.json({ lesson: { slug: lesson.slug, status: lesson.status } });
    } catch (err) {
      next(err);
    }
  });

  r.post('/lessons/:slug/archive', requireRole('owner'), async (req, res, next) => {
    try {
      const lesson = await archiveLesson(req.params.slug, req.user);
      await detachMedia(lesson.slug);
      await writeAudit({ actor: req.user, action: 'lesson.archive', targetType: 'lesson', targetId: lesson._id, summary: `slug=${lesson.slug}`, requestId: req.id });
      res.json({ lesson: { slug: lesson.slug, status: lesson.status } });
    } catch (err) {
      next(err);
    }
  });

  r.post('/uploads/signature', requireRole('editor', 'owner'), requireCloudinary, validate({ body: uploadSignatureSchema }), async (req, res, next) => {
    try {
      const signed = await createSignature(req.user, req.body.resourceType);
      await writeAudit({ actor: req.user, action: 'upload.sign', targetType: 'upload', targetId: signed.publicId, summary: `type=${req.body.resourceType}`, requestId: req.id });
      res.json(signed);
    } catch (err) {
      next(err);
    }
  });

  r.post('/lessons/:slug/media', requireRole('editor', 'owner'), requireCloudinary, validate({ body: attachMediaSchema }), async (req, res, next) => {
    try {
      const lesson = await attachMedia(req.params.slug, req.user, req.body);
      await writeAudit({ actor: req.user, action: 'media.attach', targetType: 'lesson', targetId: lesson._id, summary: `type=${req.body.resourceType}`, requestId: req.id });
      res.json({ lesson: { slug: lesson.slug, media: { type: lesson.media.resourceType, url: lesson.media.url } } });
    } catch (err) {
      next(err);
    }
  });

  r.delete('/lessons/:slug/media', requireRole('editor', 'owner'), async (req, res, next) => {
    try {
      const lesson = await detachMedia(req.params.slug);
      await writeAudit({ actor: req.user, action: 'media.detach', targetType: 'lesson', targetId: lesson._id, summary: `slug=${lesson.slug}`, requestId: req.id });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  r.post('/uploads/cleanup', requireRole('owner'), requireCloudinary, async (req, res, next) => {
    try {
      const stats = await cleanupUploads();
      await writeAudit({ actor: req.user, action: 'upload.cleanup', targetType: 'upload', summary: `deleted=${stats.deleted},failed=${stats.failed}`, requestId: req.id });
      res.json(stats);
    } catch (err) {
      next(err);
    }
  });

  r.post('/flags/:key', requireRole('owner'), async (req, res, next) => {
    try {
      if (!Object.prototype.hasOwnProperty.call(FLAG_DEFAULTS, req.params.key)) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
      const enabled = req.body?.enabled;
      const rolloutPercent = req.body?.rolloutPercent;
      if (typeof enabled !== 'boolean' || !Number.isInteger(rolloutPercent) || rolloutPercent < 0 || rolloutPercent > 100) {
        throw new AppError(400, 'VALIDATION_FAILED', MSG.invalid, [{ path: 'enabled/rolloutPercent', message: 'enabled must be true or false; rolloutPercent 0 to 100' }]);
      }
      const flag = await setFlag(req.params.key, { enabled, rolloutPercent }, req.user._id);
      await writeAudit({ actor: req.user, action: 'flag.set', targetType: 'flag', targetId: req.params.key, summary: `enabled=${enabled},rollout=${rolloutPercent}`, requestId: req.id });
      res.json({ flag: { key: flag.key, enabled: flag.enabled, rolloutPercent: flag.rolloutPercent } });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
