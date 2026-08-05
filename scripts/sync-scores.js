// Admin-only local score sync - run by hand on your own machine, never
// shipped inside the app. Nothing here runs automatically; you decide when
// to check for new results and when to actually publish them.
//
// Setup (one-time):
//   1. Run supabase/migration_schedule_table.sql once in the Supabase SQL Editor.
//   2. Create .env.local (gitignored) in the project root with:
//        SUPABASE_SERVICE_ROLE_KEY=<Project Settings -> API -> service_role key>
//        API_FOOTBALL_KEY=<your api-football.com key>
//
// Usage:
//   node --env-file=.env.local scripts/sync-scores.js            (preview only, writes nothing)
//   node --env-file=.env.local scripts/sync-scores.js --apply    (writes matched updates to Supabase)
//   node --env-file=.env.local scripts/sync-scores.js --days=5   (look back further than the default 2 days)

const { createClient } = require('@supabase/supabase-js');

// Not a secret (same public project URL already embedded in the client app
// and in every migration file this session) - hardcoded here so this plain
// CommonJS script doesn't need to import the ES-module client config.
const SUPABASE_URL = 'https://oejglqgrngfaauskdryk.supabase.co';

const K_LEAGUE_1_ID = 292;
const K_LEAGUE_2_ID = 293;

// English (API-Football) name fragment -> our Korean team name. Checked
// longest-fragment-first so e.g. "seoul e-land" is tried before the bare
// "seoul" fragment, and "suwon bluewings" before "suwon fc".
const NAME_MAP = {
  'gimcheon sangmu': '김천 상무 FC',
  'bucheon': '부천 FC 1995',
  'gwangju': '광주 FC',
  'pohang steelers': '포항 스틸러스',
  'ulsan hyundai': '울산 HD FC',
  'jeonbuk motors': '전북 현대 모터스',
  'incheon united': '인천 유나이티드 FC',
  'anyang': 'FC 안양',
  'jeju united': '제주 SK FC',
  'daejeon citizen': '대전 하나 시티즌',
  'gangwon': '강원 FC',
  'seoul e-land': '서울 이랜드 FC',
  'seoul e land': '서울 이랜드 FC',
  'seoul': 'FC 서울',
  'ansan greeners': '안산 그리너스 FC',
  'suwon bluewings': '수원삼성블루윙즈',
  'suwon samsung': '수원삼성블루윙즈',
  'suwon fc': '수원 FC',
  'daegu': '대구 FC',
  'seongnam': '성남 FC',
  'hwaseong': '화성 FC',
  'paju citizen': '파주 프런티어 FC',
  'yongin city': '용인 FC',
  'cheongju': '충북 청주 FC',
  'asan mugunghwa': '충남아산 FC',
  'chungnam asan': '충남아산 FC',
  'gyeongnam': '경남 FC',
  'busan i park': '부산아이파크',
  'busan ipark': '부산아이파크',
  'gimpo citizen': '김포 FC',
  'cheonan city': '천안 시티 FC',
  'jeonnam dragons': '전남 드래곤즈',
  'gimhae': '김해 FC 2008',
};
const SORTED_KEYS = Object.keys(NAME_MAP).sort((a, b) => b.length - a.length);

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim();
}

function matchKoreanName(apiName) {
  const norm = normalize(apiName);
  for (const key of SORTED_KEYS) {
    if (norm.includes(key)) return NAME_MAP[key];
  }
  return null;
}

function dateString(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const daysArg = process.argv.find((a) => a.startsWith('--days='));
  const daysBack = daysArg ? parseInt(daysArg.split('=')[1], 10) : 2;

  const apiKey = process.env.API_FOOTBALL_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey) {
    console.error('API_FOOTBALL_KEY missing - set it in .env.local and run with --env-file=.env.local');
    process.exit(1);
  }
  if (apply && !serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY missing - needed to actually write (--apply). Without --apply this only previews.');
    process.exit(1);
  }

  const supabase = serviceKey ? createClient(SUPABASE_URL, serviceKey) : null;

  const dates = [];
  for (let i = 0; i <= daysBack; i++) dates.push(dateString(-i));

  console.log(`Checking ${dates.join(', ')} ...\n`);

  const changes = [];
  const unmatched = [];

  for (const date of dates) {
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
      headers: { 'x-apisports-key': apiKey },
    });
    if (!res.ok) {
      console.warn(`  [${date}] request failed: ${res.status}`);
      continue;
    }
    const json = await res.json();
    if (json.errors && Object.keys(json.errors).length > 0) {
      console.warn(`  [${date}] API error:`, json.errors);
      continue;
    }
    const fixtures = (json.response || []).filter(
      (f) => f.league.id === K_LEAGUE_1_ID || f.league.id === K_LEAGUE_2_ID
    );

    for (const f of fixtures) {
      if (f.fixture.status.short !== 'FT') continue;
      const homeKr = matchKoreanName(f.teams.home.name);
      const awayKr = matchKoreanName(f.teams.away.name);
      if (!homeKr || !awayKr) {
        unmatched.push(`[${date}] ${f.teams.home.name} vs ${f.teams.away.name}`);
        continue;
      }
      changes.push({
        date,
        homeKr,
        awayKr,
        homeScore: f.goals.home,
        awayScore: f.goals.away,
      });
    }
  }

  if (changes.length === 0) {
    console.log('No finished K League matches found in this window.');
  } else {
    console.log(`Found ${changes.length} finished match(es):\n`);
    for (const c of changes) {
      console.log(`  ${c.date}  ${c.homeKr} ${c.homeScore} - ${c.awayScore} ${c.awayKr}`);
    }
  }

  if (unmatched.length > 0) {
    console.log(`\nCould not map team name for ${unmatched.length} match(es) - add them to NAME_MAP:`);
    unmatched.forEach((u) => console.log(`  ${u}`));
  }

  if (!apply) {
    console.log('\nDry run only - nothing written. Re-run with --apply to publish these to Supabase.');
    return;
  }

  console.log('\nApplying to Supabase...');
  let updated = 0;
  for (const c of changes) {
    const { error, count } = await supabase
      .from('schedule')
      .update(
        { home_score: c.homeScore, away_score: c.awayScore, updated_at: new Date().toISOString() },
        { count: 'exact' }
      )
      .eq('match_date', c.date)
      .eq('home_team', c.homeKr)
      .eq('away_team', c.awayKr);
    if (error) {
      console.warn(`  failed to update ${c.date} ${c.homeKr} vs ${c.awayKr}:`, error.message);
    } else {
      updated += count || 0;
    }
  }
  console.log(`Done - ${updated} row(s) updated.`);
}

main();
