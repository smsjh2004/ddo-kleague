import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { storage } from '../utils/storage';
import { getTodayString } from '../utils/date';
import { showAlert } from '../utils/appAlert';
import { getBingoGrid, getStampedStadiumKeys, countCompletedBingoLines } from '../constants/stadiumBingo';
import { Ionicons } from '@expo/vector-icons';

const HISTORY_KEY = 'kleague_bingo_history';
const ROUND_KEYS = { k1: 'kleague_bingo_round_k1', k2: 'kleague_bingo_round_k2' };
const DIVISION_LABELS = { k1: 'K리그 1', k2: 'K리그 2' };

export default function BingoScreen({ theme = 'light', logs = [], myTeam, onBack }) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';
  const [division, setDivision] = useState('k1');
  const [roundK1, setRoundK1] = useState(0);
  const [roundK2, setRoundK2] = useState(0);
  const [history, setHistory] = useState([]);
  const [historyVisible, setHistoryVisible] = useState(false);

  useEffect(() => {
    storage.getItem(ROUND_KEYS.k1, 0).then((v) => setRoundK1(v || 0));
    storage.getItem(ROUND_KEYS.k2, 0).then((v) => setRoundK2(v || 0));
    storage.getItem(HISTORY_KEY, []).then((h) => setHistory(Array.isArray(h) ? h : []));
  }, []);

  const round = division === 'k1' ? roundK1 : roundK2;
  const grid = getBingoGrid(division, myTeam, round);
  const stampedKeys = getStampedStadiumKeys(logs, grid);
  const lineCount = countCompletedBingoLines(stampedKeys, grid);
  const isComplete = grid.length > 0 && stampedKeys.size === grid.length;
  const cellWidthPct = division === 'k1' ? '31.5%' : '23.5%';

  // Once every cell on the current board is stamped, archive it into history
  // and roll the board over to the next set of clubs (see getBingoGrid's
  // round-based rotation) - re-runs safely if the very next board also
  // happens to already be fully stamped, cascading forward until it isn't.
  useEffect(() => {
    if (!isComplete) return;
    const alreadyArchived = history.some((h) => h.division === division && h.round === round);
    if (alreadyArchived) return;

    const entry = {
      id: `${division}-${round}-${Date.now()}`,
      division,
      round,
      completedAt: getTodayString(),
      teams: grid.map((g) => `${g.label} ${g.teamName}`),
    };
    const nextHistory = [entry, ...history];
    setHistory(nextHistory);
    storage.setItem(HISTORY_KEY, nextHistory);

    const nextRound = round + 1;
    storage.setItem(ROUND_KEYS[division], nextRound);
    if (division === 'k1') setRoundK1(nextRound);
    else setRoundK2(nextRound);
  }, [isComplete, division, round]);

  const divisionHistory = history.filter((h) => h.division === division);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>원정 구단 도장깨기</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={[styles.hint, { color: activeColors.textMuted }]}>
          직관일지에 기록된 경기장을 기준으로 스탬프가 자동으로 찍혀요! 다 채우면 새로운 빙고판이 시작돼요.
        </Text>

        <View style={[styles.toggleContainer, { backgroundColor: activeColors.bgTag, borderColor: activeColors.borderColor }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, division === 'k1' && { backgroundColor: activeColors.bgCard }]}
            onPress={() => setDivision('k1')}
          >
            <Text style={[styles.toggleBtnText, { color: division === 'k1' ? (isDark ? '#ffffff' : activeColors.brandNavy) : activeColors.textMuted }]}>
              K리그 1
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, division === 'k2' && { backgroundColor: activeColors.bgCard }]}
            onPress={() => setDivision('k2')}
          >
            <Text style={[styles.toggleBtnText, { color: division === 'k2' ? (isDark ? '#ffffff' : activeColors.brandNavy) : activeColors.textMuted }]}>
              K리그 2
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <Text style={[styles.summaryText, { color: activeColors.textBody }]}>
            {stampedKeys.size} / {grid.length} 스탬프 {round > 0 ? `· ${round + 1}번째 판` : ''}
          </Text>
          {lineCount > 0 && (
            <View style={styles.bingoCountBadge}>
              <Text style={styles.bingoCountText}>{lineCount}빙고 완성!</Text>
            </View>
          )}
        </View>

        <View style={styles.bingoGrid}>
          {grid.map((s) => {
            const stamped = stampedKeys.has(s.key);
            return (
              <View
                key={s.key}
                style={[
                  styles.bingoCell,
                  { width: cellWidthPct, borderColor: activeColors.borderColor, backgroundColor: activeColors.bgTag },
                  stamped && { backgroundColor: 'rgba(238, 50, 36, 0.08)', borderColor: activeColors.brandRed },
                ]}
              >
                <Text style={[styles.bingoCellLabel, { color: stamped ? activeColors.brandRed : activeColors.textBody }]} numberOfLines={1}>
                  {s.label}
                </Text>
                <Text style={[styles.bingoCellTeam, { color: stamped ? activeColors.brandRed : activeColors.textMuted }]} numberOfLines={1}>
                  {s.teamName}
                </Text>
                {stamped && <View style={[styles.bingoDot, { backgroundColor: activeColors.brandRed }]} />}
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.historyToggle, { borderColor: activeColors.borderColor }]}
          onPress={() => setHistoryVisible(!historyVisible)}
          activeOpacity={0.7}
        >
          <Ionicons name="trophy-outline" size={16} color={activeColors.textBody} />
          <Text style={[styles.historyToggleText, { color: activeColors.textBody }]}>
            완성한 빙고판 ({divisionHistory.length})
          </Text>
          <Ionicons name={historyVisible ? 'chevron-up' : 'chevron-down'} size={16} color={activeColors.textMuted} />
        </TouchableOpacity>

        {historyVisible && (
          divisionHistory.length === 0 ? (
            <Text style={[styles.historyEmptyText, { color: activeColors.textMuted }]}>
              아직 완성한 빙고판이 없어요.
            </Text>
          ) : (
            divisionHistory.map((h) => (
              <TouchableOpacity
                key={h.id}
                style={[styles.historyRow, { borderColor: activeColors.borderColor, backgroundColor: activeColors.bgCard }]}
                onPress={() => showAlert(`${DIVISION_LABELS[h.division]} 빙고판`, h.teams.join(', '))}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[styles.historyRowText, { color: activeColors.textBody }]}>
                  {h.completedAt} 완성
                </Text>
                <Ionicons name="chevron-forward" size={14} color={activeColors.textMuted} />
              </TouchableOpacity>
            ))
          )
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
  hint: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  bingoCountBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  bingoCountText: {
    color: '#10B981',
    fontSize: 10.5,
    fontWeight: '900',
  },
  bingoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bingoCell: {
    aspectRatio: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 2,
    paddingHorizontal: 4,
  },
  bingoCellLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  bingoCellTeam: {
    fontSize: 7.5,
    fontWeight: '700',
  },
  bingoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  historyToggleText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  historyEmptyText: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  historyRowText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
  },
});
