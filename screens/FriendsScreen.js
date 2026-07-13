import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants/Colors';
import { showAlert } from '../utils/appAlert';
import { calculateOutcome } from '../utils/achievements';
import {
  ensureFriendCode,
  findProfileByFriendCode,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  listPendingRequests,
  listFriends,
  listFriendsFeed,
  removeFriend,
} from '../utils/api';
import TeamBadge from '../components/TeamBadge';
import FriendProfileScreen from './FriendProfileScreen';
import FriendLogDetailScreen from './FriendLogDetailScreen';
import { Ionicons } from '@expo/vector-icons';

const OUTCOME_COLORS = { 승: '#10B981', 무: '#64748B', 패: '#EE3224' };

// diary_logs rows come back snake_case with a nested author profile from
// listFriendsFeed - camelCase them the same way FriendProfileScreen does,
// keeping the author attached for the "whose match is this" feed display.
function toCamelFeedLog(row) {
  return {
    id: row.id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeScore: row.home_score,
    awayScore: row.away_score,
    date: row.match_date,
    stadium: row.stadium,
    rating: row.rating,
    weather: row.weather,
    companion: row.companion,
    refereeScore: row.referee_score,
    review: row.review || '',
    photo: row.photo_url || null,
    photos: row.photo_url ? [row.photo_url] : [],
    author: row.author,
  };
}

