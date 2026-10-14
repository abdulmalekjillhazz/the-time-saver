import { Lesson } from '../models/Lesson.js';
import { DailyLesson } from '../models/DailyLesson.js';
import { Quiz } from '../models/Quiz.js';
import { LessonScore } from '../models/LessonScore.js';
import { AppError, MSG } from '../lib/AppError.js';
import { scoreQuiz } from '@smart-routine/shared';

const LMSG = Object.freeze({
  slugTaken: { en: 'A lesson with this slug already exists.', bn: 'এই স্লাগ দিয়ে একটি পাঠ আগে থেকেই আছে।' },
  notDraft: { en: 'Only a draft can be submitted for review.', bn: 'শুধু খসড়া পাঠ পর্যালোচনার জন্য পাঠানো যায়।' },
  notReview: { en: 'Only a lesson in review can be published.', bn: 'শুধু পর্যালোচনায় থাকা পাঠ প্রকাশ করা যায়।' },
  authorOnly: { en: 'Only the author can submit this lesson.', bn: 'শুধু লেখক এই পাঠ জমা দিতে পারবেন।' },
  secondReviewer: {
    en: 'A second person must publish. The author cannot publish their own lesson.',
    bn: 'প্রকাশ করতে অন্য একজন ব্যক্তি লাগবে। লেখক নিজের পাঠ প্রকাশ করতে পারবেন না।',
  },
  answerCount: { en: 'Answer count must match the number of questions.', bn: 'উত্তরের সংখ্যা প্রশ্নের সংখ্যার সমান হতে হবে।' },
});

export function toPublicLesson(l) {
  if (l._isDailyLesson) {
    const titleObj = typeof l.title === 'object' ? l.title : { bn: l.title, en: l.title };
    const bodyObj = typeof l.content === 'object' ? l.content : { bn: l.content, en: l.content };
    return {
      id: String(l._id),
      slug: l.slug,
      date: l.date,
      title: titleObj,
      body: bodyObj,
      description: l.description || '',
      keyTakeaway: l.keyTakeaway || '',
      vocabulary: (l.vocabulary || []).map((v) => ({
        word: v.term || v.word,
        meaning: typeof v.definition === 'object' ? v.definition : { bn: v.definition || '', en: v.definition || '' },
      })),
      quiz: (l._quizQuestions || []).map((q) => ({
        question: { bn: q.text, en: q.text },
        options: (q.options || []).map((opt) => ({ bn: opt.text, en: opt.text })),
        explanation: q.explanation || '',
      })),
      media: l.audio?.url ? { type: 'audio', url: l.audio.url } : null,
      publishedAt: l.generatedAt || l.createdAt || new Date(),
    };
  }
  return {
    id: String(l._id),
    slug: l.slug,
    title: l.title,
    body: l.body,
    vocabulary: (l.vocabulary || []).map((v) => ({ word: v.word, meaning: v.meaning })),
    quiz: (l.quiz || []).map((q) => ({ question: q.question, options: q.options })),
    media: l.media?.url ? { type: l.media.resourceType, url: l.media.url } : null,
    publishedAt: l.publishedAt,
  };
}

export function toLessonSummary(l) {
  return {
    id: String(l._id),
    slug: l.slug,
    title: l.title,
    publishedAt: l.publishedAt,
    questionCount: (l.quiz || []).length,
  };
}

