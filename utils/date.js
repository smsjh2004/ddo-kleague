// "YYYY-MM-DD" for the real current date, in local time (not UTC, so it
// doesn't shift a day depending on the user's timezone).
export function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Month-grid cell math shared by every calendar/date-picker UI: which weekday
// the 1st falls on, how many days are in this month and the previous one
// (for the leading trailing-cell row), and the "YYYY-MM" prefix used to build
// each cell's full date string.
export function buildMonthGrid(year, month) {
  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const prevLastDate = new Date(year, month, 0).getDate();
  const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  return { firstDayIndex, lastDate, prevLastDate, monthStr };
}
