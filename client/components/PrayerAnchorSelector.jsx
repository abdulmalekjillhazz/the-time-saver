'use client';
import { useState } from 'react';
import { DEFAULT_PRAYER_ANCHORS, calculatePrayerRoutineTimes } from '../lib/prayerAnchors.js';

export function PrayerAnchorSelector({ lang = 'bn', onSelectAnchor, prayerTimings = null }) {
  const isBn = lang === 'bn';
  const [selectedPrayer, setSelectedPrayer] = useState('');
  const [offsetMinutes, setOffsetMinutes] = useState(15);
  const [isOpen, setIsOpen] = useState(false);

  const handleApply = (prayerKey) => {
    setSelectedPrayer(prayerKey);
    const calculated = calculatePrayerRoutineTimes({ prayerKey, offsetMinutes, durationMinutes: 30, prayerTimings });
    onSelectAnchor?.({ ...calculated, anchorHabitText: isBn ? calculated.anchorHabit.bn : calculated.anchorHabit.en });
  };

  return (
    <div className="glass-panel rounded-xl border border-sapphire/30 bg-sapphire/5 p-3 sm:col-span-2">
      <button type="button" onClick={() => setIsOpen((prev) => !prev)} className="flex w-full items-center justify-between text-left text-xs font-semibold text-sapphire hover:underline sm:text-sm">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true">🕌</span>
          <span>{isBn ? 'নামাজের সময়ের সাথে স্বয়ংক্রিয়ভাবে রুটিন মেলান' : 'Quickly anchor to prayer time'}</span>
        </span>
        <span className="text-xs font-bold">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="mt-3 space-y-3 pt-2 border-t border-sapphire/15">
          <div className="flex flex-wrap items-center gap-2">
            {[ { val: 0, l: isBn ? 'নামাজের সাথে' : 'Right after' }, { val: 15, l: isBn ? '১৫ মিনিট পর' : '15m after' }, { val: 30, l: isBn ? '৩০ মিনিট পর' : '30m after' } ].map(({ val, l }) => (
              <button key={val} type="button" onClick={() => setOffsetMinutes(val)} className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${offsetMinutes === val ? 'bg-sapphire text-on-sapphire font-bold shadow-[0_0_10px_rgba(96,165,250,0.5)]' : 'border border-sapphire/30 bg-paper/60 text-ink hover:border-sapphire/60'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {DEFAULT_PRAYER_ANCHORS.map((prayer, index) => (
              <button key={prayer.key} type="button" onClick={() => handleApply(prayer.key)} style={{ '--enter-delay': `${index * 50}ms` }} className={`enter-up flex flex-col items-center rounded-xl p-2 text-center text-xs transition-all ${selectedPrayer === prayer.key ? 'border-2 border-sapphire bg-sapphire/20 font-bold text-ink shadow-[0_0_12px_rgba(96,165,250,0.4)]' : 'border border-sapphire/20 bg-paper text-ink hover:border-sapphire/50'}`}>
                <span className="font-semibold">{isBn ? prayer.name.bn : prayer.name.en}</span>
                <span className="text-[11px] opacity-75">{prayer.defaultTime}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
