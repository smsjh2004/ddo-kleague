import React, { useState } from 'react';
import { Text, View, Image, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { calculateOutcome } from '../utils/achievements';
import { getRefereeStatus } from '../utils/refereeStatus';
import TeamBadge from '../components/TeamBadge';
import { Ionicons } from '@expo/vector-icons';

// Read-only detail view for a friend's diary log - same information as
// DiaryListScreen's own detail sheet, minus the edit/delete menu and the
// spending card (expenses are never fetched for other users' logs).
export default function FriendLogDetailScreen({ theme = 'light', log, author, onBack }) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';
  const [photoIndex, setPhotoIndex] = useState(0);

  const photoList = log.photos && log.photos.length > 0
    ? log.photos
    : (log.photo ? [log.photo] : []);
  const safeIndex = Math.min(photoIndex, Math.max(photoList.length - 1, 0));
  const outcome = calculateOutcome(log, author?.my_team);
  const isWin = outcome === '승';
  const isLose = outcome === '패';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? activeColors.brandRed : activeColors.brandNavy }]} numberOfLines={1}>
          {author ? `${author.nickname}님의 직관일지` : '직관일지 상세'}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {photoList.length > 0 && (
          <View style={[styles.photoCard, { borderColor: activeColors.borderColor }]}>
            <Image source={{ uri: photoList[safeIndex] }} style={styles.photoImage} />
            {photoList.length > 1 && (
              <>
                <TouchableOpacity
                  style={[styles.photoNavBtn, styles.photoNavBtnLeft]}
                  onPress={() => setPhotoIndex((prev) => (prev - 1 + photoList.length) % photoList.length)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={20} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoNavBtn, styles.photoNavBtnRight]}
                  onPress={() => setPhotoIndex((prev) => (prev + 1) % photoList.length)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-forward" size={20} color="#ffffff" />
                </TouchableOpacity>
                <View style={styles.photoDotsRow}>
                  {photoList.map((_, i) => (
                    <View key={i} style={[styles.photoDot, i === safeIndex && styles.photoDotActive]} />
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <View style={styles.summaryHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
              <Ionicons name="calendar-outline" size={13} color={activeColors.textMuted} />
              <Text style={[styles.metaText, { color: activeColors.textMuted }]}>{log.date}</Text>
              <Text style={{ color: activeColors.textMuted, fontSize: 11 }}>|</Text>
              <Ionicons name="location" size={13} color="#EE3224" />
              <Text style={[styles.metaText, { color: activeColors.textMuted }]} numberOfLines={1}>{log.stadium}</Text>
            </View>
            <View style={[
              styles.outcomeBadge,
              isWin ? { backgroundColor: '#10B981' } : isLose ? { backgroundColor: '#EE3224' } : { backgroundColor: '#64748B' }
            ]}>
              <Text style={styles.outcomeBadgeText}>
                {isWin ? '승리 (WIN)' : isLose ? '패배 (LOSE)' : '무승부 (DRAW)'}
              </Text>
            </View>
          </View>

          <View style={styles.scoreboardRow}>
            <View style={styles.teamCol}>
              <TeamBadge teamName={log.homeTeam} size={28} />
              <Text style={[styles.teamName, { color: activeColors.textBody }]}>{log.homeTeam}</Text>
            </View>
            <Text style={[styles.scoreText, { color: activeColors.brandNavy }]}>
              {log.homeScore} : {log.awayScore}
            </Text>
            <View style={styles.teamCol}>
              <TeamBadge teamName={log.awayTeam} size={28} />
              <Text style={[styles.teamName, { color: activeColors.textBody }]}>{log.awayTeam}</Text>
            </View>
          </View>

          <View style={[styles.metaRow, { borderTopColor: activeColors.borderColor }]}>
            <Text style={{ fontSize: 12, color: activeColors.textMuted, fontWeight: '700' }}>
              ⛅ 날씨: <Text style={{ color: activeColors.textBody }}>{log.weather || '☀️맑음'}</Text>
            </Text>
            <Text style={{ fontSize: 12, color: activeColors.textMuted, fontWeight: '700' }}>
              👥 동행인: <Text style={{ color: activeColors.textBody }}>{log.companion || '혼관'}</Text>
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <Text style={[styles.cardLabel, { color: activeColors.textMuted }]}>평점</Text>
          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < log.rating ? 'star' : 'star-outline'}
                size={24}
                color="#FBC02D"
                style={{ marginRight: 6 }}
              />
            ))}
          </View>
        </View>

        {log.refereeScore !== undefined && log.refereeScore !== null && (
          <View style={[styles.card, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
            <Text style={[styles.cardLabel, { color: activeColors.textMuted }]}>
              📢 심판 평가 ({log.refereeScore}점)
            </Text>
            {(() => {
              const { emoji, text: desc } = getRefereeStatus(log.refereeScore);
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: activeColors.textBody, flex: 1 }}>{desc}</Text>
                </View>
              );
            })()}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <Text style={[styles.cardLabel, { color: activeColors.brandNavy }]}>📝 직관 소감</Text>
          <Text style={[styles.thoughtsText, { color: activeColors.textBody }]}>
            {log.review || '기록된 소감이 없습니다.'}
          </Text>
        </View>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  photoCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
  },
  photoImage: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
  },
  photoNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoNavBtnLeft: { left: 8 },
  photoNavBtnRight: { right: 8 },
  photoDotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  photoDotActive: {
    backgroundColor: '#ffffff',
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  outcomeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  outcomeBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  scoreboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  teamCol: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  teamName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '950',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  thoughtsText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 6,
  },
});
