import React from 'react';
import { Text, View, ScrollView, TouchableOpacity, SafeAreaView, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { sectionLabelBase } from '../constants/sharedStyles';
import { getAchievements } from '../utils/achievements';
import { Ionicons } from '@expo/vector-icons';

export default function AchievementsScreen({ theme = 'light', logs = [], myTeam, goods = [], goodsLogLinks = [], onBack }) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';

  const achievements = getAchievements(logs, myTeam, goods, goodsLogLinks);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const progressPct = achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0;
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  const renderRow = (a) => (
    <View
      key={a.id}
      style={[styles.row, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}
    >
      <View style={[styles.emojiCircle, { backgroundColor: activeColors.bgTag }, !a.unlocked && styles.emojiCircleLocked]}>
        <Text style={styles.emoji}>{a.unlocked ? a.emoji : '🔒'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: a.unlocked ? activeColors.textBody : activeColors.textMuted }]}>
          {a.label}
        </Text>
        <Text style={[styles.rowDesc, { color: activeColors.textMuted }]}>{a.description}</Text>
      </View>
      {a.unlocked && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>업적</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={[styles.summaryCard, { backgroundColor: activeColors.brandNavy }]}>
          <Text style={styles.summaryLabel}>달성한 업적</Text>
          <Text style={styles.summaryValue}>{unlockedCount} / {achievements.length}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>

        {unlocked.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>달성 완료</Text>
            {unlocked.map(renderRow)}
          </>
        )}

        {locked.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: activeColors.textMuted, marginTop: unlocked.length > 0 ? 16 : 0 }]}>
              미달성
            </Text>
            {locked.map(renderRow)}
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
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#FBC02D',
  },
  sectionLabel: {
    ...sectionLabelBase,
    marginBottom: 8,
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCircleLocked: {
    opacity: 0.6,
  },
  emoji: {
    fontSize: 20,
  },
  rowLabel: {
    fontSize: 13.5,
    fontWeight: '900',
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
});
