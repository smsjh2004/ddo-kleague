import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/supabaseConfig';

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          // Native has no browser storage or URL to read tokens from - it
          // persists the session in AsyncStorage and utils/auth.js parses
          // the redirect URL manually via WebBrowser. Web uses the default
          // localStorage + auto-detects the session from the URL hash after
          // the Kakao redirect lands back on the page.
          storage: Platform.OS === 'web' ? undefined : AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === 'web',
        },
      })
    : null;

async function safeCall(label, fn) {
  if (!supabase) {
    console.warn(`[api] Supabase가 아직 설정되지 않아 "${label}" 요청을 건너뜁니다. constants/supabaseConfig.js에 URL/key를 입력해주세요.`);
    return null;
  }
  try {
    const { error, data } = await fn();
    if (error) {
      console.warn(`[api] ${label} 실패:`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn(`[api] ${label} 오류:`, err.message);
    return null;
  }
}

export async function getProfile(userId) {
  return safeCall('프로필 조회', () =>
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  );
}

export async function deleteProfileRemote(userId) {
  return safeCall('회원탈퇴', () =>
    supabase.from('profiles').delete().eq('id', userId)
  );
}

// Removes the auth.users row too, which the anon key can't touch - see
// supabase/functions/delete-account. Everything else cascades off it, so this
// alone is a full purge. Returns false if the call failed, letting the caller
// fall back to deleting just the profile row.
export async function deleteAccountRemote() {
  const result = await safeCall('계정 삭제', () =>
    supabase.functions.invoke('delete-account', { method: 'POST' })
  );
  return result?.ok === true;
}

export async function upsertProfile(deviceId, { nickname, myTeam, avatarUrl }) {
  return safeCall('프로필 저장', () =>
    supabase.from('profiles').upsert({
      id: deviceId,
      nickname,
      my_team: myTeam || null,
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    })
  );
}

export async function upsertDiaryLog(deviceId, log) {
  return safeCall('직관일지 저장', () =>
    supabase.from('diary_logs').upsert({
      id: log.id,
      user_id: deviceId,
      home_team: log.homeTeam,
      away_team: log.awayTeam,
      home_score: log.homeScore,
      away_score: log.awayScore,
      match_date: log.date,
      stadium: log.stadium,
      rating: log.rating,
      photo_url: log.photo || null,
      photo_urls: log.photos && log.photos.length > 0 ? log.photos : null,
      review: log.review || '',
      companion: log.companion || '혼관',
      companion_friend_ids: log.companionFriendIds && log.companionFriendIds.length > 0 ? log.companionFriendIds : null,
      weather: log.weather || '☀️맑음',
      referee_score: log.refereeScore,
      updated_at: new Date().toISOString(),
    })
  );
}

// Raw rows come back snake_case - re-shape into the camelCase log objects
// the rest of the client (DiaryListScreen, AnalysisScreen, achievements...)
// already expects, matching exactly what DiaryWriteScreen builds on save.
export async function listDiaryLogs(userId) {
  const rows = await safeCall('직관일지 목록 조회', () =>
    supabase.from('diary_logs').select('*').eq('user_id', userId).order('match_date', { ascending: false })
  );
  if (!rows) return null;
  return rows.map((r) => ({
    id: r.id,
    homeTeam: r.home_team,
    awayTeam: r.away_team,
    homeScore: r.home_score,
    awayScore: r.away_score,
    date: r.match_date,
    stadium: r.stadium,
    rating: r.rating,
    photos: r.photo_urls && r.photo_urls.length > 0 ? r.photo_urls : (r.photo_url ? [r.photo_url] : []),
    photo: r.photo_url || (r.photo_urls && r.photo_urls[0]) || null,
    review: r.review || '',
    companion: r.companion || '혼관',
    companionFriendIds: r.companion_friend_ids || [],
    weather: r.weather || '☀️맑음',
    refereeScore: r.referee_score,
  }));
}

export async function deleteDiaryLogRemote(deviceId, logId) {
  return safeCall('직관일지 삭제', () =>
    supabase.from('diary_logs').delete().eq('id', logId).eq('user_id', deviceId)
  );
}

export async function upsertExpense(deviceId, expense) {
  return safeCall('지출 저장', () =>
    supabase.from('expenses').upsert({
      id: expense.id,
      user_id: deviceId,
      match_id: expense.matchId || null,
      match_title: expense.matchTitle || '',
      expense_date: expense.date,
      category: expense.category,
      amount: expense.amount,
      memo: expense.memo || '',
      goods_id: expense.goodsId || null,
    })
  );
}

export async function listExpenses(userId) {
  const rows = await safeCall('지출 목록 조회', () =>
    supabase.from('expenses').select('*').eq('user_id', userId).order('expense_date', { ascending: false })
  );
  if (!rows) return null;
  return rows.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    matchTitle: r.match_title || '',
    date: r.expense_date,
    category: r.category,
    amount: r.amount,
    memo: r.memo || '',
    goodsId: r.goods_id || null,
  }));
}

