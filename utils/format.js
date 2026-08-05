export function formatWon(num) {
  return new Intl.NumberFormat('ko-KR').format(num) + '원';
}

export function formatWonShort(num) {
  if (num >= 10000) return `${Math.round(num / 10000)}`;
  if (num >= 1000) return `${Math.round(num / 1000)}`;
  return `${num}`;
}
