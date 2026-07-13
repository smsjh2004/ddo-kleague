import React from 'react';
import { Text, View, Image, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { calculateOutcome } from '../utils/achievements';
import { showAlert } from '../utils/appAlert';
import { Ionicons } from '@expo/vector-icons';

const CATEGORY_LABELS = {
  jersey: { label: '유니폼', emoji: '👕' },
  muffler: { label: '머플러', emoji: '🧣' },
  etc: { label: '기타', emoji: '🎽' },
};

const OUTCOME_COLORS = { 승: '#10B981', 무: '#94A3B8', 패: '#EE3224' };

export default function GoodsDetailScreen({
  theme = 'light',
  goodsItem,
  logs = [],
  myTeam,
  goodsLogLinks = [],
  onBack,
  onEdit,
  onDelete,
}) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';

  const linkedLogIds = goodsLogLinks.filter((l) => l.goods_id === goodsItem.id).map((l) => l.diary_log_id);
  const linkedLogs = logs.filter((l) => linkedLogIds.includes(l.id));
  const wins = linkedLogs.filter((l) => calculateOutcome(l, myTeam) === '승').length;
  const draws = linkedLogs.filter((l) => calculateOutcome(l, myTeam) === '무').length;
  const losses = linkedLogs.length - wins - draws;
  const winRate = linkedLogs.length > 0 ? Math.round((wins / linkedLogs.length) * 100) : null;
  const category = CATEGORY_LABELS[goodsItem.category] || CATEGORY_LABELS.etc;

  const confirmDelete = () => {
    showAlert('굿즈 삭제', '이 굿즈를 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => onDelete(goodsItem.id) },
    ]);
  };

  const openMoreMenu = () => {
    showAlert('굿즈 관리', null, [
      { text: '취소', style: 'cancel' },
      { text: '수정', onPress: onEdit },
      { text: '삭제', style: 'destructive', onPress: confirmDelete },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]} numberOfLines={1}>
          굿즈 상세
        </Text>
        <TouchableOpacity onPress={openMoreMenu} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={20} color={activeColors.textBody} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {goodsItem.photo_url ? (
          <Image source={{ uri: goodsItem.photo_url }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder, { backgroundColor: activeColors.bgTag }]}>
            <Ionicons name="shirt-outline" size={40} color={activeColors.textMuted} />
          </View>
        )}

        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: activeColors.textBody }]}>{goodsItem.name}</Text>
          <View style={[styles.categoryChip, { backgroundColor: activeColors.bgTag }]}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: activeColors.textBody }}>
              {category.emoji} {category.label}
            </Text>
          </View>
        </View>

        <View style={[styles.statsCard, { backgroundColor: activeColors.brandNavy }]}>
          {winRate !== null ? (
            <>
              <Text style={styles.winRateValue}>{winRate}%</Text>
              <Text style={styles.winRateLabel}>착용 승률</Text>
              <View style={styles.statsSubRow}>
                <Text style={styles.statsSubText}>{linkedLogs.length}전 {wins}승 {draws}무 {losses}패</Text>
              </View>
            </>
          ) : (
            <Text style={styles.noStatsText}>전투복 개시 전! 입고 직관을 다녀오면 승률을 알려드릴게요.</Text>
          )}
        </View>

        <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>
          착용하고 관람한 경기 ({linkedLogs.length})
        </Text>
        {linkedLogs.length === 0 ? (
          <View style={[styles.emptyBox, { borderColor: activeColors.borderColor }]}>
            <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>연결된 직관일지가 없습니다.</Text>
          </View>
        ) : (
          linkedLogs.map((log) => {
            const outcome = calculateOutcome(log, myTeam);
            return (
              <View key={log.id} style={[styles.logRow, { borderColor: activeColors.borderColor, backgroundColor: activeColors.bgCard }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logDate, { color: activeColors.textMuted }]}>{log.date}</Text>
                  <Text style={[styles.logMatch, { color: activeColors.textBody }]} numberOfLines={1}>
                    {log.homeTeam} {log.homeScore}:{log.awayScore} {log.awayTeam}
                  </Text>
                </View>
                <View style={[styles.outcomeBadge, { backgroundColor: `${OUTCOME_COLORS[outcome]}22` }]}>
                  <Text style={[styles.outcomeText, { color: OUTCOME_COLORS[outcome] }]}>{outcome}</Text>
                </View>
              </View>
            );
          })
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
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    marginBottom: 16,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: '950',
    flex: 1,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statsCard: {
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  winRateValue: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '950',
  },
  winRateLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  statsSubRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 10,
  },
  statsSubText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  noStatsText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12.5,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    marginBottom: 10,
    marginLeft: 2,
  },
  emptyBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  logDate: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  logMatch: {
    fontSize: 13,
    fontWeight: '800',
  },
  outcomeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeText: {
    fontSize: 13,
    fontWeight: '900',
  },
});
