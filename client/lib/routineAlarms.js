// Pure helpers for daily routine alarms. Keeping the date math here makes it
// testable without a device and avoids the "only today was scheduled" bug.
//
// Routines store wall-clock times in the user's timezone, not the device's.
// A user travelling (or with a misconfigured phone) must still get 08:00
// Dhaka at 08:00 Dhaka, matching the server scheduler.
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function validTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
    return timeZone;
  } catch {
    return null;
  }
}

function zoneParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const find = (type) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: find('year'),
    month: find('month'),
    day: find('day'),
    hour: find('hour'),
    minute: find('minute'),
    second: find('second'),
  };
}

// Converts a wall-clock time in `timeZone` to a UTC timestamp. The offset is
// looked up twice so times near a daylight-saving transition settle correctly.
function zonedTimestamp(year, month, day, hour, minute, timeZone) {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetAt = (timestamp) => {
    const parts = zoneParts(new Date(timestamp), timeZone);
    return Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - timestamp;
  };
  const firstPass = wallClockAsUtc - offsetAt(wallClockAsUtc);
  return wallClockAsUtc - offsetAt(firstPass);
}

function addDays(year, month, day, days) {
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function occurrence(startTime, now, timeZone) {
  if (typeof startTime !== 'string' || !TIME_PATTERN.test(startTime)) return null;
  const [hours, minutes] = startTime.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;

  const zone = validTimeZone(timeZone);
  if (!zone) {
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    const isToday = target.getTime() > now.getTime();
    if (!isToday) target.setDate(target.getDate() + 1);
    return { at: target.getTime(), isToday };
  }

  const today = zoneParts(now, zone);
  let at = zonedTimestamp(today.year, today.month, today.day, hours, minutes, zone);
  const isToday = at > now.getTime();
  if (!isToday) {
    const tomorrow = addDays(today.year, today.month, today.day, 1);
    at = zonedTimestamp(tomorrow.year, tomorrow.month, tomorrow.day, hours, minutes, zone);
  }
  return { at, isToday };
}

export function nextRoutineOccurrence(startTime, now = new Date(), timeZone) {
  return occurrence(startTime, now, timeZone)?.at ?? null;
}

export function buildRoutineAlarms(routines, now = new Date(), timeZone) {
  if (!Array.isArray(routines)) return [];
  return routines
    .map((routine) => {
      if (!routine || typeof routine.id !== 'string' || !routine.title) return null;
      const next = occurrence(routine.startTime, now, timeZone);
      if (!next) return null;
      // A routine already completed today should not ring again today, but its
      // repeat still needs to be armed for tomorrow.
      if (next.isToday && routine.completionStatus) return null;
      return {
        id: `routine-${routine.id}`,
        at: next.at,
        label: routine.title,
        repeatDaily: true,
        timeZone: validTimeZone(timeZone) || '',
      };
    })
    .filter(Boolean);
}