export async function deleteExpenseRemote(deviceId, expenseId) {
  return safeCall('지출 삭제', () =>
    supabase.from('expenses').delete().eq('id', expenseId).eq('user_id', deviceId)
  );
}

export async function listGoods(userId) {
  return safeCall('굿즈 목록 조회', () =>
    supabase.from('goods').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  );
}

export async function upsertGoodsItem(userId, goods) {
  return safeCall('굿즈 저장', () =>
    supabase.from('goods').upsert({
      id: goods.id,
      user_id: userId,
      name: goods.name,
      category: goods.category || null,
      photo_url: goods.photoUrl || null,
    })
  );
}

export async function deleteGoodsItem(goodsId) {
  return safeCall('굿즈 삭제', () =>
    supabase.from('goods').delete().eq('id', goodsId)
  );
}

export async function listGoodsLogLinks(userId) {
  return safeCall('굿즈 착용 경기 조회', () =>
    supabase.from('goods_logs').select('goods_id, diary_log_id, goods!inner(user_id)').eq('goods.user_id', userId)
  );
}

export async function setGoodsLogLinks(goodsId, logIds) {
  return safeCall('굿즈 착용 경기 저장', async () => {
    const del = await supabase.from('goods_logs').delete().eq('goods_id', goodsId);
    if (del.error) return del;
    if (logIds.length === 0) return { data: [], error: null };
    const rows = logIds.map((logId) => ({ goods_id: goodsId, diary_log_id: logId }));
    return supabase.from('goods_logs').insert(rows);
  });
}

// 8-char friend code, skipping lookalike characters (0/O, 1/I/L) since users
// will read these aloud or retype them from a shared message.
function generateFriendCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Returns the user's friend code, generating and persisting one on first use.
// Retries a few times on the (unlikely) unique-constraint collision.
export async function ensureFriendCode(userId) {
  return safeCall('친구코드 확인', async () => {
    const existing = await supabase.from('profiles').select('friend_code').eq('id', userId).maybeSingle();
    if (existing.error) return existing;
    if (existing.data?.friend_code) return { data: existing.data.friend_code, error: null };

    for (let i = 0; i < 3; i++) {
      const code = generateFriendCode();
      const upd = await supabase.from('profiles').update({ friend_code: code }).eq('id', userId).select('friend_code').single();
      if (!upd.error) return { data: upd.data.friend_code, error: null };
    }
    return { data: null, error: { message: '친구코드 생성에 실패했습니다' } };
  });
}

export async function findProfileByFriendCode(code) {
  return safeCall('친구코드 검색', () =>
    supabase.from('profiles').select('id, nickname, my_team, avatar_url, friend_code').eq('friend_code', code).maybeSingle()
  );
}

