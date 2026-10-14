'use client';

import { useState } from 'react';
import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';
import { PrayerAnchorSelector } from './PrayerAnchorSelector.jsx';
import { addMinutesToTime, formatNaturalTime } from '../lib/prayerAnchors.js';
import { getRoutineMood } from '../lib/routineMood.js';

const QUICK_PRESETS = [
  {
    id: 'walk',
    icon: '🌅',
    bn: 'সকালের হাঁটা ও ব্যায়াম',
    en: 'Morning Walk & Exercise',
    category: 'health',
    startTime: '06:30',
    endTime: '07:00',
    priority: 'high',
    anchorBn: 'সকালের নাস্তার আগে',
    anchorEn: 'Before morning breakfast',
  },
  {
    id: 'quran',
    icon: '📖',
    bn: 'কুরআন তিলাওয়াত ও সকালের দোয়া',
    en: 'Quran Reading & Morning Prayer',
    category: 'prayer',
    startTime: '05:20',
    endTime: '05:45',
    priority: 'high',
    anchorBn: 'ফজরের নামাজের পর',
    anchorEn: 'After Fajr prayer',
  },
  {
    id: 'study',
    icon: '💻',
    bn: 'মনোযোগ দিয়ে পড়াশোনা / ডিপ ওয়ার্ক',
    en: 'Deep Work / Focused Study',
    category: 'study',
    startTime: '09:00',
    endTime: '10:00',
    priority: 'high',
    anchorBn: 'পড়ার টেবিলে বসার সাথে সাথে',
    anchorEn: 'Right after sitting at the desk',
  },
  {
    id: 'english',
    icon: '🇬🇧',
    bn: 'ইংরেজি গল্প ও ভোকাবুলারি অনুশীলন',
    en: 'English Story & Vocabulary Practice',
    category: 'study',
    startTime: '20:00',
    endTime: '20:30',
    priority: 'medium',
    anchorBn: 'এশার নামাজের পর',
    anchorEn: 'After Isha prayer',
  },
  {
    id: 'water',
    icon: '💧',
    bn: 'পানি পান ও চোখের বিশ্রাম',
    en: 'Hydration & Eye Rest Break',
    category: 'health',
    startTime: '14:30',
    endTime: '14:45',
    priority: 'medium',
    anchorBn: 'দুপুরের খাবারের পর',
    anchorEn: 'After lunch',
  },
  {
    id: 'sleep',
    icon: '🌙',
    bn: 'আগামীকালের ব্যাগ গুছিয়ে ঘুমের প্রস্তুতি',
    en: 'Pack Tomorrow’s Bag & Wind Down',
    category: 'mind',
    startTime: '22:15',
    endTime: '22:35',
    priority: 'medium',
    anchorBn: 'রাতের খাবারের পর',
    anchorEn: 'After dinner',
  },
];

const CATEGORIES = [
  { value: 'study', icon: '📚', bn: 'পড়াশোনা ও শেখা (Study)', en: 'Study & Learning' },
  { value: 'work', icon: '💼', bn: 'কাজ ও ক্যারিয়ার (Work)', en: 'Work & Career' },
  { value: 'health', icon: '💪', bn: 'স্বাস্থ্য ও ব্যায়াম (Health)', en: 'Health & Fitness' },
  { value: 'prayer', icon: '🕌', bn: 'ইবাদত ও নামাজ (Prayer)', en: 'Prayer & Faith' },
  { value: 'mind', icon: '🌿', bn: 'মানসিক প্রশান্তি ও বিশ্রাম (Rest)', en: 'Mindfulness & Rest' },
  { value: 'general', icon: '🏠', bn: 'দৈনন্দিন অন্যান্য কাজ (General)', en: 'Daily General' },
];

const DURATION_CHIPS = [
  { mins: 15, bn: '+১৫ মিনিট', en: '+15 min' },
  { mins: 30, bn: '+৩০ মিনিট', en: '+30 min' },
  { mins: 45, bn: '+৪৫ মিনিট', en: '+45 min' },
  { mins: 60, bn: '+১ ঘণ্টা', en: '+1 hr' },
  { mins: 90, bn: '+১.৫ ঘণ্টা', en: '+1.5 hr' },
];

