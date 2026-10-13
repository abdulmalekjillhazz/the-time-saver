// Streak rules, kept pure so the API and tests share one definition.
// A "streak day" is a date on which the user marked at least one routine as done.

import { isValidDateString } from './time.js';

// Adds (or subtracts) whole days to a YYYY-MM-DD string. Uses UTC so DST never shifts it.
export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// doneDates: YYYY-MM-DD strings with at least one "done" completion.
// today: the user's logical today (see todayInZone).
// current: consecutive streak days ending today. If today is not done yet, it still counts
//          from yesterday, so the streak does not look broken while the day is in progress.
// longest: the best run of consecutive days in the given list.
export function computeStreak(doneDates, today) {
  const days = new Set(doneDates.filter(isValidDateString));

  let cursor = days.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (days.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of [...days].sort()) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  return { current, longest };
}
