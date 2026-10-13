// Server-side reads from the API. Failures return a status, never throw, so pages still render.
import { isSafeSlug } from './seo.js';

const API = (process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');
const REVALIDATE = 60;

export async function getLessons() {
  try {
    const res = await fetch(`${API}/api/lessons`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return { ok: false, reason: 'unavailable', lessons: [] };
    const body = await res.json();
    return { ok: true, lessons: body.lessons ?? [] };
  } catch {
    return { ok: false, reason: 'unavailable', lessons: [] };
  }
}

export async function getLesson(slug) {
  if (!isSafeSlug(slug)) return { ok: false, reason: 'not-found' };
  try {
    const res = await fetch(`${API}/api/lessons/${slug}`, { next: { revalidate: REVALIDATE } });
    if (res.status === 404) return { ok: false, reason: 'not-found' };
    if (!res.ok) return { ok: false, reason: 'unavailable' };
    const body = await res.json();
    return { ok: true, lesson: body.lesson };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export async function getTodayLesson(locale = 'bn') {
  try {
    const res = await fetch(`${API}/api/lessons/today?locale=${encodeURIComponent(locale)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { ok: false, reason: 'unavailable' };
    const body = await res.json();
    return { ok: true, dailyLesson: body.dailyLesson, quiz: body.quiz };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export async function getLandingQuizzes() {
  try {
    const res = await fetch(`${API}/api/lessons/landing-quizzes`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return { ok: false, quizzes: [] };
    const body = await res.json();
    return { ok: true, quizzes: body.quizzes ?? [] };
  } catch {
    return { ok: false, quizzes: [] };
  }
}

export async function getLatestQuiz(locale = 'bn') {
  try {
    const res = await fetch(`${API}/api/quizzes/latest?locale=${encodeURIComponent(locale)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { ok: false, reason: 'unavailable' };
    const body = await res.json();
    return { ok: true, quiz: body.quiz, lessonSlug: body.lessonSlug };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export async function getIslamicReflection(locale = 'bn') {
  try {
    const res = await fetch(`${API}/api/islamic-reflections/today?locale=${encodeURIComponent(locale)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { ok: false, reason: 'unavailable', reflection: null };
    const body = await res.json();
    return { ok: true, reflection: body.reflection ?? null };
  } catch {
    return { ok: false, reason: 'unavailable', reflection: null };
  }
}
