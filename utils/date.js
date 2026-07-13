// "YYYY-MM-DD" for the real current date, in local time (not UTC, so it
// doesn't shift a day depending on the user's timezone).
export function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
