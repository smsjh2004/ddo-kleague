import { LEAGUE_TEAMS, TEAM_STADIUMS } from '../constants/TeamData';

// Helper to determine match outcome relative to myTeam (same rule used in
// DiaryListScreen.js / AnalysisScreen.js).
export function calculateOutcome(log, myTeam) {
  const home = log.homeTeam.trim();
  const away = log.awayTeam.trim();
  const homeScore = parseInt(log.homeScore);
  const awayScore = parseInt(log.awayScore);

  if (isNaN(homeScore) || isNaN(awayScore)) return '무';

  const cleanMyTeam = (myTeam || '').trim();
  const isHome = home === cleanMyTeam;
  const isAway = away === cleanMyTeam;

  if (!isHome && !isAway) {
    if (homeScore > awayScore) return '승';
    if (homeScore < awayScore) return '패';
    return '무';
  }

  if (homeScore === awayScore) return '무';

  if (isHome) {
    return homeScore > awayScore ? '승' : '패';
  }
  return awayScore > homeScore ? '승' : '패';
}

function sortByDate(logs) {
  return [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Longest consecutive run (in date order) where predicate(log) is true.
function getLongestRun(sortedLogs, predicate) {
  let longest = 0;
  let current = 0;
  sortedLogs.forEach((log) => {
    if (predicate(log)) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  });
  return longest;
}

function getLongestOutcomeStreak(logs, myTeam, outcome) {
  const sorted = sortByDate(logs);
  return getLongestRun(sorted, (log) => calculateOutcome(log, myTeam) === outcome);
}

function getLongestWinStreak(logs, myTeam) {
  return getLongestOutcomeStreak(logs, myTeam, '승');
}

// A fun, dynamically computed "current title" summarizing the fan's overall
// win rate - shown as a pill next to the nickname on My Page.
export function getAchievementTitle(logs, myTeam) {
  const total = logs.length;
  if (total === 0) return { emoji: '🌱', text: '새싹 직관러' };

  const wins = logs.filter((log) => calculateOutcome(log, myTeam) === '승').length;
  const winRate = (wins / total) * 100;

  if (winRate >= 80) return { emoji: '🏆', text: '걸어다니는 승리요정' };
  if (winRate >= 60) return { emoji: '😎', text: '근본있는 직관러' };
  if (winRate >= 40) return { emoji: '😐', text: '그냥저냥 직관러' };
  if (winRate >= 20) return { emoji: '😅', text: '승리가 고픈 직관러' };
  return { emoji: '🌧️', text: '비운의 직관러' };
}

// Auto-calculated achievement set derived from diary logs (+ optionally
// registered goods / which matches each item was worn to) - no extra
// backend table needed beyond what MyPageScreen already fetches.
// goods/goodsLogLinks default to [] so friend-profile callers (which don't
// fetch another user's goods) simply see every gear achievement as locked.
export function getAchievements(logs, myTeam, goods = [], goodsLogLinks = []) {
  const total = logs.length;
  const wins = logs.filter((log) => calculateOutcome(log, myTeam) === '승').length;
  const draws = logs.filter((log) => calculateOutcome(log, myTeam) === '무').length;
  const cleanMyTeam = (myTeam || '').trim();
  const sorted = sortByDate(logs);

  const homeLogs = logs.filter((log) => log.homeTeam.trim() === cleanMyTeam);
  const homeWins = homeLogs.filter((log) => calculateOutcome(log, myTeam) === '승').length;
  const awayLogs = logs.filter((log) => log.homeTeam.trim() !== cleanMyTeam);
  const awayWins = awayLogs.filter((log) => calculateOutcome(log, myTeam) === '승').length;

  const longestWinStreak = getLongestOutcomeStreak(logs, myTeam, '승');
  const longestLoseStreak = getLongestOutcomeStreak(logs, myTeam, '패');
  const longestDrawStreak = getLongestOutcomeStreak(logs, myTeam, '무');
  const longestHomeStreak = getLongestRun(sorted, (log) => log.homeTeam.trim() === cleanMyTeam);
  const longestAwayWinStreak = getLongestOutcomeStreak(awayLogs, myTeam, '승');
  const longestAwayLoseStreak = getLongestOutcomeStreak(awayLogs, myTeam, '패');

  const hasRainyLog = logs.some((log) => log.weather === '🌧️비');
  const rainyCount = logs.filter((log) => log.weather === '🌧️비').length;
  const hasFiveStarLog = logs.some((log) => log.rating === 5);
  const weatherSeen = new Set(logs.map((log) => log.weather).filter(Boolean));
  const stadiumsSeen = new Set(logs.map((log) => (log.stadium || '').trim()).filter(Boolean));
  const awayStadiumsSeen = new Set(awayLogs.map((log) => (log.stadium || '').trim()).filter(Boolean));
  const companionsSeen = new Set(
    logs.map((log) => (log.companion || '').trim()).filter((c) => c && c !== '혼관')
  );
  const hasMultiPhotoLog = logs.some((log) => Array.isArray(log.photos) && log.photos.length >= 3);
  const refereeLogs = logs.filter((log) => log.refereeScore !== undefined && log.refereeScore !== null);
  const hasLowRefLog = refereeLogs.some((log) => log.refereeScore <= 10);
  const hasHighRefLog = refereeLogs.some((log) => log.refereeScore >= 95);

  // Season/month/weekday buckets - K리그 시즌이 대체로 한 해 안에서 끝나므로
  // 달력 연도/월을 "시즌" 근사치로 사용 (별도 시즌 경계 데이터가 없음).
  const yearCounts = {};
  const monthCounts = {};
  logs.forEach((log) => {
    const d = (log.date || '').trim();
    if (d.length < 7) return;
    const year = d.slice(0, 4);
    const month = d.slice(0, 7);
    yearCounts[year] = (yearCounts[year] || 0) + 1;
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });
  const maxYearCount = Math.max(0, ...Object.values(yearCounts));
  const maxMonthCount = Math.max(0, ...Object.values(monthCounts));
  const weekdayCount = logs.filter((log) => {
    const parsed = new Date(log.date);
    if (isNaN(parsed.getTime())) return false;
    const day = parsed.getDay();
    return day >= 1 && day <= 5;
  }).length;

  // 2연패 이상 뒤 첫 승리가 등장하는지 (날짜순).
  const jinxBroken = (() => {
    const outcomes = sorted.map((log) => calculateOutcome(log, myTeam));
    for (let i = 2; i < outcomes.length; i++) {
      if (outcomes[i] === '승' && outcomes[i - 1] === '패' && outcomes[i - 2] === '패') return true;
    }
    return false;
  })();
  // 패배해도 그게 마지막 기록이 아니라 - 그 이후로도 직관을 이어감.
  const neverGiveUp = sorted.some((log, i) => i < sorted.length - 1 && calculateOutcome(log, myTeam) === '패');

  const hasHighScoringLog = logs.some((log) => {
    const h = parseInt(log.homeScore);
    const a = parseInt(log.awayScore);
    return !isNaN(h) && !isNaN(a) && h + a >= 5;
  });
  const scorelessCount = logs.filter((log) => parseInt(log.homeScore) === 0 && parseInt(log.awayScore) === 0).length;
  const hasBigLossLog = logs.some((log) => {
    if (calculateOutcome(log, myTeam) !== '패') return false;
    const h = parseInt(log.homeScore);
    const a = parseInt(log.awayScore);
    if (isNaN(h) || isNaN(a)) return false;
    return Math.abs(h - a) >= 3;
  });
  const hasSummerLog = logs.some((log) => {
    const m = parseInt((log.date || '').slice(5, 7));
    return m === 7 || m === 8;
  });
  const hasWinterLog = logs.some((log) => {
    const m = parseInt((log.date || '').slice(5, 7));
    return m === 11 || m === 12;
  });

  // 전 구장 도장깨기 - 내 팀이 속한 리그(K1/K2)의 모든 홈구장을 방문했는지.
  const myLeague = LEAGUE_TEAMS.K1.includes(cleanMyTeam) ? 'K1' : LEAGUE_TEAMS.K2.includes(cleanMyTeam) ? 'K2' : null;
  const leagueStadiums = myLeague ? LEAGUE_TEAMS[myLeague].map((t) => TEAM_STADIUMS[t]).filter(Boolean) : [];
  const hasVisitedAllLeagueStadiums = leagueStadiums.length > 0 && leagueStadiums.every((s) => stadiumsSeen.has(s));

  // 직관템(goods) 착용 기록 - goods_id -> 착용한 diary_log 배열.
  const logsById = new Map(logs.map((log) => [log.id, log]));
  const wornByGoodsId = new Map();
  const goodsIdsByLogId = new Map();
  goodsLogLinks.forEach((link) => {
    if (!wornByGoodsId.has(link.goods_id)) wornByGoodsId.set(link.goods_id, []);
    const matchedLog = logsById.get(link.diary_log_id);
    if (matchedLog) wornByGoodsId.get(link.goods_id).push(matchedLog);
    if (!goodsIdsByLogId.has(link.diary_log_id)) goodsIdsByLogId.set(link.diary_log_id, new Set());
    goodsIdsByLogId.get(link.diary_log_id).add(link.goods_id);
  });
  const wornGoodsIds = new Set(goodsLogLinks.map((l) => l.goods_id));

  const hasAnyWearLog = goodsLogLinks.length > 0;
  const hasAttachedGear = Array.from(wornByGoodsId.values()).some((wornLogs) => wornLogs.length >= 5);
  const hasClosetGear = goods.length > 0 && goods.some((g) => !wornGoodsIds.has(g.id));
  const hasFullOutfitDay = Array.from(goodsIdsByLogId.values()).some((set) => set.size >= 3);

  let hasLuckyGear = false;
  let hasCursedGear = false;
  let hasBrokeGearCurse = false;
  wornByGoodsId.forEach((wornLogs) => {
    if (wornLogs.length >= 5) {
      const gearWins = wornLogs.filter((log) => calculateOutcome(log, myTeam) === '승').length;
      const winRate = gearWins / wornLogs.length;
      if (winRate >= 0.8) hasLuckyGear = true;
      if (gearWins === 0) hasCursedGear = true;
    }
    if (wornLogs.length >= 4) {
      const bySortedDate = sortByDate(wornLogs);
      const first3 = bySortedDate.slice(0, 3);
      const rest = bySortedDate.slice(3);
      if (
        first3.every((log) => calculateOutcome(log, myTeam) !== '승') &&
        rest.some((log) => calculateOutcome(log, myTeam) === '승')
      ) {
        hasBrokeGearCurse = true;
      }
    }
  });

  return [
    {
      id: 'first_match',
      emoji: '🎉',
      label: '첫 직관',
      description: '직관일지를 처음 기록했어요',
      unlocked: total >= 1,
    },
    {
      id: 'ten_matches',
      emoji: '📚',
      label: '직관 10경기',
      description: '직관일지 10경기 기록 달성',
      unlocked: total >= 10,
    },
    {
      id: 'thirty_matches',
      emoji: '📖',
      label: '직관 30경기',
      description: '직관일지 30경기 기록 달성',
      unlocked: total >= 30,
    },
    {
      id: 'fifty_matches',
      emoji: '📜',
      label: '직관 50경기',
      description: '직관일지 50경기 기록 달성',
      unlocked: total >= 50,
    },
    {
      id: 'season_10_matches',
      emoji: '💺',
      label: '구단주가 좋아합니다',
      description: '한 시즌에 10회 이상 직관했어요',
      unlocked: maxYearCount >= 10,
    },
    {
      id: 'season_20_matches',
      emoji: '👻',
      label: '축구장 지박령',
      description: '한 시즌에 20회 이상 직관했어요',
      unlocked: maxYearCount >= 20,
    },
    {
      id: 'season_30_matches',
      emoji: '🎟️',
      label: '연간회원권의 노예',
      description: '한 시즌에 30회 이상 직관했어요',
      unlocked: maxYearCount >= 30,
    },
    {
      id: 'home_streak_5',
      emoji: '🏠',
      label: '홈 스위트 홈',
      description: '홈 경기 5회 연속 직관',
      unlocked: longestHomeStreak >= 5,
    },
    {
      id: 'monthly_4',
      emoji: '🗓️',
      label: '개근상',
      description: '한 달에 4번 이상 직관했어요',
      unlocked: maxMonthCount >= 4,
    },
    {
      id: 'weekday_3',
      emoji: '💼',
      label: '평일 직관러',
      description: '평일(월~금) 경기 3회 이상 직관',
      unlocked: weekdayCount >= 3,
    },
    {
      id: 'five_wins',
      emoji: '🏆',
      label: '5승 달성',
      description: '누적 5승을 달성했어요',
      unlocked: wins >= 5,
    },
    {
      id: 'ten_wins',
      emoji: '🏅',
      label: '10승 달성',
      description: '누적 10승을 달성했어요',
      unlocked: wins >= 10,
    },
    {
      id: 'three_streak',
      emoji: '🔥',
      label: '승리 요정(승요) 강림',
      description: '3경기 연속 승리를 기록했어요',
      unlocked: longestWinStreak >= 3,
    },
    {
      id: 'five_streak',
      emoji: '👼',
      label: '대천사 가브리엘',
      description: '5경기 연속 승리를 기록했어요',
      unlocked: longestWinStreak >= 5,
    },
    {
      id: 'lose_streak_3',
      emoji: '😭',
      label: '내가 미안해...',
      description: '3경기 연속 패배 - 패요의 시작',
      unlocked: longestLoseStreak >= 3,
    },
    {
      id: 'lose_streak_5',
      emoji: '💀',
      label: '파괴왕',
      description: '5경기 연속 패배. 당분간 집에서 보세요',
      unlocked: longestLoseStreak >= 5,
    },
    {
      id: 'draw_streak_3',
      emoji: '☮️',
      label: '평화주의자',
      description: '3경기 연속 무승부를 기록했어요',
      unlocked: longestDrawStreak >= 3,
    },
    {
      id: 'draw_master',
      emoji: '🤝',
      label: '무승부 장인',
      description: '누적 무승부 10회 달성',
      unlocked: draws >= 10,
    },
    {
      id: 'perfect_winrate',
      emoji: '💯',
      label: '승률 100%의 사나이/여자',
      description: '5경기 이상 직관 승률 100%',
      unlocked: total >= 5 && wins === total,
    },
    {
      id: 'perfect_loserate',
      emoji: '🫠',
      label: '마이너스의 손',
      description: '5경기 이상 직관 승률 0%. 오히려 대단함',
      unlocked: total >= 5 && wins === 0,
    },
    {
      id: 'jinx_breaker',
      emoji: '🔮',
      label: '징크스 브레이커',
      description: '연패를 끊고 드디어 승리했어요',
      unlocked: jinxBroken,
    },
    {
      id: 'never_give_up',
      emoji: '🎯',
      label: '오뚝이 정신',
      description: '패배해도 다시 경기장을 찾았어요',
      unlocked: neverGiveUp,
    },
    {
      id: 'perfect_away',
      emoji: '✈️',
      label: '완벽한 원정',
      description: '원정 3경기 이상, 전승',
      unlocked: awayLogs.length >= 3 && awayWins === awayLogs.length,
    },
    {
      id: 'perfect_home',
      emoji: '🏟️',
      label: '완벽한 홈',
      description: '홈 3경기 이상, 전승',
      unlocked: homeLogs.length >= 3 && homeWins === homeLogs.length,
    },
    {
      id: 'away_first',
      emoji: '🚪',
      label: '집 밖은 위험해',
      description: '원정 경기 첫 직관',
      unlocked: awayLogs.length >= 1,
    },
    {
      id: 'away_5',
      emoji: '🚌',
      label: '전국구 역마살',
      description: '원정 경기 5회 직관',
      unlocked: awayLogs.length >= 5,
    },
    {
      id: 'away_10',
      emoji: '🍱',
      label: '휴게소 미식가',
      description: '원정 경기 10회 직관',
      unlocked: awayLogs.length >= 10,
    },
    {
      id: 'away_stadiums_5',
      emoji: '🗾',
      label: '팔도 사나이/여자',
      description: '서로 다른 원정 구장 5곳 이상 방문',
      unlocked: awayStadiumsSeen.size >= 5,
    },
    {
      id: 'away_lose_streak_3',
      emoji: '😮‍💨',
      label: '원정의 쓴맛',
      description: '원정 경기 3연패',
      unlocked: longestAwayLoseStreak >= 3,
    },
    {
      id: 'away_win_streak_3',
      emoji: '⚔️',
      label: '적진 함락',
      description: '원정 경기 3연승',
      unlocked: longestAwayWinStreak >= 3,
    },
    {
      id: 'stadium_explorer',
      emoji: '🗺️',
      label: '전국구 직관러',
      description: '서로 다른 경기장 5곳 이상 방문',
      unlocked: stadiumsSeen.size >= 5,
    },
    {
      id: 'stadium_explorer_10',
      emoji: '🧭',
      label: '그라운드 호퍼',
      description: '서로 다른 경기장 10곳 이상 방문',
      unlocked: stadiumsSeen.size >= 10,
    },
    {
      id: 'league_complete',
      emoji: '📍',
      label: '대동여지도',
      description: '내 팀 소속 리그의 모든 구장 직관 완료',
      unlocked: hasVisitedAllLeagueStadiums,
    },
    {
      id: 'rainy_fan',
      emoji: '🌧️',
      label: '수중전 마스터',
      description: '비 오는 날에도 직관을 갔어요',
      unlocked: hasRainyLog,
    },
    {
      id: 'rainy_3',
      emoji: '🎡',
      label: '워터파크 개장',
      description: '비 오는 날 직관 3회. 감기 조심',
      unlocked: rainyCount >= 3,
    },
    {
      id: 'summer_survivor',
      emoji: '🥵',
      label: '대프리카 생존자',
      description: '한여름(7~8월) 경기 직관',
      unlocked: hasSummerLog,
    },
    {
      id: 'winter_padding',
      emoji: '🥶',
      label: '얼음보숭이',
      description: '한겨울(11~12월) 경기 직관',
      unlocked: hasWinterLog,
    },
    {
      id: 'high_scoring',
      emoji: '🍿',
      label: '팝콘각',
      description: '양 팀 합쳐 5골 이상 나온 난타전 직관',
      unlocked: hasHighScoringLog,
    },
    {
      id: 'scoreless_1',
      emoji: '😴',
      label: '수면제',
      description: '0:0 무승부 경기 직관',
      unlocked: scorelessCount >= 1,
    },
    {
      id: 'scoreless_3',
      emoji: '🌱',
      label: '잔디 감별사',
      description: '0:0 경기 누적 3회 직관',
      unlocked: scorelessCount >= 3,
    },
    {
      id: 'big_loss',
      emoji: '🙈',
      label: '안 본 눈 삽니다',
      description: '3점 차 이상 대패한 경기 직관',
      unlocked: hasBigLossLog,
    },
    {
      id: 'rating_five',
      emoji: '⭐',
      label: '최고의 하루',
      description: '별점 5점을 준 경기가 있어요',
      unlocked: hasFiveStarLog,
    },
    {
      id: 'all_weather',
      emoji: '🌈',
      label: '전천후 직관러',
      description: '맑음·흐림·비·눈, 4가지 날씨 모두 경험',
      unlocked: ['☀️맑음', '☁️흐림', '🌧️비', '❄️눈'].every((w) => weatherSeen.has(w)),
    },
    {
      id: 'social_butterfly',
      emoji: '🤝',
      label: '동행 마스터',
      description: '서로 다른 동행인 3명 이상과 함께 관람',
      unlocked: companionsSeen.size >= 3,
    },
    {
      id: 'photographer',
      emoji: '📸',
      label: '포토그래퍼',
      description: '사진 3장 이상 남긴 직관일지가 있어요',
      unlocked: hasMultiPhotoLog,
    },
    {
      id: 'referee_critic',
      emoji: '🤬',
      label: '심판 저격수',
      description: '심판 평가 10점 이하를 준 적이 있어요',
      unlocked: hasLowRefLog,
    },
    {
      id: 'referee_saint',
      emoji: '😇',
      label: '포청천의 인정',
      description: '심판 평가 95점 이상을 준 적이 있어요',
      unlocked: hasHighRefLog,
    },
    {
      id: 'gear_debut',
      emoji: '👕',
      label: '전투복 개시',
      description: '등록한 직관템을 입고 첫 직관',
      unlocked: hasAnyWearLog,
    },
    {
      id: 'gear_attach',
      emoji: '🧸',
      label: '애착 인형',
      description: '동일한 직관템을 5회 착용',
      unlocked: hasAttachedGear,
    },
    {
      id: 'gear_lucky',
      emoji: '🍀',
      label: '승리의 토템',
      description: '특정 직관템 착용 5경기 이상, 승률 80% 이상',
      unlocked: hasLuckyGear,
    },
    {
      id: 'gear_cursed',
      emoji: '👺',
      label: '저주받은 템',
      description: '특정 직관템 착용 5경기 이상, 승률 0%',
      unlocked: hasCursedGear,
    },
    {
      id: 'gear_curse_broken',
      emoji: '🧺',
      label: '세탁 요정',
      description: "'저주받은 템' 입고 드디어 첫 승리",
      unlocked: hasBrokeGearCurse,
    },
    {
      id: 'gear_fashion',
      emoji: '👗',
      label: '패션쇼',
      description: '서로 다른 직관템 5개 이상 등록',
      unlocked: goods.length >= 5,
    },
    {
      id: 'gear_hoarder',
      emoji: '🛍️',
      label: '굿즈 호구',
      description: '직관템 10개 이상 앱에 등록',
      unlocked: goods.length >= 10,
    },
    {
      id: 'gear_closet',
      emoji: '🧥',
      label: '장롱템',
      description: '등록만 해두고 한 번도 안 입은 직관템이 있어요',
      unlocked: hasClosetGear,
    },
    {
      id: 'gear_full',
      emoji: '🎽',
      label: '풀템 장착',
      description: '하루에 3개 이상의 직관템을 동시 착용',
      unlocked: hasFullOutfitDay,
    },
  ];
}