export function AddRoutineBuilderCard({ lang = 'bn', copy, busy = false, onSubmitRoutine }) {
  const isBn = lang === 'bn';
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('study');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('07:30');
  const [anchorHabit, setAnchorHabit] = useState('');
  const [priority, setPriority] = useState('medium');
  const [isFrog, setIsFrog] = useState(false);

  const routineMood = getRoutineMood(startTime, endTime);
  const timeInvalid = Boolean(startTime && endTime && routineMood.durationMinutes === 0);

  const applyPreset = (preset) => {
    setTitle(isBn ? preset.bn : preset.en);
    setCategory(preset.category);
    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
    setPriority(preset.priority);
    setAnchorHabit(isBn ? preset.anchorBn : preset.anchorEn);
  };

  const applyDuration = (minutes) => {
    const baseStart = startTime || '07:00';
    if (!startTime) setStartTime(baseStart);
    setEndTime(addMinutesToTime(baseStart, minutes));
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    if (timeInvalid) return;
    await onSubmitRoutine(event, () => {
      setTitle('');
      setAnchorHabit('');
      setIsFrog(false);
    });
  };

  return (
    <Card
      id="add-routine-card"
      as="form"
      className="surface-card space-y-5 p-4 sm:p-6"
      onSubmit={handleFormSubmit}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/25 pb-3">
        <div>
          <h2 className="section-heading text-lg sm:text-xl">
            <span aria-hidden="true">🌱</span> {copy.addRoutine}
          </h2>
          <p className="mt-0.5 text-xs text-ink/75">
            {isBn
              ? 'নিচের যেকোনো রেডিমেড চিপে ট্যাপ করুন অথবা নিজের মতো সহজে রুটিন সাজান'
              : 'Tap any quick preset below or customize your own routine in seconds'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-3.5">
        <p className="text-xs font-extrabold uppercase tracking-wider text-gold-soft mb-2.5">
          ⚡ {isBn ? '১-ট্যাপে জনপ্রিয় রুটিন বেছে নিন (Quick Fill):' : '1-Tap Popular Routine Presets:'}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="flex min-h-[42px] items-center gap-2 rounded-xl border border-gold/35 bg-paper/90 px-3 py-2 text-left text-xs font-bold text-ink transition hover:border-sapphire hover:bg-sapphire/15"
            >
              <span className="text-base">{preset.icon}</span>
              <span className="truncate">{isBn ? preset.bn : preset.en}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold text-ink">
          ✏️ {copy.routineName}
          <input
            name="title"
            required
            maxLength="120"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isBn ? 'যেমন: সকালের হাঁটা বা ইংরেজি অনুশীলন' : 'e.g. Morning walk or English practice'}
            className="mt-1.5 block w-full rounded-xl border bg-paper p-3 text-sm font-medium text-ink"
          />
        </label>

        <label className="block text-sm font-bold text-ink">
          🗂️ {copy.category}
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border bg-paper p-3 text-sm font-medium text-ink"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.icon} {isBn ? c.bn : c.en}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PrayerAnchorSelector
          lang={lang}
          onSelectAnchor={({ startTime: st, endTime: et, anchorHabitText }) => {
            setStartTime(st);
            setEndTime(et);
            setAnchorHabit(anchorHabitText);
          }}
        />
        <label className="block text-sm font-bold text-ink sm:col-span-2">
          ⚓ {copy.anchorHabit}
          <input
            name="anchorHabit"
            value={anchorHabit}
            onChange={(event) => setAnchorHabit(event.target.value)}
            maxLength="120"
            placeholder={isBn ? 'যেমন: ফজরের নামাজের পর বা নাস্তার পরে' : 'e.g. After Fajr prayer or after breakfast'}
            className="mt-1.5 block w-full rounded-xl border bg-paper p-3 text-sm font-medium text-ink"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-sapphire/30 bg-sapphire/5 p-4 space-y-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-ink">
            🕰️ {copy.start}
            <input
              name="startTime"
              type="time"
              required
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="polished-input mt-1.5 block w-full p-3"
            />
          </label>
          <label className="block text-sm font-bold text-ink">
            🏁 {copy.end}
            <input
              name="endTime"
              type="time"
              required
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="polished-input mt-1.5 block w-full p-3"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-gold-soft mr-1">
              ⏱️ {isBn ? 'দ্রুত সময়সীমা:' : 'Quick duration:'}
            </span>
            {DURATION_CHIPS.map((d) => (
              <button
                key={d.mins}
                type="button"
                onClick={() => applyDuration(d.mins)}
                className="rounded-lg border border-gold/40 bg-paper px-2.5 py-1 text-xs font-bold text-gold-soft transition hover:border-sapphire hover:bg-sapphire hover:text-on-sapphire"
              >
                {isBn ? d.bn : d.en}
              </button>
            ))}
          </div>

          {startTime && endTime && !timeInvalid ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-soft">
              <span>{routineMood.mood === 'happy' ? '😊' : routineMood.mood === 'angry' ? '😠' : '✨'}</span>
              <span>
                {formatNaturalTime(startTime, lang)} – {formatNaturalTime(endTime, lang)}
              </span>
              {routineMood.durationMinutes !== null ? (
                <span>
                  ({copy.routineDuration(Math.floor(routineMood.durationMinutes / 60), routineMood.durationMinutes % 60)})
                </span>
              ) : null}
            </span>
          ) : null}
        </div>

        {timeInvalid ? (
          <p role="alert" className="rounded-xl border border-rose-400 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300">
            ❌ {copy.timeInvalid}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
        <label className="block text-sm font-bold text-ink">
          🎯 {copy.priority}
          <select
            name="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border bg-paper p-3 text-sm font-bold text-ink"
          >
            <option value="low">🟢 {copy.low}</option>
            <option value="medium">🟡 {copy.medium}</option>
            <option value="high">🔴 {copy.high}</option>
          </select>
        </label>

        <label className="important-task-option cursor-pointer mt-1 sm:mt-6">
          <input
            name="isFrog"
            type="checkbox"
            checked={isFrog}
            onChange={(e) => setIsFrog(e.target.checked)}
          />
          <span className="important-task-copy">
            <span>⭐ {copy.markImportant}</span>
            <small>{copy.importantHelp}</small>
          </span>
        </label>
      </div>

      <div className="pt-1">
        <Button
          className="min-h-[50px] w-full justify-center text-base font-extrabold"
          type="submit"
          disabled={busy || timeInvalid}
        >
          <span aria-hidden="true">➕</span>
          <span className="ml-2">{copy.add}</span>
        </Button>
      </div>
    </Card>
  );
}