export async function listPublished() {
  const [editorialLessons, dailyLessons] = await Promise.all([
    Lesson.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(50).lean(),
    DailyLesson.find({}).sort({ date: -1, generatedAt: -1 }).limit(100).lean(),
  ]);

  const bySlug = new Map();
  for (const l of editorialLessons) {
    bySlug.set(l.slug, toLessonSummary(l));
  }

  for (const dl of dailyLessons) {
    const existing = bySlug.get(dl.slug);
    if (!existing) {
      bySlug.set(dl.slug, {
        id: String(dl._id),
        slug: dl.slug,
        date: dl.date,
        title: {
          bn: dl.locale === 'bn' ? `${dl.title} (${dl.date})` : dl.title,
          en: dl.locale === 'en' ? `${dl.title} (${dl.date})` : dl.title,
        },
        publishedAt: dl.generatedAt || dl.createdAt || new Date(),
        questionCount: 3,
        audioUrl: dl.audio?.url || null,
      });
    } else if (dl.locale === 'bn') {
      existing.title.bn = `${dl.title} (${dl.date})`;
    } else if (dl.locale === 'en') {
      existing.title.en = `${dl.title} (${dl.date})`;
    }
  }

  return Array.from(bySlug.values()).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

export async function findPublishedBySlug(slug) {
  const lesson = await Lesson.findOne({ slug, status: 'published' }).lean();
  if (lesson) return lesson;

  const dailyDocs = await DailyLesson.find({ slug }).sort({ date: -1 }).lean();
  if (!dailyDocs.length) throw new AppError(404, 'NOT_FOUND', MSG.notFound);

  const primary = dailyDocs[0];
  const bnDoc = dailyDocs.find((d) => d.locale === 'bn') || primary;
  const enDoc = dailyDocs.find((d) => d.locale === 'en') || primary;
  const quizDoc = await Quiz.findOne({ dailyLessonId: primary._id }).lean();

  return {
    ...primary,
    _isDailyLesson: true,
    title: { bn: bnDoc.title, en: enDoc.title },
    content: { bn: bnDoc.content, en: enDoc.content },
    _quizQuestions: quizDoc?.questions || [],
  };
}

export async function createDraft(author, data) {
  if (await Lesson.exists({ slug: data.slug })) throw new AppError(409, 'CONFLICT', LMSG.slugTaken);
  return Lesson.create({ ...data, status: 'draft', createdBy: author._id });
}

export async function updateLesson(slug, data) {
  const lesson = await findBySlug(slug);
  const updated = await Lesson.findOneAndUpdate(
    { _id: lesson._id, version: lesson.version },
    { $set: data,$inc: { version: 1 } },
    { new: true, runValidators: true }
  );
  if (!updated) throw new AppError(409, 'CONFLICT', MSG.conflict);
  return updated;
}

async function findBySlug(slug) {
  const lesson = await Lesson.findOne({ slug });
  if (!lesson) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
  return lesson;
}

export async function submitForReview(slug, actor) {
  const lesson = await findBySlug(slug);
  if (lesson.status !== 'draft') throw new AppError(409, 'CONFLICT', LMSG.notDraft);
  if (String(lesson.createdBy) !== String(actor._id)) throw new AppError(403, 'FORBIDDEN', LMSG.authorOnly);
  const updated = await Lesson.findOneAndUpdate(
    { _id: lesson._id, status: 'draft' },
    { $set: { status: 'review' } },
    { new: true }
  );
  if (!updated) throw new AppError(409, 'CONFLICT', LMSG.notDraft);
  return updated;
}

export async function publishLesson(slug, actor) {
  const lesson = await findBySlug(slug);
  if (lesson.status !== 'review') throw new AppError(409, 'CONFLICT', LMSG.notReview);
  if (String(lesson.createdBy) === String(actor._id) && !(actor.role === 'owner' && lesson.aiDrafted)) {
    throw new AppError(403, 'FORBIDDEN', LMSG.secondReviewer);
  }
  const updated = await Lesson.findOneAndUpdate(
    { _id: lesson._id, status: 'review' },
    {
      $set: { status: 'published', reviewedBy: actor._id, publishedAt: new Date() },$inc: { version: 1 },
    },
    { new: true }
  );
  if (!updated) throw new AppError(409, 'CONFLICT', LMSG.notReview);
  return updated;
}

export async function approveAiDraft(slug, actor) {
  const lesson = await findBySlug(slug);
  if (actor.role !== 'owner' || !lesson.aiDrafted || !['draft', 'review'].includes(lesson.status)) {
    throw new AppError(409, 'CONFLICT', {
      en: 'Only an unpublished AI draft can be approved by an owner.',
      bn: 'শুধু অপ্রকাশিত AI খসড়া owner অনুমোদন করতে পারবেন।',
    });
  }

  const updated = await Lesson.findOneAndUpdate(
    { _id: lesson._id, status: lesson.status, aiDrafted: true },
    {
      $set: { status: 'published', reviewedBy: actor._id, publishedAt: new Date(), },$inc: { version: 1 },
    },
    { new: true }
  );
  if (!updated) throw new AppError(409, 'CONFLICT', MSG.conflict);
  return updated;
}

export async function archiveLesson(slug) {
  const lesson = await findBySlug(slug);
  return Lesson.findByIdAndUpdate(lesson._id, { $set: { status: 'archived' } }, { new: true });
}

export async function submitAttempt(lessonId, user, answers) {
  let lesson = await Lesson.findOne({ _id: lessonId, status: 'published' });
  let quizQuestions = lesson ? (lesson.quiz || []) : null;

  if (!lesson) {
    const dailyLesson = await DailyLesson.findById(lessonId).lean();
    if (!dailyLesson) throw new AppError(404, 'NOT_FOUND', MSG.notFound);
    const quizDoc = await Quiz.findOne({ dailyLessonId: dailyLesson._id }).lean();
    quizQuestions = (quizDoc?.questions || []).map((q) => ({
      answerIndex: Math.max(0, (q.options || []).findIndex((o) => o.correct === true)),
    }));
    lesson = dailyLesson;
  }

  if (!Array.isArray(answers) || answers.length !== quizQuestions.length) {
    throw new AppError(400, 'VALIDATION_FAILED', LMSG.answerCount);
  }
  const result = scoreQuiz(quizQuestions, answers);
  await LessonScore.create({
    userId: user._id,
    lessonId: lesson._id,
    score: result.score,
    total: result.total,
  });
  return result;
}
