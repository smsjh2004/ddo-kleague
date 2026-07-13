const fs = require('fs');
const path = require('path');

const SCHEDULE_PATH = path.join(__dirname, '../constants/schedule.json');
const SCHEDULE_URL = "https://www.kleague.com/getScheduleList.do";

const TEAM_ID_MAP = {
  // K1
  'K21': '강원 FC',
  'K22': '광주 FC',
  'K35': '김천 상무 FC',
  'K10': '대전 하나 시티즌',
  'K26': '부천 FC 1995',
  'K09': 'FC 서울',
  'K27': 'FC 안양',
  'K01': '울산 HD FC',
  'K18': '인천 유나이티드 FC',
  'K05': '전북 현대 모터스',
  'K04': '제주 SK FC',
  'K03': '포항 스틸러스',
  // K2
  'K02': '수원삼성블루윙즈',
  'K06': '부산아이파크',
  'K31': '서울 이랜드 FC',
  'K17': '대구 FC',
  'K39': '화성 FC',
  'K36': '김포 FC',
  'K29': '수원 FC',
  'K34': '충남아산 FC',
  'K38': '천안 시티 FC',
  'K08': '성남 FC',
  'K20': '경남 FC',
  'K40': '파주 시민 축구단',
  'K42': '용인 시민 축구단',
  'K32': '안산 그리너스 FC',
  'K07': '전남 드래곤즈',
  'K41': '김해시청 축구단',
  'K37': '충북 청주 FC'
};

async function fetchScheduleMonth(year, month, leagueId) {
  const response = await fetch(SCHEDULE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "accept": "application/json"
    },
    body: JSON.stringify({
      year: String(year),
      month: String(month).padStart(2, "0"),
      leagueId: Number(leagueId)
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch schedule for ${year}-${month} leagueId ${leagueId}`);
  }
  
  const res = await response.json();
  return res.data?.scheduleList || [];
}

async function main() {
  console.log('Loading local schedule...');
  if (!fs.existsSync(SCHEDULE_PATH)) {
    console.error(`Schedule file not found at: ${SCHEDULE_PATH}`);
    process.exit(1);
  }

  const localSchedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
  console.log(`Loaded ${localSchedule.length} matches from local schedule.`);

  const months = ['03', '04', '05', '06', '07', '08', '09', '10', '11'];
  const leagues = [1, 2];

  // Fetch all 2026 matches
  const apiMatches = [];
  for (const month of months) {
    for (const leagueId of leagues) {
      console.log(`Fetching 2026-${month} K${leagueId}...`);
      try {
        const matches = await fetchScheduleMonth(2026, month, leagueId);
        apiMatches.push(...matches);
        console.log(`Fetched ${matches.length} matches.`);
      } catch (err) {
        console.error(`Error fetching month ${month} league ${leagueId}:`, err.message);
      }
    }
  }

  console.log(`Total fetched matches from API: ${apiMatches.length}`);

  // Create lookup dictionary for API matches
  const apiLookup = {};
  for (const match of apiMatches) {
    const date = match.gameDate ? match.gameDate.replace(/\./g, '-') : null; // YYYY-MM-DD
    const homeTeam = TEAM_ID_MAP[match.homeTeam];
    const awayTeam = TEAM_ID_MAP[match.awayTeam];
    if (date && homeTeam && awayTeam) {
      const key = `${date}_${homeTeam}_${awayTeam}`;
      apiLookup[key] = match;
    }
  }

  // Update local schedule
  let updatedCount = 0;
  for (const localMatch of localSchedule) {
    const key = `${localMatch.date}_${localMatch.home}_${localMatch.away}`;
    const apiMatch = apiLookup[key];
    if (apiMatch) {
      if (apiMatch.endYn === 'Y') {
        localMatch.homeScore = apiMatch.homeGoal;
        localMatch.awayScore = apiMatch.awayGoal;
        updatedCount++;
      } else {
        localMatch.homeScore = null;
        localMatch.awayScore = null;
      }
    } else {
      // If not found in K-League API, set to null
      localMatch.homeScore = null;
      localMatch.awayScore = null;
    }
  }

  console.log(`Updated ${updatedCount} matches with scores.`);

  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(localSchedule, null, 2), 'utf8');
  console.log('Saved updated schedule back to schedule.json.');
}

main().catch(err => {
  console.error('Fatal error:', err);
});