export default function FriendsScreen({
  theme = 'light',
  onBack,
  userId,
  nickname,
  initialSearchCode,
  onConsumeSearchCode,
  myLogs,
  myTeam,
}) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';

  const [myCode, setMyCode] = useState('');
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState(null); // null | 'notfound' | profile row
  const [searching, setSearching] = useState(false);
  const [viewingFriend, setViewingFriend] = useState(null);
  const [activeTab, setActiveTab] = useState('list'); // list | feed
  const [feedLogs, setFeedLogs] = useState(null); // null while loading
  const [feedLoading, setFeedLoading] = useState(false);
  const [viewingFeedLog, setViewingFeedLog] = useState(null);
  const [feedPhotoIndex, setFeedPhotoIndex] = useState({}); // logId -> current slideshow index

  useEffect(() => {
    if (!userId) return;
    ensureFriendCode(userId).then((code) => {
      if (code) setMyCode(code);
    });
    refreshFriends();
    refreshPendingRequests();
  }, [userId]);

  useEffect(() => {
    if (activeTab !== 'feed') return;
    if (friends.length === 0) {
      setFeedLogs([]);
      return;
    }
    let cancelled = false;
    setFeedLoading(true);
    listFriendsFeed(friends.map((f) => f.id)).then((rows) => {
      if (cancelled) return;
      setFeedLogs((rows || []).map(toCamelFeedLog));
      setFeedLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, friends]);

  // Deep link (kleaguediary://friend/CODE) landed - prefill the input and
  // search right away so the receiver only has to press 추가.
  useEffect(() => {
    if (initialSearchCode) {
      setSearchCode(initialSearchCode);
      runSearch(initialSearchCode);
      if (onConsumeSearchCode) onConsumeSearchCode();
    }
  }, [initialSearchCode]);

  const refreshFriends = async () => {
    const rows = await listFriends(userId);
    if (rows) {
      // Each row is a friendship from either side - resolve "the other person".
      setFriends(rows.map((r) => (r.requester_id === userId ? r.addressee : r.requester)).filter(Boolean));
    }
  };

  const refreshPendingRequests = async () => {
    const rows = await listPendingRequests(userId);
    if (rows) {
      setPendingRequests(rows.map((r) => r.requester).filter(Boolean));
    }
  };

  const runSearch = async (rawCode) => {
    const code = (rawCode || '').trim().toUpperCase();
    if (!userId) {
      showAlert('로그인 필요', '친구 기능은 로그인 후 이용할 수 있어요.');
      return;
    }
    if (code.length < 4) {
      showAlert('알림', '친구코드를 입력해주세요.');
      return;
    }
    setSearching(true);
    setSearchResult(null);
    const profile = await findProfileByFriendCode(code);
    setSearching(false);
    if (!profile) {
      setSearchResult('notfound');
      return;
    }
    if (profile.id === userId) {
      showAlert('알림', '자기 자신은 친구로 추가할 수 없어요.');
      return;
    }
    setSearchResult(profile);
  };

  const handleSendRequest = async (profile) => {
    const result = await sendFriendRequest(userId, profile.id);
    if (result !== null) {
      showAlert('요청 완료', `${profile.nickname}님에게 친구 요청을 보냈어요. 상대가 수락하면 친구가 돼요!`);
      setSearchResult(null);
      setSearchCode('');
      refreshFriends();
    } else {
      showAlert('오류', '친구 요청에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleAcceptRequest = async (profile) => {
    await acceptFriendRequest(profile.id, userId);
    refreshPendingRequests();
    refreshFriends();
  };

  const handleRejectRequest = (profile) => {
    showAlert('친구 요청 거절', `${profile.nickname}님의 친구 요청을 거절할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '거절',
        style: 'destructive',
        onPress: async () => {
          await rejectFriendRequest(profile.id, userId);
          refreshPendingRequests();
        },
      },
    ]);
  };

  const confirmRemove = (profile) => {
    showAlert('친구 삭제', `${profile.nickname}님을 친구 목록에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await removeFriend(userId, profile.id);
          refreshFriends();
        },
      },
    ]);
  };

  const handleCopyCode = async () => {
    if (!myCode) {
      showAlert('로그인 필요', '친구 기능은 로그인 후 이용할 수 있어요.');
      return;
    }
    await Clipboard.setStringAsync(myCode);
    showAlert('복사 완료', '친구코드가 클립보드에 복사됐어요.');
  };

  if (viewingFriend) {
    return (
      <FriendProfileScreen
        theme={theme}
        friend={viewingFriend}
        onBack={() => setViewingFriend(null)}
        myLogs={myLogs}
        myTeam={myTeam}
      />
    );
  }

  if (viewingFeedLog) {
    return (
      <FriendLogDetailScreen
        theme={theme}
        log={viewingFeedLog}
        author={viewingFeedLog.author}
        onBack={() => setViewingFeedLog(null)}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>친구</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: activeColors.borderColor }]}>
        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => setActiveTab('list')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabBtnText,
            { color: activeTab === 'list' ? (isDark ? activeColors.brandRed : activeColors.brandNavy) : activeColors.textMuted }
          ]}>
            친구목록
          </Text>
          {activeTab === 'list' && <View style={[styles.tabUnderline, { backgroundColor: activeColors.brandRed }]} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => setActiveTab('feed')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabBtnText,
            { color: activeTab === 'feed' ? (isDark ? activeColors.brandRed : activeColors.brandNavy) : activeColors.textMuted }
          ]}>
            친구피드
          </Text>
          {activeTab === 'feed' && <View style={[styles.tabUnderline, { backgroundColor: activeColors.brandRed }]} />}
        </TouchableOpacity>
      </View>

      {activeTab === 'feed' ? (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {friends.length === 0 ? (
            <View style={[styles.emptyBox, { borderColor: activeColors.borderColor }]}>
              <Ionicons name="newspaper-outline" size={28} color={activeColors.textMuted} />
              <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>
                친구를 추가하면 친구들의 직관 피드를 볼 수 있어요.
              </Text>
            </View>
          ) : feedLoading || feedLogs === null ? (
            <ActivityIndicator size="small" color={activeColors.brandNavy} style={{ marginTop: 20 }} />
          ) : feedLogs.length === 0 ? (
            <View style={[styles.emptyBox, { borderColor: activeColors.borderColor }]}>
              <Ionicons name="football-outline" size={28} color={activeColors.textMuted} />
              <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>
                아직 친구들이 기록한 직관일지가 없어요.
              </Text>
            </View>
          ) : (
            feedLogs.map((log) => {
              const author = log.author || {};
              const outcome = calculateOutcome(log, author.my_team);
              const isWin = outcome === '승';
              const isLose = outcome === '패';
              const photoList = log.photos && log.photos.length > 0
                ? log.photos
                : (log.photo ? [log.photo] : []);
              const safeIndex = Math.min(feedPhotoIndex[log.id] || 0, Math.max(photoList.length - 1, 0));

              return (
                <TouchableOpacity
                  key={log.id}
                  style={[styles.feedCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}
                  onPress={() => setViewingFeedLog(log)}
                  activeOpacity={0.8}
                >
                  <View style={styles.feedAuthorRow}>
                    {author.avatar_url ? (
                      <Image source={{ uri: author.avatar_url }} style={styles.feedAuthorAvatar} />
                    ) : (
                      <View style={[styles.feedAuthorAvatar, styles.feedAuthorAvatarPlaceholder, { backgroundColor: activeColors.bgTag }]}>
                        <Ionicons name="person" size={13} color={activeColors.textMuted} />
                      </View>
                    )}
                    <Text style={[styles.feedAuthorName, { color: activeColors.textBody }]} numberOfLines={1}>
                      {author.nickname || '알 수 없음'}
                    </Text>
                  </View>

                  {/* Photo (square, Instagram-style) - same slideshow layout as DiaryListScreen's 피드모드 */}
                  <View style={styles.feedPhotoContainer}>
                    {photoList.length === 0 ? (
                      <View style={[styles.feedPhotoPlaceholder, { backgroundColor: isDark ? activeColors.brandRed : '#001C48' }]}>
                        <Ionicons name="football-outline" size={40} color="rgba(255,255,255,0.2)" />
                        <Text style={styles.feedPlaceholderText}>⚽ 직관의 순간</Text>
                      </View>
                    ) : (
                      <>
                        <Image source={{ uri: photoList[safeIndex] }} style={styles.feedImage} />
                        {photoList.length > 1 && (
                          <>
                            <TouchableOpacity
                              style={[styles.feedPhotoNavBtn, styles.feedPhotoNavBtnLeft]}
                              onPress={(e) => {
                                e.stopPropagation && e.stopPropagation();
                                setFeedPhotoIndex((prev) => ({
                                  ...prev,
                                  [log.id]: (safeIndex - 1 + photoList.length) % photoList.length,
                                }));
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="chevron-back" size={16} color="#ffffff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.feedPhotoNavBtn, styles.feedPhotoNavBtnRight]}
                              onPress={(e) => {
                                e.stopPropagation && e.stopPropagation();
                                setFeedPhotoIndex((prev) => ({
                                  ...prev,
                                  [log.id]: (safeIndex + 1) % photoList.length,
                                }));
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="chevron-forward" size={16} color="#ffffff" />
                            </TouchableOpacity>
                            <View style={styles.feedPhotoDotsRow}>
                              {photoList.map((_, i) => (
                                <View key={i} style={[styles.feedPhotoDot, i === safeIndex && styles.feedPhotoDotActive]} />
                              ))}
                            </View>
                          </>
                        )}
                      </>
                    )}
                  </View>

                  <View style={styles.feedBodyContainer}>
                    <View style={[
                      styles.feedOutcomeBadge,
                      isWin ? { backgroundColor: '#10B981' } : isLose ? { backgroundColor: '#EE3224' } : { backgroundColor: '#64748B' }
                    ]}>
                      <Text style={styles.feedOutcomeText}>
                        {isWin ? '승리' : isLose ? '패배' : '무승부'}
                      </Text>
                    </View>

                    <View style={styles.feedMatchupRow}>
                      <TeamBadge teamName={log.homeTeam} size={18} />
                      <Text style={[styles.feedMatchupText, { color: activeColors.textBody }]} numberOfLines={1}>
                        {log.homeTeam} {log.homeScore} VS {log.awayScore} {log.awayTeam}
                      </Text>
                      <TeamBadge teamName={log.awayTeam} size={18} />
                    </View>

                    <Text style={[styles.feedMetaText, { color: activeColors.textMuted }]}>
                      {log.date} | {log.stadium}
                    </Text>

                    <View style={[styles.feedThoughtsBox, { backgroundColor: activeColors.bgTag }]}>
                      <Text style={[styles.feedThoughtsText, { color: activeColors.textBody }]} numberOfLines={3}>
                        {log.review || '작성된 소감이 없습니다.'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      ) : (
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {!userId && (
          <View style={[styles.loginBanner, { backgroundColor: 'rgba(238, 50, 36, 0.08)', borderColor: 'rgba(238, 50, 36, 0.2)' }]}>
            <Ionicons name="information-circle-outline" size={14} color={activeColors.brandRed} />
            <Text style={[styles.loginBannerText, { color: activeColors.brandRed }]}>
              로그인하면 친구코드가 발급되고 친구를 추가할 수 있어요.
            </Text>
          </View>
        )}

        {/* 내 친구코드 */}
        <View style={[styles.myCodeCard, { backgroundColor: activeColors.brandNavy }]}>
          <Text style={styles.myCodeLabel}>내 친구코드</Text>
          <Text style={styles.myCodeValue} selectable={true}>
            {myCode || '--------'}
          </Text>
          <TouchableOpacity style={styles.shareBtn} onPress={handleCopyCode} activeOpacity={0.8}>
            <Ionicons name="copy-outline" size={15} color="#ffffff" />
            <Text style={styles.shareBtnText}>코드 복사하기</Text>
          </TouchableOpacity>
        </View>

        {/* 친구코드로 추가 */}
        <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>친구코드로 추가</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor, color: activeColors.textBody }]}
            placeholder="친구코드 입력 (예: AB12CD34)"
            placeholderTextColor={activeColors.textMuted}
            value={searchCode}
            onChangeText={(t) => setSearchCode(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={8}
          />
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: activeColors.brandNavy }]}
            onPress={() => runSearch(searchCode)}
            activeOpacity={0.8}
            disabled={searching}
          >
            <Text style={styles.searchBtnText}>{searching ? '검색 중' : '검색'}</Text>
          </TouchableOpacity>
        </View>

        {searchResult === 'notfound' && (
          <View style={[styles.notFoundBox, { borderColor: activeColors.borderColor }]}>
            <Text style={[styles.notFoundText, { color: activeColors.textMuted }]}>
              해당 친구코드를 가진 사용자를 찾을 수 없어요.
            </Text>
          </View>
        )}

        {searchResult && searchResult !== 'notfound' && (
          <View style={[styles.resultCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
            <TeamBadge teamName={searchResult.my_team} size={34} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.friendName, { color: activeColors.textBody }]}>{searchResult.nickname}</Text>
              <Text style={[styles.friendTeam, { color: activeColors.textMuted }]}>
                {searchResult.my_team || '응원 구단 미등록'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: activeColors.brandRed }]}
              onPress={() => handleSendRequest(searchResult)}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add" size={14} color="#ffffff" />
              <Text style={styles.addBtnText}>요청 보내기</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 받은 친구 요청 */}
        {pendingRequests.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: activeColors.textMuted, marginTop: 24 }]}>
              받은 친구 요청 ({pendingRequests.length})
            </Text>
            {pendingRequests.map((p) => (
              <View key={p.id} style={[styles.friendRow, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
                <TeamBadge teamName={p.my_team} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.friendName, { color: activeColors.textBody }]}>{p.nickname}</Text>
                  <Text style={[styles.friendTeam, { color: activeColors.textMuted }]}>
                    {p.my_team || '응원 구단 미등록'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleAcceptRequest(p)}
                  style={[styles.requestAcceptBtn, { backgroundColor: activeColors.brandRed }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRejectRequest(p)}
                  style={[styles.requestRejectBtn, { borderColor: activeColors.borderColor }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={16} color={activeColors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* 친구 목록 */}
        <Text style={[styles.sectionLabel, { color: activeColors.textMuted, marginTop: 24 }]}>
          내 친구 ({friends.length})
        </Text>
        {friends.length === 0 ? (
          <View style={[styles.emptyBox, { borderColor: activeColors.borderColor }]}>
            <Ionicons name="people-outline" size={28} color={activeColors.textMuted} />
            <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>
              아직 추가한 친구가 없어요.{'\n'}친구코드를 공유하고 직관 메이트를 모아보세요!
            </Text>
          </View>
        ) : (
          friends.map((f) => (
            <View key={f.id} style={[styles.friendRow, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
              <TouchableOpacity
                style={styles.friendRowInfo}
                onPress={() => setViewingFriend(f)}
                activeOpacity={0.7}
              >
                <TeamBadge teamName={f.my_team} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.friendName, { color: activeColors.textBody }]}>{f.nickname}</Text>
                  <Text style={[styles.friendTeam, { color: activeColors.textMuted }]}>
                    {f.my_team || '응원 구단 미등록'}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmRemove(f)} style={styles.removeBtn} activeOpacity={0.7}>
                <Ionicons name="person-remove-outline" size={17} color={activeColors.textMuted} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
  },
  tabBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 24,
    right: 24,
    height: 2,
    borderRadius: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loginBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
  },
  loginBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
  },
  myCodeCard: {
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  myCodeLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
  myCodeValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '950',
    letterSpacing: 4,
    marginTop: 6,
    marginBottom: 14,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  shareBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    marginBottom: 10,
    marginLeft: 2,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 46,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: '700',
  },
  searchBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  notFoundBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  notFoundText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  friendName: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  friendTeam: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  friendRowInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  removeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestAcceptBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestRejectBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  feedCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  feedAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedAuthorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  feedAuthorAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedAuthorName: {
    fontSize: 12.5,
    fontWeight: '800',
    flex: 1,
  },
  feedPhotoContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  feedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  feedPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  feedPlaceholderText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '850',
  },
  feedPhotoNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedPhotoNavBtnLeft: {
    left: 8,
  },
  feedPhotoNavBtnRight: {
    right: 8,
  },
  feedPhotoDotsRow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  feedPhotoDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  feedPhotoDotActive: {
    backgroundColor: '#ffffff',
    width: 14,
  },
  feedBodyContainer: {
    padding: 16,
  },
  feedOutcomeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  feedOutcomeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
  },
  feedMatchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    marginVertical: 4,
  },
  feedMatchupText: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  feedMetaText: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
  },
  feedThoughtsBox: {
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  feedThoughtsText: {
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 16,
  },
});
