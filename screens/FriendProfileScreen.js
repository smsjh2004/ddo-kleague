import React, { useState, useEffect } from 'react';
import { Text, View, Image, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { listFriendDiaryLogs } from '../utils/api';
import { getAchievementTitle, getAchievements, calculateOutcome } from '../utils/achievements';
import TeamBadge from '../components/TeamBadge';
import FriendLogDetailScreen from './FriendLogDetailScreen';
import { Ionicons } from '@expo/vector-icons';

const OUTCOME_COLORS = { 승: '#10B981', 무: '#64748B', 패: '#EE3224' };

// diary_logs comes back snake_case from Supabase - achievements.js expects
// the same camelCase shape the local logs array uses everywhere else.
function toCamelLog(row) {
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
  };
}

export default function FriendProfileScreen({ theme = 'light', friend, onBack, myLogs = [], myTeam }) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';

  const [logs, setLogs] = useState(null); // null while loading
  const [viewingLog, setViewingLog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listFriendDiaryLogs(friend.id).then((rows) => {
      if (cancelled) return;
      setLogs((rows || []).map(toCamelLog));
    });
    return () => { cancelled = true; };
  }, [friend.id]);

  const isLoading = logs === null;
  const safeLogs = logs || [];
  const title = getAchievementTitle(safeLogs, friend.my_team);
  const achievements = getAchievements(safeLogs, friend.my_team);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalMatches = safeLogs.length;
  const wins = safeLogs.filter((log) => calculateOutcome(log, friend.my_team) === '승').length;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  // "함께한 직관" - computed from MY OWN logs tagged with this friend as one
  // of possibly several companions (companionFriendIds), not the friend's logs above.
  const togetherLogs = (myLogs || []).filter((log) => Array.isArray(log.companionFriendIds) && log.companionFriendIds.includes(friend.id));
  const togetherTotal = togetherLogs.length;
  const togetherWins = togetherLogs.filter((log) => calculateOutcome(log, myTeam) === '승').length;
  const togetherDraws = togetherLogs.filter((log) => calculateOutcome(log, myTeam) === '무').length;
  const togetherLosses = togetherTotal - togetherWins - togetherDraws;

  if (viewingLog) {
    return (
      <FriendLogDetailScreen
        theme={theme}
        log={viewingLog}
        author={friend}
        onBack={() => setViewingLog(null)}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]} numberOfLines={1}>
          {friend.nickname}님의 프로필
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={[styles.headerCard, { backgroundColor: activeColors.brandNavy }]}>
          <View style={styles.avatarWrap}>
            {friend.avatar_url ? (
              <Image source={{ uri: friend.avatar_url }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={30} color="rgba(255,255,255,0.5)" />
              </View>
            )}
          </View>
          <Text style={styles.nicknameText} numberOfLines={1}>{friend.nickname}</Text>
          <Text style={styles.teamText} numberOfLines={1}>
            {friend.my_team ? `${friend.my_team} 팬` : '응원 구단 미등록'}
          </Text>
          <View style={styles.titlePill}>
            <Text style={styles.titlePillText} numberOfLines={1}>{title.emoji} {title.text}</Text>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" color={activeColors.brandNavy} style={{ marginTop: 20 }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
                <Text style={[styles.statValue, { color: activeColors.brandRed }]}>{winRate}%</Text>
                <Text style={[styles.statLabel, { color: activeColors.textMuted }]}>전체 직관 승률</Text>
                <Text style={[styles.statSub, { color: activeColors.textMuted }]}>{totalMatches}전 {wins}승</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
                <Text style={[styles.statValue, { color: activeColors.brandRed }]}>{unlockedCount} / {achievements.length}</Text>
                <Text style={[styles.statLabel, { color: activeColors.textMuted }]}>달성 업적</Text>
              </View>
            </View>

            {togetherTotal > 0 && (
              <View style={[styles.togetherCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
                <Text style={[styles.togetherLabel, { color: activeColors.textMuted }]}>
                  {friend.nickname}님과 함께한 직관 {togetherTotal}회
                </Text>
                <Text style={[styles.togetherRecord, { color: activeColors.textBody }]}>
                  {togetherWins}승 {togetherDraws}무 {togetherLosses}패
                </Text>
              </View>
            )}

            <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>
              직관 피드 ({totalMatches})
            </Text>
            {safeLogs.length === 0 ? (
              <View style={[styles.emptyBox, { borderColor: activeColors.borderColor }]}>
                <Ionicons name="football-outline" size={26} color={activeColors.textMuted} />
                <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>
                  아직 기록된 직관일지가 없어요.
                </Text>
              </View>
            ) : (
              safeLogs.map((log) => {
                const outcome = calculateOutcome(log, friend.my_team);
                return (
                  <TouchableOpacity
                    key={log.id}
                    style={[styles.feedCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}
                    onPress={() => setViewingLog(log)}
                    activeOpacity={0.85}
                  >
                    {log.photo && (
                      <Image source={{ uri: log.photo }} style={styles.feedImage} />
                    )}
                    <View style={styles.feedBody}>
                      <View style={styles.feedTopRow}>
                        <View style={styles.feedMatchupRow}>
                          <TeamBadge teamName={log.homeTeam} size={16} />
                          <Text style={[styles.feedMatchupText, { color: activeColors.textBody }]} numberOfLines={1}>
                            {log.homeTeam} {log.homeScore} : {log.awayScore} {log.awayTeam}
                          </Text>
                          <TeamBadge teamName={log.awayTeam} size={16} />
                        </View>
                        <View style={[styles.feedOutcomeBadge, { backgroundColor: `${OUTCOME_COLORS[outcome]}22` }]}>
                          <Text style={[styles.feedOutcomeText, { color: OUTCOME_COLORS[outcome] }]}>{outcome}</Text>
                        </View>
                      </View>
                      <Text style={[styles.feedMetaText, { color: activeColors.textMuted }]}>
                        {log.date} | {log.stadium}
                      </Text>
                      {log.review ? (
                        <Text style={[styles.feedReviewText, { color: activeColors.textBody }]} numberOfLines={3}>
                          {log.review}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>
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
    flex: 1,
    textAlign: 'center',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrap: {
    marginBottom: 12,
  },
  avatarImg: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nicknameText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  teamText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 12,
  },
  titlePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  titlePillText: {
    color: '#FBC02D',
    fontSize: 12,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '950',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  statSub: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 6,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 2,
  },
  togetherCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 10,
    alignItems: 'center',
  },
  togetherLabel: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  togetherRecord: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
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
  },
  feedCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  feedImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  feedBody: {
    padding: 12,
    gap: 4,
  },
  feedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  feedMatchupRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedMatchupText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '800',
  },
  feedOutcomeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  feedOutcomeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  feedMetaText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  feedReviewText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 4,
  },
});
