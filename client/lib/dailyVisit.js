function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function recordDailyVisit(storage, userId, now = new Date()) {
  if (!storage || !userId) {
    throw new Error('Daily visit tracking requires browser storage and a user ID.');
  }

  const key = `smart-routine:daily-visit:${userId}`;
  const today = localDateKey(now);
  const savedValue = storage.getItem(key);
  let previous = null;

  if (savedValue) {
    try {
      const parsed = JSON.parse(savedValue);
      if (
        parsed
        && typeof parsed.date === 'string'
        && Number.isInteger(parsed.streak)
        && parsed.streak > 0
      ) {
        previous = parsed;
      }
    } catch {
      previous = null;
    }
  }

  if (previous?.date === today) {
    return { streak: previous.streak, checkedInToday: true };
  }

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const streak = previous?.date === localDateKey(yesterdayDate)
    ? previous.streak + 1
    : 1;

  storage.setItem(key, JSON.stringify({ date: today, streak }));
  return { streak, checkedInToday: true };
}