// Request/accept model - one directional row (requester -> addressee) with
// a status, rather than two symmetric rows (see migration_friends.sql).
// If the addressee already sent US a pending request, accept that instead
// of creating a crossed pending pair.
export async function sendFriendRequest(requesterId, addresseeId) {
  return safeCall('친구 요청 보내기', async () => {
    const reverse = await supabase.from('friendships').select('status')
      .eq('requester_id', addresseeId).eq('addressee_id', requesterId).maybeSingle();
    if (reverse.error) return reverse;
    if (reverse.data) {
      if (reverse.data.status === 'pending') {
        return supabase.from('friendships')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('requester_id', addresseeId).eq('addressee_id', requesterId)
          .select();
      }
      return { data: reverse.data, error: null }; // already friends - no-op
    }
    return supabase.from('friendships')
      .upsert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
      .select();
  });
}

export async function acceptFriendRequest(requesterId, addresseeId) {
  return safeCall('친구 요청 수락', () =>
    supabase.from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('requester_id', requesterId).eq('addressee_id', addresseeId)
  );
}

export async function rejectFriendRequest(requesterId, addresseeId) {
  return safeCall('친구 요청 거절', () =>
    supabase.from('friendships').delete().eq('requester_id', requesterId).eq('addressee_id', addresseeId)
  );
}

// Requests sent TO me that I haven't responded to yet.
export async function listPendingRequests(userId) {
  return safeCall('받은 친구 요청 조회', () =>
    supabase.from('friendships')
      .select('requester_id, created_at, requester:profiles!friendships_requester_id_fkey(id, nickname, my_team, avatar_url, friend_code)')
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
  );
}

// Accepted relationships in either direction - the caller resolves which
// side (requester/addressee) is "the other person" per row.
export async function listFriends(userId) {
  return safeCall('친구 목록 조회', () =>
    supabase.from('friendships')
      .select(`
        requester_id, addressee_id, created_at,
        requester:profiles!friendships_requester_id_fkey(id, nickname, my_team, avatar_url, friend_code),
        addressee:profiles!friendships_addressee_id_fkey(id, nickname, my_team, avatar_url, friend_code)
      `)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
  );
}

// Raw rows (snake_case) for a friend's profile/feed view - the caller maps
// these into the camelCase shape utils/achievements.js and the feed cards use.
export async function listFriendDiaryLogs(friendId) {
  return safeCall('친구 직관일지 조회', () =>
    supabase.from('diary_logs')
      .select('id, home_team, away_team, home_score, away_score, match_date, stadium, rating, weather, companion, referee_score, photo_url, review')
      .eq('user_id', friendId)
      .order('match_date', { ascending: false })
  );
}

// Merged, newest-first feed across every friend at once - each row carries
// its author's profile so the combined feed can show whose match it is.
export async function listFriendsFeed(friendIds) {
  if (!friendIds || friendIds.length === 0) return [];
  return safeCall('친구 피드 조회', () =>
    supabase.from('diary_logs')
      .select(`
        id, user_id, home_team, away_team, home_score, away_score, match_date, stadium,
        rating, weather, companion, referee_score, photo_url, review,
        author:profiles!diary_logs_user_id_fkey(id, nickname, my_team, avatar_url)
      `)
      .in('user_id', friendIds)
      .order('match_date', { ascending: false })
      .limit(50)
  );
}

export async function removeFriend(userId, otherId) {
  return safeCall('친구 삭제', async () => {
    const d1 = await supabase.from('friendships').delete().eq('requester_id', userId).eq('addressee_id', otherId);
    if (d1.error) return d1;
    return supabase.from('friendships').delete().eq('requester_id', otherId).eq('addressee_id', userId);
  });
}

// Inverse of setGoodsLogLinks - keyed by diary_log_id instead of goods_id.
// Used from the diary write flow, where the user picks which goods items
// they wore for one specific match rather than which matches one goods item
// was worn to.
export async function setLogGoodsLinks(logId, goodsIds) {
  return safeCall('직관일지 굿즈 연결 저장', async () => {
    const del = await supabase.from('goods_logs').delete().eq('diary_log_id', logId);
    if (del.error) return del;
    if (goodsIds.length === 0) return { data: [], error: null };
    const rows = goodsIds.map((goodsId) => ({ goods_id: goodsId, diary_log_id: logId }));
    return supabase.from('goods_logs').insert(rows);
  });
}
