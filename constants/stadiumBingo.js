// K-League stadiums for the "원정 구단 도장깨기" bingo grids on My Page,
// split by division: K1 is a 3x3 grid (9 clubs), K2 is a 4x4 grid (16 clubs).
// Full club rosters per division (ordered by curation priority) so the
// user's own team can be excluded and the grid still filled back up to size.
// `match` substrings are checked against each diary log's `stadium` field
// (see TEAM_STADIUMS in screens/DiaryWriteScreen.js for the canonical names).
export const ALL_STADIUMS_K1 = [
  { key: 'seoul', label: '서울', teamName: 'FC 서울', match: ['서울월드컵'] },
  { key: 'ulsan', label: '울산', teamName: '울산 HD FC', match: ['울산문수'] },
  { key: 'jeonju', label: '전주', teamName: '전북 현대 모터스', match: ['전주월드컵'] },
  { key: 'pohang', label: '포항', teamName: '포항 스틸러스', match: ['포항스틸야드'] },
  { key: 'gangwon', label: '강원', teamName: '강원 FC', match: ['강릉종합', '빅크라운', '하이원아레나'] },
  { key: 'jeju', label: '제주', teamName: '제주 SK FC', match: ['제주월드컵'] },
  { key: 'gwangju', label: '광주', teamName: '광주 FC', match: ['광주축구전용', '광주월드컵'] },
  { key: 'daejeon', label: '대전', teamName: '대전 하나 시티즌', match: ['대전월드컵'] },
  { key: 'incheon', label: '인천', teamName: '인천 유나이티드 FC', match: ['인천축구전용'] },
  { key: 'gimcheon', label: '김천', teamName: '김천 상무 FC', match: ['김천종합'] },
  { key: 'bucheon', label: '부천', teamName: '부천 FC 1995', match: ['부천종합'] },
  { key: 'anyang', label: '안양', teamName: 'FC 안양', match: ['안양종합'] },
];

export const ALL_STADIUMS_K2 = [
  { key: 'suwonbw', label: '수원W', teamName: '수원삼성블루윙즈', match: ['수원월드컵'] },
  { key: 'busan', label: '부산', teamName: '부산아이파크', match: ['부산아시아드', '구덕'] },
  { key: 'seoule', label: '목동', teamName: '서울 이랜드 FC', match: ['목동종합'] },
  { key: 'daegu', label: '대구', teamName: '대구 FC', match: ['대구은행파크', '대구iM뱅크', 'iM뱅크PARK'] },
  { key: 'hwaseong', label: '화성', teamName: '화성 FC', match: ['화성종합'] },
  { key: 'gimpo', label: '김포', teamName: '김포 FC', match: ['김포솔터'] },
  { key: 'suwonfc', label: '수원종', teamName: '수원 FC', match: ['수원종합'] },
  { key: 'asan', label: '아산', teamName: '충남아산 FC', match: ['이순신종합'] },
  { key: 'cheonan', label: '천안', teamName: '천안 시티 FC', match: ['천안종합'] },
  { key: 'seongnam', label: '성남', teamName: '성남 FC', match: ['탄천종합'] },
  { key: 'gyeongnam', label: '경남', teamName: '경남 FC', match: ['창원축구'] },
  { key: 'paju', label: '파주', teamName: '파주 프런티어 FC', match: ['파주스타디움'] },
  { key: 'yongin', label: '용인', teamName: '용인 FC', match: ['용인미르'] },
  { key: 'ansan', label: '안산', teamName: '안산 그리너스 FC', match: ['안산와~'] },
  { key: 'jeonnam', label: '전남', teamName: '전남 드래곤즈', match: ['광양축구', '광양전용'] },
  { key: 'chungbuk', label: '청주', teamName: '충북 청주 FC', match: ['청주종합'] },
  { key: 'gimhae', label: '김해', teamName: '김해 FC 2008', match: ['김해종합운동장', '김해종합'] },
];

function buildLines(size) {
  const lines = [];
  for (let r = 0; r < size; r++) lines.push(Array.from({ length: size }, (_, c) => r * size + c));
  for (let c = 0; c < size; c++) lines.push(Array.from({ length: size }, (_, r) => r * size + c));
  lines.push(Array.from({ length: size }, (_, i) => i * size + i));
  lines.push(Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)));
  return lines;
}
const LINES_3X3 = buildLines(3);
const LINES_4X4 = buildLines(4);

// Builds the current grid for a division: excludes the user's own team (can't
// "away-trip" to your own home ground), then rotates through the remaining
// pool by `round` so completing a board and starting the next one shows a
// fresh set of clubs instead of the exact same 9/16 again.
export function getBingoGrid(division, myTeam, round = 0) {
  const size = division === 'k1' ? 9 : 16;
  const fullList = division === 'k1' ? ALL_STADIUMS_K1 : ALL_STADIUMS_K2;
  const cleanTeam = (myTeam || '').trim();
  const filtered = fullList.filter((t) => t.teamName !== cleanTeam);
  const n = filtered.length;
  return Array.from({ length: size }, (_, i) => filtered[(round * size + i) % n]);
}

// Real-world stadium strings come from scraped schedule data with
// inconsistent spacing ("대구iM뱅크PARK" vs "김천 종합 운동장"), so whitespace
// is stripped from both sides before substring matching.
const stripSpaces = (s) => s.replace(/\s+/g, '');

export function getStampedStadiumKeys(logs, stadiumList) {
  const stamped = new Set();
  logs.forEach((log) => {
    const stadium = stripSpaces(log.stadium || '');
    stadiumList.forEach((s) => {
      if (s.match.some((m) => stadium.includes(stripSpaces(m)))) {
        stamped.add(s.key);
      }
    });
  });
  return stamped;
}

export function countCompletedBingoLines(stampedKeys, stadiumList) {
  const lines = stadiumList.length === 16 ? LINES_4X4 : LINES_3X3;
  return lines.filter((line) =>
    line.every((i) => stampedKeys.has(stadiumList[i].key))
  ).length;
}
