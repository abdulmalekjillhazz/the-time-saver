'use client';

import React from 'react';
import { profileAvatarIds } from '@smart-routine/shared';

const AVATARS = {
  sunrise: {
    labels: { en: 'Sunrise', bn: 'সূর্যোদয়' },
    background: 'fill-amber-200',
    skin: 'fill-amber-800',
    hair: 'fill-stone-800',
    shirt: 'fill-teal-700',
    hairShape: 'M27 41c0-19 10-30 25-30 16 0 26 11 26 30v7H27z',
  },
  wave: {
    labels: { en: 'Wavy hair', bn: 'ঢেউ খেলানো চুল' },
    background: 'fill-blue-200',
    skin: 'fill-orange-300',
    hair: 'fill-amber-950',
    shirt: 'fill-blue-600',
    hairShape: 'M27 43c-5-16 4-32 19-34 17-3 33 10 30 29l-4 29-8-1 2-22-6-8c-7 7-17 9-29 6l-1 24h-8z',
  },
  curls: {
    labels: { en: 'Curly hair', bn: 'কোঁকড়া চুল' },
    background: 'fill-violet-200',
    skin: 'fill-amber-900',
    hair: 'fill-stone-900',
    shirt: 'fill-violet-600',
    hairShape: 'M28 44c-9-2-8-14-2-17-3-12 8-21 17-17 7-11 23-8 26 1 11 0 15 14 8 21l-3 22h-8l1-22c-9 7-21 7-30 2v20h-8z',
  },
  hijab: {
    labels: { en: 'Teal hijab', bn: 'নীলচে সবুজ হিজাব' },
    background: 'fill-emerald-200',
    skin: 'fill-orange-300',
    hair: 'fill-teal-900',
    shirt: 'fill-emerald-700',
    hairShape: 'M27 46c0-19 10-32 25-32s25 13 25 32v16l10 19H17l10-19z',
  },
  glasses: {
    labels: { en: 'Round glasses', bn: 'গোল চশমা' },
    background: 'fill-rose-200',
    skin: 'fill-orange-200',
    hair: 'fill-amber-900',
    shirt: 'fill-rose-700',
    hairShape: 'M28 41c-2-20 7-31 23-31 17 0 27 12 25 31l-7 5-4-13c-10 5-21 5-31 0l-2 13z',
    glasses: true,
  },
  cap: {
    labels: { en: 'Baseball cap', bn: 'ক্যাপ' },
    background: 'fill-orange-200',
    skin: 'fill-orange-400',
    hair: 'fill-amber-950',
    shirt: 'fill-orange-700',
    hairShape: 'M29 40c0-14 9-24 22-24 14 0 23 10 23 24v9H29z',
    cap: true,
  },
};

export function ProfileAvatar({ avatarId = 'sunrise', lang = 'bn', size = 'md', className = '' }) {
  const avatar = AVATARS[avatarId] || AVATARS.sunrise;
  const dimensions = size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-8 w-8' : 'h-12 w-12';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={`${dimensions} shrink-0 rounded-full ring-2 ring-white/80 ${className}`}
      role="img"
    >
      <circle cx="50" cy="50" r="50" className={avatar.background} />
      <path d="M14 100c3-19 16-29 36-29s33 10 36 29" className={avatar.shirt} />
      <path d={avatar.hairShape} className={avatar.hair} />
      {avatar.cap ? <><path d="M26 31c1-14 11-22 24-22 13 0 23 8 24 22-13-6-34-6-48 0z" className="fill-slate-800" /><path d="M49 29c14-4 31-2 39 5-7 5-21 6-37 3z" className="fill-slate-700" /></> : null}
      {avatarId === 'hijab' ? <path d="M29 47c6 9 14 13 23 13s17-4 23-13l8 19-9 20H26l-9-20z" className={avatar.hair} /> : null}
      <ellipse cx="51" cy="49" rx="17" ry="21" className={avatar.skin} />
      <path d="M42 51h1m15 0h1" className="stroke-stone-800" strokeLinecap="round" strokeWidth="3" />
      <path d="M47 60c3 2 6 2 9 0" fill="none" className="stroke-rose-900" strokeLinecap="round" strokeWidth="2" />
      {avatar.glasses ? <g fill="none" className="stroke-slate-700" strokeWidth="2.5"><circle cx="44" cy="51" r="7" /><circle cx="60" cy="51" r="7" /><path d="M51 51h2" /></g> : null}
    </svg>
  );
}

export function ProfileAvatarPicker({ value, onChange, lang = 'bn' }) {
  return (
    <fieldset className="mt-3">
      <legend className="mb-2 text-sm font-semibold">{lang === 'bn' ? 'একটি অবতার বেছে নিন' : 'Choose an avatar'}</legend>
      <div className="flex flex-wrap gap-2">
        {profileAvatarIds.map((avatarId) => {
          const selected = value === avatarId;
          return (
            <button
              key={avatarId}
              type="button"
              aria-label={AVATARS[avatarId].labels[lang] || AVATARS[avatarId].labels.en}
              aria-pressed={selected}
              onClick={() => onChange(avatarId)}
              className={`flex min-h-16 flex-col items-center gap-1 rounded-xl border p-1.5 text-[10px] transition ${selected ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-600' : 'border-gray-200 hover:border-emerald-400'}`}
            >
              <ProfileAvatar avatarId={avatarId} lang={lang} size="sm" />
              <span>{AVATARS[avatarId].labels[lang] || AVATARS[avatarId].labels.en}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
