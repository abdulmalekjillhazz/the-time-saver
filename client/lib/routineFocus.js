function minutesAt(time) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

export function getFocusRoutines(routines) {
  const unfinished = routines
    .filter((routine) => !routine.completionStatus)
    .sort((a, b) => (
      Number(Boolean(b.isFrog)) - Number(Boolean(a.isFrog))
      || ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority])
      || minutesAt(a.startTime) - minutesAt(b.startTime)
    ));
  return unfinished.slice(0, Math.max(1, Math.ceil(unfinished.length * 0.2)));
}
