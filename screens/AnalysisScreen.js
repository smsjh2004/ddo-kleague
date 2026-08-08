import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Dimensions,
  Modal,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import TeamBadge from '../components/TeamBadge';
import { LEAGUE_TEAMS } from '../constants/TeamData';
import { getTodayString } from '../utils/date';
import { storage } from '../utils/storage';
import { calculateOutcome } from '../utils/achievements';
import useSwipeDismissModal from '../hooks/useSwipeDismissModal';
import useDragReorder from '../hooks/useDragReorder';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const CONFIG_ROW_HEIGHT = 56;

const DEFAULT_CARD_ORDER = ['overall', 'form', 'monthly', 'opponent', 'stadium', 'companion', 'weather', 'referee'];
const CARD_ORDER_KEY = 'kleague_analysis_card_order';
const HIDDEN_CARDS_KEY = 'kleague_analysis_hidden_cards';
const STATS_FILTER_KEY = 'kleague_analysis_stats_filter';

const CARD_LABELS = {
  overall: '전체 직관 승률',
  form: '최근 경기 흐름',
  monthly: '월별 직관 횟수',
  opponent: '상대 구단별 전적',
  stadium: '경기장별 승률',
  companion: '직관 메이트 상성',
  weather: '기상청 대시보드',
  referee: '심판 판정 대시보드',
};

export default function AnalysisScreen({ theme = 'light', logs = [], myTeam }) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';
  const segmentActiveColor = isDark ? activeColors.brandRed : activeColors.brandNavy;

  const [opponentModalVisible, setOpponentModalVisible] = useState(false);
  const [companionModalVisible, setCompanionModalVisible] = useState(false);
  const [stadiumModalVisible, setStadiumModalVisible] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    opponent: true,
    stadium: true,
    companion: true,
    weather: true,
    referee: true,
  });
  const toggleSection = (key) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // "통계 구성" - lets the user reorder the stat cards and hide the ones they don't care about
  const [cardOrder, setCardOrder] = useState(DEFAULT_CARD_ORDER);
  const [hiddenCards, setHiddenCards] = useState([]);
  const [configVisible, setConfigVisible] = useState(false);

  // Filter toggle - 'all' shows every attended match, 'my' narrows every stat
  // card down to matches where myTeam actually played (attended-but-neutral
  // matches otherwise dilute a fan's own team stats).
  const [statsFilter, setStatsFilter] = useState('all'); // 'all' | 'my'

  useEffect(() => {
    storage.getItem(CARD_ORDER_KEY, DEFAULT_CARD_ORDER).then((saved) => {
      const isValid = Array.isArray(saved) &&
        saved.length === DEFAULT_CARD_ORDER.length &&
        DEFAULT_CARD_ORDER.every((k) => saved.includes(k));
      setCardOrder(isValid ? saved : DEFAULT_CARD_ORDER);
    });
    storage.getItem(HIDDEN_CARDS_KEY, []).then((saved) => {
      setHiddenCards(Array.isArray(saved) ? saved : []);
    });
    storage.getItem(STATS_FILTER_KEY, 'all').then((saved) => {
      setStatsFilter(saved === 'my' ? 'my' : 'all');
    });
  }, []);

  const setStatsFilterMode = (mode) => {
    setStatsFilter(mode);
    storage.setItem(STATS_FILTER_KEY, mode);
  };

  const cleanMyTeamForFilter = (myTeam || '').trim();
  // Toggle is only meaningful once a log exists for a match myTeam wasn't in -
  // otherwise "마이팀"/"전체" show identical data, so hide the control entirely.
  const hasNeutralMatch = cleanMyTeamForFilter && logs.some(
    (log) => log.homeTeam.trim() !== cleanMyTeamForFilter && log.awayTeam.trim() !== cleanMyTeamForFilter
  );
  const filteredLogs = statsFilter === 'my' && cleanMyTeamForFilter
    ? logs.filter((log) => log.homeTeam.trim() === cleanMyTeamForFilter || log.awayTeam.trim() === cleanMyTeamForFilter)
    : logs;

  const moveCard = (key, direction) => {
    const index = cardOrder.indexOf(key);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= cardOrder.length) return;
    const next = [...cardOrder];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setCardOrder(next);
    storage.setItem(CARD_ORDER_KEY, next);
  };

  const toggleCardHidden = (key) => {
    const next = hiddenCards.includes(key)
      ? hiddenCards.filter((k) => k !== key)
      : [...hiddenCards, key];
    setHiddenCards(next);
    storage.setItem(HIDDEN_CARDS_KEY, next);
  };

  // Drag-to-reorder for the "통계 구성" list, via the "⋮" handle on each row.
  const { dragKey, dragY, getDragResponder } = useDragReorder(
    cardOrder, setCardOrder, CONFIG_ROW_HEIGHT, CARD_ORDER_KEY
  );

  const { translateY: opponentTranslateY, panResponder: opponentPanResponder } =
    useSwipeDismissModal(() => setOpponentModalVisible(false));

  const { translateY: companionTranslateY, panResponder: companionPanResponder } =
    useSwipeDismissModal(() => setCompanionModalVisible(false));

  const { translateY: stadiumTranslateY, panResponder: stadiumPanResponder } =
    useSwipeDismissModal(() => setStadiumModalVisible(false));

  // All match-outcome-derived stats below are recomputed from filteredLogs via
  // 7+ separate passes - memoized so dragging a card handle (which only
  // changes cardOrder state) doesn't re-run every pass on every frame.
  const derivedStats = useMemo(() => {
    // 1. Overall Stats calculations
    const totalMatches = filteredLogs.length;
    let wins = 0;
    let draws = 0;
    let losses = 0;

    filteredLogs.forEach((log) => {
      const outcome = calculateOutcome(log, myTeam);
      if (outcome === '승') wins++;
      else if (outcome === '무') draws++;
      else if (outcome === '패') losses++;
    });

    const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0';

    // Home vs Away Stats
    let homeMatches = 0, homeWins = 0, homeDraws = 0, homeLosses = 0;
    let awayMatches = 0, awayWins = 0, awayDraws = 0, awayLosses = 0;

    filteredLogs.forEach((log) => {
      const outcome = calculateOutcome(log, myTeam);
      const isHome = log.homeTeam.trim() === myTeam.trim();
      if (isHome) {
        homeMatches++;
        if (outcome === '승') homeWins++;
        else if (outcome === '무') homeDraws++;
        else if (outcome === '패') homeLosses++;
      } else {
        awayMatches++;
        if (outcome === '승') awayWins++;
        else if (outcome === '무') awayDraws++;
        else if (outcome === '패') awayLosses++;
      }
    });

    const homeWinRate = homeMatches > 0 ? ((homeWins / homeMatches) * 100).toFixed(1) : '0.0';
    const awayWinRate = awayMatches > 0 ? ((awayWins / awayMatches) * 100).toFixed(1) : '0.0';

    // 2. Recent 10 Matches (Form Guide)
    const recentLogs = [...filteredLogs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10).reverse();

    // 3. Monthly Attendances Chart data
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0 }));
    filteredLogs.forEach((log) => {
      if (log.date) {
        const m = parseInt(log.date.split('-')[1]);
        if (m >= 1 && m <= 12) {
          monthlyData[m - 1].count++;
        }
      }
    });

    const maxMonthlyCount = Math.max(...monthlyData.map((d) => d.count), 1);

    // 4. Opponent Leaderboard
    const opponentMap = {};
    filteredLogs.forEach((log) => {
      const opponent = log.homeTeam.trim() === myTeam.trim() ? log.awayTeam.trim() : log.homeTeam.trim();
      if (!opponentMap[opponent]) {
        opponentMap[opponent] = { wins: 0, draws: 0, losses: 0, total: 0 };
      }
      const outcome = calculateOutcome(log, myTeam);
      opponentMap[opponent].total++;
      if (outcome === '승') opponentMap[opponent].wins++;
      else if (outcome === '무') opponentMap[opponent].draws++;
      else if (outcome === '패') opponentMap[opponent].losses++;
    });

    const leaderboard = Object.keys(opponentMap).map((name) => {
      const stats = opponentMap[name];
      const wr = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
      return { name, ...stats, winRate: wr };
    });

    leaderboard.sort((a, b) => b.winRate - a.winRate || b.total - a.total);

    // 5. Stadium win-rate leaderboard
    const stadiumMap = {};
    filteredLogs.forEach((log) => {
      const stadiumName = (log.stadium || '경기장 미상').trim() || '경기장 미상';
      if (!stadiumMap[stadiumName]) {
        stadiumMap[stadiumName] = { wins: 0, draws: 0, losses: 0, total: 0 };
      }
      const outcome = calculateOutcome(log, myTeam);
      stadiumMap[stadiumName].total++;
      if (outcome === '승') stadiumMap[stadiumName].wins++;
      else if (outcome === '무') stadiumMap[stadiumName].draws++;
      else if (outcome === '패') stadiumMap[stadiumName].losses++;
    });

    const stadiumStatsList = Object.keys(stadiumMap).map((name) => {
      const stats = stadiumMap[name];
      const wr = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
      return { name, ...stats, winRate: wr };
    }).sort((a, b) => b.winRate - a.winRate || b.total - a.total);

    // 6. Companion analysis
    const companionMap = {};
    filteredLogs.forEach((log) => {
      const companionName = (log.companion || '혼관').trim() || '혼관';
      if (!companionMap[companionName]) {
        companionMap[companionName] = { wins: 0, draws: 0, losses: 0, total: 0 };
      }
      const outcome = calculateOutcome(log, myTeam);
      companionMap[companionName].total++;
      if (outcome === '승') companionMap[companionName].wins++;
      else if (outcome === '무') companionMap[companionName].draws++;
      else if (outcome === '패') companionMap[companionName].losses++;
    });

    const companionStatsList = Object.keys(companionMap).map((name) => {
      const stats = companionMap[name];
      const wr = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
      return { name, ...stats, winRate: wr };
    }).sort((a, b) => b.winRate - a.winRate || b.total - a.total);

    const candidates = companionStatsList.filter(c => c.total >= 1);
    let defeatTotem = null;
    if (candidates.length > 0) {
      defeatTotem = [...candidates].sort((a, b) => a.winRate - b.winRate || b.total - a.total)[0];
    }

    // 7. Weather analysis
    const weatherMap = {
      '☀️맑음': { wins: 0, draws: 0, losses: 0, total: 0 },
      '☁️흐림': { wins: 0, draws: 0, losses: 0, total: 0 },
      '🌧️비': { wins: 0, draws: 0, losses: 0, total: 0 },
      '❄️눈': { wins: 0, draws: 0, losses: 0, total: 0 },
    };

    filteredLogs.forEach((log) => {
      const w = log.weather || '☀️맑음';
      if (!weatherMap[w]) {
        weatherMap[w] = { wins: 0, draws: 0, losses: 0, total: 0 };
      }
      const outcome = calculateOutcome(log, myTeam);
      weatherMap[w].total++;
      if (outcome === '승') weatherMap[w].wins++;
      else if (outcome === '무') weatherMap[w].draws++;
      else if (outcome === '패') weatherMap[w].losses++;
    });

    const weatherStatsList = Object.keys(weatherMap).map((wName) => {
      const stats = weatherMap[wName];
      const wr = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
      return { name: wName, ...stats, winRate: wr };
    });

    const weatherCandidates = weatherStatsList.filter(w => w.total >= 1);
    let bestWeather = null;
    if (weatherCandidates.length > 0) {
      bestWeather = [...weatherCandidates].sort((a, b) => b.winRate - a.winRate || b.total - a.total)[0];
    }

    return {
      totalMatches, wins, draws, losses, winRate,
      homeMatches, homeWins, homeDraws, homeLosses, awayMatches, awayWins, awayDraws, awayLosses,
      homeWinRate, awayWinRate, recentLogs, monthlyData, maxMonthlyCount,
      leaderboard, stadiumStatsList, companionStatsList, defeatTotem,
      weatherStatsList, bestWeather,
    };
  }, [filteredLogs, myTeam]);

  const {
    totalMatches, wins, draws, losses, winRate,
    homeMatches, homeWins, homeDraws, homeLosses, awayMatches, awayWins, awayDraws, awayLosses,
    homeWinRate, awayWinRate, recentLogs, monthlyData, maxMonthlyCount,
    leaderboard, stadiumStatsList, companionStatsList, defeatTotem,
    weatherStatsList, bestWeather,
  } = derivedStats;

  const currentMonthNum = parseInt(getTodayString().split('-')[1]);

  // Circular progress calculations (clockwise from 12 o'clock)
  const wrNum = parseFloat(winRate);
  const rightAngle = wrNum <= 50 ? (wrNum * 3.6) - 180 : 0;
  const leftAngle = wrNum > 50 ? ((wrNum - 50) * 3.6) - 180 : -180;
  const winColor = isDark ? activeColors.brandRed : activeColors.brandNavy;
  const baseColor = activeColors.bgTag;

  const renderConfigControls = (key) => (
    <View style={styles.reorderControls}>
      <TouchableOpacity
        onPress={() => moveCard(key, 'up')}
        disabled={cardOrder.indexOf(key) === 0}
        style={styles.moveBtn}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="chevron-up" size={16} color={cardOrder.indexOf(key) === 0 ? activeColors.borderColor : activeColors.textBody} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => moveCard(key, 'down')}
        disabled={cardOrder.indexOf(key) === cardOrder.length - 1}
        style={styles.moveBtn}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="chevron-down" size={16} color={cardOrder.indexOf(key) === cardOrder.length - 1 ? activeColors.borderColor : activeColors.textBody} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => toggleCardHidden(key)}
        style={styles.moveBtn}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons
          name={hiddenCards.includes(key) ? 'eye-off-outline' : 'eye-outline'}
          size={16}
          color={hiddenCards.includes(key) ? activeColors.brandRed : activeColors.textBody}
        />
      </TouchableOpacity>
    </View>
  );

  const renderOverallCard = () => (
    <View key="overall" style={[styles.statsCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
      <Text style={[styles.cardTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>전체 직관 승률</Text>
      <View style={styles.donutArea}>
        <View style={{ width: 140, height: 140, justifyContent: 'center', alignItems: 'center' }}>
          {/* Base grey background circle */}
          <View style={{
            position: 'absolute',
            width: 140,
            height: 140,
            borderRadius: 70,
            borderWidth: 12,
            borderColor: baseColor,
          }} />

          {/* Right half progress (0% - 50%) */}
          <View style={{
            position: 'absolute',
            width: 140,
            height: 140,
            left: 0,
            top: 0,
            overflow: 'hidden',
          }}>
            <View style={{
              position: 'absolute',
              width: 70,
              height: 140,
              left: 70,
              overflow: 'hidden',
            }}>
              <View style={{
                position: 'absolute',
                width: 140,
                height: 140,
                left: -70,
                transform: [{ rotate: `${rightAngle}deg` }],
              }}>
                <View style={{
                  position: 'absolute',
                  width: 70,
                  height: 140,
                  left: 70,
                  overflow: 'hidden',
                }}>
                  <View style={{
                    position: 'absolute',
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    borderWidth: 12,
                    borderColor: winColor,
                    left: -70,
                  }} />
                </View>
              </View>
            </View>
          </View>

          {/* Left half progress (50% - 100%) */}
          <View style={{
            position: 'absolute',
            width: 140,
            height: 140,
            left: 0,
            top: 0,
            overflow: 'hidden',
          }}>
            <View style={{
              position: 'absolute',
              width: 70,
              height: 140,
              left: 0,
              overflow: 'hidden',
            }}>
              <View style={{
                position: 'absolute',
                width: 140,
                height: 140,
                left: 0,
                transform: [{ rotate: `${leftAngle}deg` }],
              }}>
                <View style={{
                  position: 'absolute',
                  width: 70,
                  height: 140,
                  left: 0,
                  overflow: 'hidden',
                }}>
                  <View style={{
                    position: 'absolute',
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    borderWidth: 12,
                    borderColor: winColor,
                    left: 0,
                  }} />
                </View>
              </View>
            </View>
          </View>

          {/* Inner Hole for Content */}
          <View
            style={[
              styles.innerCircle,
              {
                backgroundColor: activeColors.bgCard,
                position: 'absolute',
                zIndex: 10,
              }
            ]}
          >
            <Text style={[styles.winRatePercentText, { color: isDark ? activeColors.brandRed : activeColors.brandNavy }]}>
              {winRate}%
            </Text>
            <Text style={[styles.winRateLabel, { color: activeColors.textMuted }]}>
              전체 승률
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.statsSummaryRow, { borderTopColor: activeColors.dividerColor }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: activeColors.textMuted }]}>전체 전적</Text>
          <Text style={[styles.summaryVal, { color: activeColors.textBody }]}>
            {totalMatches}전 {wins}승 {draws}무 {losses}패
          </Text>
        </View>
        <View style={[styles.verticalDivider, { backgroundColor: activeColors.dividerColor }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: activeColors.textMuted }]}>홈 승률</Text>
          <Text style={[styles.summaryVal, { color: activeColors.textBody, textAlign: 'center' }]}>
            {homeWinRate}%{"\n"}({homeWins}승 {homeDraws}무 {homeLosses}패)
          </Text>
        </View>
        <View style={[styles.verticalDivider, { backgroundColor: activeColors.dividerColor }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: activeColors.textMuted }]}>원정 승률</Text>
          <Text style={[styles.summaryVal, { color: activeColors.textBody, textAlign: 'center' }]}>
            {awayWinRate}%{"\n"}({awayWins}승 {awayDraws}무 {awayLosses}패)
          </Text>
        </View>
      </View>
    </View>
  );

  const renderFormCard = () => (
    <View key="form" style={[styles.statsCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
      <Text style={[styles.cardTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>최근 경기 흐름 (최근 10경기)</Text>
      {recentLogs.length === 0 ? (
        <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>기록된 경기가 없습니다.</Text>
      ) : (
        <View style={styles.formRow}>
          {recentLogs.map((log, i) => {
            const outcome = calculateOutcome(log, myTeam);
            let bgStyle = styles.bgDraw;
            if (outcome === '승') bgStyle = styles.bgWin;
            if (outcome === '패') bgStyle = styles.bgLose;

            return (
              <View key={i} style={[styles.formCircle, bgStyle]}>
                <Text style={styles.formCircleText}>{outcome}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderMonthlyCard = () => {
    const getYTicks = () => {
      const ticks = [];
      const step = maxMonthlyCount > 5 ? Math.ceil(maxMonthlyCount / 4) : 1;
      for (let i = maxMonthlyCount; i >= 0; i -= step) {
        ticks.push(i);
      }
      if (ticks[ticks.length - 1] !== 0) {
        ticks.push(0);
      }
      return Array.from(new Set(ticks)).sort((a, b) => b - a);
    };
    const yTicks = getYTicks();
    const accentColor = isDark ? activeColors.brandRed : activeColors.brandNavy;
    const dimTint = isDark ? '#EE3224' : '#001C48';

    return (
      <View key="monthly" style={[styles.statsCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
        <Text style={[styles.cardTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>월별 직관 횟수</Text>

        <View style={styles.chartWrapper}>
          {/* Y Axis Guide Ticks */}
          <View style={styles.yAxisContainer}>
            {yTicks.map((tick) => (
              <Text key={tick} style={[styles.yAxisTickText, { color: activeColors.textMuted }]}>
                {tick}
              </Text>
            ))}
          </View>

          {/* Bars area, with dashed horizontal guide lines behind it for easier reading */}
          <View style={styles.chartBarsArea}>
            {yTicks.map((tick) => (
              <View
                key={`grid-${tick}`}
                style={[
                  styles.chartGridLine,
                  {
                    borderTopColor: activeColors.dividerColor,
                    bottom: maxMonthlyCount > 0 ? `${(tick / maxMonthlyCount) * 100}%` : 0,
                  },
                ]}
              />
            ))}
            <View style={styles.chartBarsRow}>
              {monthlyData.map((d) => {
                const barHeight = maxMonthlyCount > 0 ? (d.count / maxMonthlyCount) * 120 : 0;
                const hasCount = d.count > 0;
                const isCurrentMonth = d.month === currentMonthNum;
                return (
                  <View key={d.month} style={styles.barCol}>
                    {/* Value label positions against this track-only wrapper (not the whole
                        column), so its `bottom` offset can't land inside the bar fill on tall bars -
                        it used to measure against barCol's full height (track + month label below it),
                        which pulled the label down into the fill on near-max bars. */}
                    <View style={styles.barTrackWrap}>
                      <View style={[styles.barTrack, { backgroundColor: activeColors.bgTag }]}>
                        {hasCount && (
                          <View
                            style={[
                              styles.barFill,
                              {
                                height: barHeight,
                                backgroundColor: isCurrentMonth ? accentColor : dimTint,
                              },
                            ]}
                          />
                        )}
                      </View>
                      {hasCount && (
                        // Fixed at the top of the 120px track (not barHeight-relative) so every
                        // month's count lines up in one row instead of drifting to whatever
                        // height that month's own bar happens to reach.
                        <Text style={[styles.barValueText, { color: isCurrentMonth ? accentColor : activeColors.textMuted, bottom: 124 }]}>
                          {d.count}
                        </Text>
                      )}
                    </View>
                    <Text style={[
                      styles.monthLabelText,
                      { color: isCurrentMonth ? accentColor : activeColors.textMuted },
                      isCurrentMonth && { fontWeight: '900' },
                    ]}>
                      {d.month}
                      {isCurrentMonth ? ' ●' : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderOpponentCard = () => (
    <View key="opponent" style={[styles.statsCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
      <TouchableOpacity style={styles.sectionToggleHeader} onPress={() => toggleSection('opponent')} activeOpacity={0.7}>
        <Text style={[styles.cardTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy, marginBottom: 0 }]}>상대 구단별 전적</Text>
        <Ionicons name={expandedSections.opponent ? 'chevron-up' : 'chevron-down'} size={18} color={activeColors.textMuted} />
      </TouchableOpacity>
      {expandedSections.opponent && (leaderboard.length === 0 ? (
        <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>전적 정보가 없습니다.</Text>
      ) : (
        <View style={styles.leaderboardList}>
          {leaderboard.slice(0, 5).map((item, idx) => {
            return (
              <View key={item.name} style={[styles.leaderboardRow, { borderBottomColor: activeColors.borderColor }]}>
                {/* Rank & Emblem */}
                <View style={styles.leaderboardLeft}>
                  <Text style={[styles.rankText, { color: activeColors.textMuted }]}>
                    {idx + 1}
                  </Text>
                  <TeamBadge teamName={item.name} size={20} />
                </View>

                {/* Team Name & Progress Bar */}
                <View style={styles.leaderboardCenter}>
                  <Text style={[styles.leaderboardTeamName, { color: activeColors.textBody }]}>
                    {item.name}
                  </Text>
                  <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#2E2E35' : '#E0E0E0' }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${item.winRate}%`,
                          backgroundColor: isDark ? activeColors.brandRed : '#001C48',
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Stats details */}
                <View style={styles.leaderboardRight}>
                  <Text style={[styles.leaderboardWinRateText, { color: isDark ? activeColors.brandRed : activeColors.brandNavy }]}>
                    {item.winRate.toFixed(0)}%
                  </Text>
                  <Text style={[styles.leaderboardStatsDetail, { color: activeColors.textMuted }]}>
                    {item.total}전 {item.wins}승 {item.draws}무 {item.losses}패
                  </Text>
                </View>
              </View>
            );
          })}

          {leaderboard.length > 5 && (
            <TouchableOpacity
              style={{
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
                borderTopWidth: 1,
                borderTopColor: activeColors.borderColor,
                marginTop: 8,
              }}
              onPress={() => setOpponentModalVisible(true)}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? activeColors.brandRed : activeColors.brandNavy }}>
                더보기...
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );

  const renderStadiumCard = () => (
    <View key="stadium" style={[styles.statsCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
      <TouchableOpacity style={styles.sectionToggleHeader} onPress={() => toggleSection('stadium')} activeOpacity={0.7}>
        <Text style={[styles.cardTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy, marginBottom: 0 }]}>📍 경기장별 승률</Text>
        <Ionicons name={expandedSections.stadium ? 'chevron-up' : 'chevron-down'} size={18} color={activeColors.textMuted} />
      </TouchableOpacity>
      {expandedSections.stadium && (stadiumStatsList.length === 0 ? (
        <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>경기장 기록이 없습니다.</Text>
      ) : (
        <View style={styles.leaderboardList}>
          {stadiumStatsList.slice(0, 5).map((item, idx) => (
            <View key={item.name} style={[styles.leaderboardRow, { borderBottomColor: activeColors.borderColor }]}>
              <View style={styles.leaderboardLeft}>
                <Text style={[styles.rankText, { color: activeColors.textMuted }]}>
                  {idx + 1}
                </Text>
                <Ionicons name="location" size={18} color={isDark ? activeColors.brandRed : activeColors.brandNavy} />
              </View>

              <View style={styles.leaderboardCenter}>
                <Text style={[styles.leaderboardTeamName, { color: activeColors.textBody }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#2E2E35' : '#E0E0E0' }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${item.winRate}%`,
                        backgroundColor: isDark ? activeColors.brandRed : '#001C48',
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.leaderboardRight}>
                <Text style={[styles.leaderboardWinRateText, { color: isDark ? activeColors.brandRed : activeColors.brandNavy }]}>
                  {item.winRate.toFixed(0)}%
                </Text>
                <Text style={[styles.leaderboardStatsDetail, { color: activeColors.textMuted }]}>
                  {item.total}전 {item.wins}승 {item.draws}무 {item.losses}패
                </Text>
              </View>
            </View>
          ))}

          {stadiumStatsList.length > 5 && (
            <TouchableOpacity
              style={{
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
                borderTopWidth: 1,
                borderTopColor: activeColors.borderColor,
                marginTop: 8,
              }}
              onPress={() => setStadiumModalVisible(true)}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? activeColors.brandRed : activeColors.brandNavy }}>
                더보기...
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );

  const renderCompanionCard = () => (
    <View key="companion" style={[styles.statsCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
      <TouchableOpacity style={styles.sectionToggleHeader} onPress={() => toggleSection('companion')} activeOpacity={0.7}>
        <Text style={[styles.cardTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy, marginBottom: 0 }]}>👥 직관 메이트 상성</Text>
        <Ionicons name={expandedSections.companion ? 'chevron-up' : 'chevron-down'} size={18} color={activeColors.textMuted} />
      </TouchableOpacity>
      {expandedSections.companion && (companionStatsList.length === 0 ? (
        <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>메이트 기록이 없습니다.</Text>
      ) : (
        <View>
          {companionStatsList.slice(0, 5).map((item) => (
            <View key={item.name} style={[styles.leaderboardRow, { borderBottomColor: activeColors.borderColor }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: activeColors.textBody }}>{item.name}</Text>
                <Text style={{ fontSize: 11, color: activeColors.textMuted }}>{item.total}전 {item.wins}승 {item.draws}무 {item.losses}패</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? activeColors.brandRed : activeColors.brandNavy }}>
                승률 {item.winRate.toFixed(0)}%
              </Text>
            </View>
          ))}

          {companionStatsList.length > 5 && (
            <TouchableOpacity
              style={{
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
                borderTopWidth: 1,
                borderTopColor: activeColors.borderColor,
                marginTop: 8,
              }}
              onPress={() => setCompanionModalVisible(true)}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? activeColors.brandRed : activeColors.brandNavy }}>
                더보기...
              </Text>
            </TouchableOpacity>
          )}

          {defeatTotem && (
            <View style={{
              backgroundColor: isDark ? 'rgba(238, 50, 36, 0.08)' : 'rgba(0, 28, 72, 0.04)',
              padding: 12,
              borderRadius: 8,
              marginTop: 15,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(238, 50, 36, 0.2)' : 'rgba(0, 28, 72, 0.1)',
            }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#ffffff' : activeColors.textBody, lineHeight: 18 }}>
                {(() => {
                  const isAlone = defeatTotem.name === '혼관';
                  const wr = defeatTotem.winRate;

                  if (wr === 0) {
                    return isAlone
                      ? `💀 혼관(혼자 관람) 승률: 0% ➡️ 혼자 갈 때마다 지는 슬픈 운명... 당장 누구라도 납치해서 같이 가십시오!`
                      : `💀 패배 토템 경보: ${defeatTotem.name}님과 함께한 경기 승률: 0% ➡️ 이 친구와는 전생에 원수였던 게 분명합니다. 당분간 경기장 근처에도 같이 가지 마십시오!`;
                  } else if (wr <= 30) {
                    return isAlone
                      ? `🚨 혼관(혼자 관람) 승률: ${wr.toFixed(0)}% ➡️ 축구장 갈 때 동행을 구하십시오. 혼자는 너무 외롭고 패배만 부릅니다.`
                      : `🚨 패배 토템 경보: ${defeatTotem.name}님과 함께한 경기 승률: ${wr.toFixed(0)}% ➡️ 당분간 이 친구의 연락을 피하십시오.`;
                  } else if (wr < 50) {
                    return isAlone
                      ? `😮💨 혼관(혼자 관람) 승률: ${wr.toFixed(0)}% ➡️ 이길 때도 질 때도 혼자 감내하는 쓸쓸한 직관길.`
                      : `😮💨 징크스 주의: ${defeatTotem.name}님과 함께한 경기 승률: ${wr.toFixed(0)}% ➡️ 가끔은 다른 친구와 가보거나 좌석을 바꿔보는 것을 추천합니다.`;
                  } else if (wr < 70) {
                    return isAlone
                      ? `😐 혼관(혼자 관람) 승률: ${wr.toFixed(0)}% ➡️ 평화롭고 무난한 독고다이 직관러시군요.`
                      : `🔥 승리 요정 발견: ${defeatTotem.name}님과 함께한 경기 승률: ${wr.toFixed(0)}% ➡️ 승리의 기운이 솔솔! 매 경기를 꼭 함께 동행하십시오!`;
                  } else if (wr < 100) {
                    return isAlone
                      ? `😇 혼관(혼자 관람) 승률: ${wr.toFixed(0)}% ➡️ 역시 축구는 혼자 집중해서 볼 때 제일 평화롭고 승리 확률도 극대화됩니다!`
                      : `😇 킹리 요정 발견: ${defeatTotem.name}님과 함께한 경기 승률: ${wr.toFixed(0)}% ➡️ 이 동행인은 승리를 부르는 보증수표입니다. 티켓 값을 대신 내줘서라도 데려가십시오!`;
                  } else {
                    return isAlone
                      ? `👑 혼관(혼자 관람) 승률: 100% ➡️ 축구장 신의 가호를 받는 고독한 미식가! 혼자 직관 가시면 절대 지지 않습니다!`
                      : `👑 승률 100%의 절대 요정: ${defeatTotem.name}님과 함께한 경기 승률: 100% ➡️ 이 친구가 바로 팀의 진정한 구세주입니다. 무조건 납치해서 모든 경기에 데려가십시오!`;
                  }
                })()}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderWeatherCard = () => (
    <View key="weather" style={[styles.statsCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
      <TouchableOpacity style={styles.sectionToggleHeader} onPress={() => toggleSection('weather')} activeOpacity={0.7}>
        <Text style={[styles.cardTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy, marginBottom: 0 }]}>☀️ 기상청 대시보드</Text>
        <Ionicons name={expandedSections.weather ? 'chevron-up' : 'chevron-down'} size={18} color={activeColors.textMuted} />
      </TouchableOpacity>
      {expandedSections.weather && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginTop: 15 }}>
            {weatherStatsList.map((w) => (
              <View key={w.name} style={{
                flex: 1,
                minWidth: '22%',
                backgroundColor: activeColors.bgTag,
                borderRadius: 8,
                padding: 10,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: activeColors.borderColor
              }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: activeColors.textBody }}>{w.name}</Text>
                <Text style={{ fontSize: 12, fontWeight: '900', color: isDark ? activeColors.brandRed : activeColors.brandNavy, marginTop: 4 }}>
                  {w.winRate.toFixed(0)}%
                </Text>
                <Text style={{ fontSize: 9, color: activeColors.textMuted, marginTop: 2 }}>{w.total}경기</Text>
              </View>
            ))}
          </View>
          {bestWeather && (
            <View style={{
              backgroundColor: isDark ? 'rgba(238, 50, 36, 0.08)' : 'rgba(0, 28, 72, 0.04)',
              padding: 12,
              borderRadius: 8,
              marginTop: 15,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(238, 50, 36, 0.2)' : 'rgba(0, 28, 72, 0.1)',
            }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#ffffff' : activeColors.textBody }}>
                {bestWeather.name === '🌧️비' ? (
                  `🌧️ 비가 오면 전투력이 상승하는 수중전의 지배자 타입이시군요!`
                ) : bestWeather.name === '☀️맑음' ? (
                  `☀️ 햇빛이 쨍쨍할 때 승률이 가장 높은 태양의 전사이시군요!`
                ) : bestWeather.name === '☁️흐림' ? (
                  `☁️ 선선하고 구름 낀 날씨에 최고의 집중력을 발휘하시는 감성 전술가이시군요!`
                ) : (
                  `❄️ 눈 내리는 혹한기에 승률이 가장 높은 설원의 사냥꾼이시군요!`
                )}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );

  const renderRefereeCard = () => (
    <View key="referee" style={[styles.statsCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
      <TouchableOpacity style={styles.sectionToggleHeader} onPress={() => toggleSection('referee')} activeOpacity={0.7}>
        <Text style={[styles.cardTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy, marginBottom: 0 }]}>🎚️ 심판 판정 대시보드</Text>
        <Ionicons name={expandedSections.referee ? 'chevron-up' : 'chevron-down'} size={18} color={activeColors.textMuted} />
      </TouchableOpacity>
      {expandedSections.referee && (() => {
        let refLogs = filteredLogs.filter(l => l.refereeScore !== undefined);
        if (refLogs.length === 0) {
          return <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>기록된 심판 평가가 없습니다.</Text>;
        }

        const avgScore = Math.round(refLogs.reduce((acc, curr) => acc + curr.refereeScore, 0) / refLogs.length);
        const worstCount = refLogs.filter(l => l.refereeScore <= 20).length;
        const badCount = refLogs.filter(l => l.refereeScore >= 21 && l.refereeScore <= 45).length;
        const okCount = refLogs.filter(l => l.refereeScore >= 46 && l.refereeScore <= 65).length;
        const goodCount = refLogs.filter(l => l.refereeScore >= 66 && l.refereeScore <= 85).length;
        const perfectCount = refLogs.filter(l => l.refereeScore >= 86).length;

        return (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: activeColors.textBody }}>평균 심판 평가 점수</Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? activeColors.brandRed : activeColors.brandNavy }}>
                {avgScore}점 / 100점
              </Text>
            </View>

            {/* Score Zones list */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: activeColors.textBody, fontSize: 12 }}>🤬 뒷목 구역 (0~20점)</Text>
                <Text style={{ fontWeight: '800', color: activeColors.textBody, fontSize: 12 }}>{worstCount}경기</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: activeColors.textBody, fontSize: 12 }}>😮💨 답답 구역 (21~45점)</Text>
                <Text style={{ fontWeight: '800', color: activeColors.textBody, fontSize: 12 }}>{badCount}경기</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: activeColors.textBody, fontSize: 12 }}>😐 무난 구역 (46~65점)</Text>
                <Text style={{ fontWeight: '800', color: activeColors.textBody, fontSize: 12 }}>{okCount}경기</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: activeColors.textBody, fontSize: 12 }}>🧐 만족 구역 (66~85점)</Text>
                <Text style={{ fontWeight: '800', color: activeColors.textBody, fontSize: 12 }}>{goodCount}경기</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: activeColors.textBody, fontSize: 12 }}>😇 성인군자 구역 (86~100점)</Text>
                <Text style={{ fontWeight: '800', color: activeColors.textBody, fontSize: 12 }}>{perfectCount}경기</Text>
              </View>
            </View>

            {/* Special warnings (Based on average score) */}
            {(() => {
              let alertBg = 'rgba(120, 120, 120, 0.05)';
              let alertBorder = 'rgba(120, 120, 120, 0.15)';
              let alertText = activeColors.textBody;
              let emoji = '😐';
              let message = '';

              if (avgScore <= 20) {
                alertBg = 'rgba(238, 50, 36, 0.08)';
                alertBorder = 'rgba(238, 50, 36, 0.2)';
                alertText = isDark ? '#ffffff' : '#D32F2F';
                emoji = '🤬';
                message = '포청천 실종 사건: 평균 심판 판정이 파탄났습니다. 심판진 퇴근길 버스 호위가 연일 이어지는 중!';
              } else if (avgScore <= 45) {
                alertBg = 'rgba(255, 152, 0, 0.08)';
                alertBorder = 'rgba(255, 152, 0, 0.2)';
                alertText = isDark ? '#ffffff' : '#E65100';
                emoji = '😮💨';
                message = '심판 안경 구입 펀딩 시급: 평균 판정이 매우 답답합니다. 경기장에 VAR 판독기 한 대 놔드려야겠어요.';
              } else if (avgScore <= 60) {
                alertBg = 'rgba(120, 120, 120, 0.08)';
                alertBorder = 'rgba(120, 120, 120, 0.2)';
                alertText = isDark ? '#ffffff' : activeColors.textBody;
                emoji = '😐';
                message = '그냥저냥 K-리그 판정: 욕하기엔 애매하고 칭찬하기엔 과분한, 공기 같은 평균 판정력입니다.';
              } else if (avgScore <= 75) {
                alertBg = 'rgba(33, 150, 243, 0.08)';
                alertBorder = 'rgba(33, 150, 243, 0.2)';
                alertText = isDark ? '#ffffff' : '#0D47A1';
                emoji = '😏';
                message = '비교적 쾌적한 판정: 큰 오심 없이 매끄럽게 흘러간 직관이 많았군요. 심판진 리스펙트!';
              } else if (avgScore <= 90) {
                alertBg = 'rgba(76, 175, 80, 0.08)';
                alertBorder = 'rgba(76, 175, 80, 0.2)';
                alertText = isDark ? '#ffffff' : '#1B5E20';
                emoji = '🧐';
                message = '청렴결백 심판 지대: 판정 수준이 매우 높습니다. 연맹 상벌위가 일할 필요가 없는 모범적 지대!';
              } else {
                alertBg = 'rgba(251, 192, 45, 0.1)';
                alertBorder = 'rgba(251, 192, 45, 0.3)';
                alertText = '#FBC02D';
                emoji = '😇';
                message = '황금 포청천의 재림: 역사상 가장 정의롭고 투명한 판정의 수혜자! 심판진 전원에게 훈장을 수여합시다.';
              }

              return (
                <View style={{
                  backgroundColor: alertBg,
                  padding: 10,
                  borderRadius: 8,
                  marginTop: 12,
                  borderWidth: 1,
                  borderColor: alertBorder,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Text style={{ fontSize: 16 }}>{emoji}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: alertText, flex: 1, lineHeight: 15 }}>
                    {message}
                  </Text>
                </View>
              );
            })()}
          </View>
        );
      })()}
    </View>
  );

  const CARD_RENDERERS = {
    overall: renderOverallCard,
    form: renderFormCard,
    monthly: renderMonthlyCard,
    opponent: renderOpponentCard,
    stadium: renderStadiumCard,
    companion: renderCompanionCard,
    weather: renderWeatherCard,
    referee: renderRefereeCard,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* 마이팀/전체 기록 필터 (마이팀 아닌 경기 기록이 있을 때만) + 통계 구성 진입점 */}
        <View style={styles.topBarRow}>
          {hasNeutralMatch && (
            <View style={[styles.filterToggle, { borderColor: activeColors.borderColor }]}>
              <TouchableOpacity
                style={[styles.filterToggleBtn, statsFilter === 'all' && [styles.filterToggleBtnActive, { backgroundColor: activeColors.bgCard }]]}
                onPress={() => setStatsFilterMode('all')}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterToggleBtnText, { color: statsFilter === 'all' ? segmentActiveColor : activeColors.textMuted }]}>
                  전체
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterToggleBtn, statsFilter === 'my' && [styles.filterToggleBtnActive, { backgroundColor: activeColors.bgCard }]]}
                onPress={() => setStatsFilterMode('my')}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterToggleBtnText, { color: statsFilter === 'my' ? segmentActiveColor : activeColors.textMuted }]}>
                  마이팀
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.configBar, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor, flex: 1 }]}
            onPress={() => setConfigVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={16} color={activeColors.textBody} />
            <Text style={[styles.configBarText, { color: activeColors.textBody }]}>통계 구성</Text>
          </TouchableOpacity>
        </View>

        {cardOrder
          .filter((key) => !hiddenCards.includes(key))
          .map((key) => (CARD_RENDERERS[key] ? CARD_RENDERERS[key]() : null))}

      </ScrollView>

      {/* 0. Stats Configuration Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={configVisible}
        onRequestClose={() => setConfigVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.configModalContent, { backgroundColor: activeColors.bgCard }]}>
            <View style={[styles.modalHeader, { borderBottomColor: activeColors.borderColor }]}>
              <Text style={[styles.modalTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>
                통계 구성
              </Text>
              <TouchableOpacity onPress={() => setConfigVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={activeColors.textBody} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.configHintText, { color: activeColors.textMuted }]}>
              ⋮ 손잡이를 드래그하거나 화살표로 순서를 바꾸고, 눈 아이콘으로 보이거나 숨길 카드를 골라보세요.
            </Text>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }} scrollEnabled={dragKey === null}>
              {cardOrder.map((key) => (
                <Animated.View
                  key={key}
                  style={[
                    styles.configRow,
                    { borderBottomColor: activeColors.borderColor },
                    hiddenCards.includes(key) && { opacity: 0.4 },
                    dragKey === key && [
                      styles.configRowDragging,
                      { backgroundColor: activeColors.bgTag, transform: [{ translateY: dragY }] },
                    ],
                  ]}
                >
                  <View
                    style={styles.dragHandle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    {...getDragResponder(key).panHandlers}
                  >
                    <MaterialIcons name="drag-indicator" size={20} color={activeColors.textMuted} />
                  </View>
                  <Text style={[styles.configRowLabel, { color: activeColors.textBody }]}>
                    {CARD_LABELS[key] || key}
                  </Text>
                  {renderConfigControls(key)}
                </Animated.View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 1. Opponent Team Detailed Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={opponentModalVisible}
        onRequestClose={() => setOpponentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { backgroundColor: activeColors.bgCard, transform: [{ translateY: opponentTranslateY }] }]}>
            {/* Drag Handle */}
            <View style={{ width: '100%', height: 20, alignItems: 'center', justifyContent: 'center', marginTop: 6 }} {...opponentPanResponder.panHandlers}>
              <View style={[styles.modalHeaderDrag, { marginBottom: 0 }]} />
            </View>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: activeColors.borderColor }]}>
              <Text style={[styles.modalTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>
                상대 구단별 전적 (전체)
              </Text>
              <TouchableOpacity
                onPress={() => setOpponentModalVisible(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color={activeColors.textBody} />
              </TouchableOpacity>
            </View>

            {/* List */}
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {leaderboard.map((item, idx) => (
                <View key={item.name} style={[styles.leaderboardRow, { borderBottomColor: activeColors.borderColor, paddingVertical: 12 }]}>
                  {/* Rank & Emblem */}
                  <View style={styles.leaderboardLeft}>
                    <Text style={[styles.rankText, { color: activeColors.textMuted }]}>
                      {idx + 1}
                    </Text>
                    <TeamBadge teamName={item.name} size={20} />
                  </View>

                  {/* Team Name & Progress Bar */}
                  <View style={styles.leaderboardCenter}>
                    <Text style={[styles.leaderboardTeamName, { color: activeColors.textBody }]}>
                      {item.name}
                    </Text>
                    <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#2E2E35' : '#E0E0E0' }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${item.winRate}%`,
                            backgroundColor: isDark ? activeColors.brandRed : '#001C48',
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Stats details */}
                  <View style={styles.leaderboardRight}>
                    <Text style={[styles.leaderboardWinRateText, { color: isDark ? activeColors.brandRed : activeColors.brandNavy }]}>
                      {item.winRate.toFixed(0)}%
                    </Text>
                    <Text style={[styles.leaderboardStatsDetail, { color: activeColors.textMuted }]}>
                      {item.total}전 {item.wins}승 {item.draws}무 {item.losses}패
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* 2. Companion Detailed Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={companionModalVisible}
        onRequestClose={() => setCompanionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { backgroundColor: activeColors.bgCard, transform: [{ translateY: companionTranslateY }] }]}>
            {/* Drag Handle */}
            <View style={{ width: '100%', height: 20, alignItems: 'center', justifyContent: 'center', marginTop: 6 }} {...companionPanResponder.panHandlers}>
              <View style={[styles.modalHeaderDrag, { marginBottom: 0 }]} />
            </View>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: activeColors.borderColor }]}>
              <Text style={[styles.modalTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>
                직관 메이트 상성 (전체)
              </Text>
              <TouchableOpacity
                onPress={() => setCompanionModalVisible(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color={activeColors.textBody} />
              </TouchableOpacity>
            </View>

            {/* List */}
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {companionStatsList.map((item) => (
                <View key={item.name} style={[styles.leaderboardRow, { borderBottomColor: activeColors.borderColor, paddingVertical: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: activeColors.textBody }}>{item.name}</Text>
                    <Text style={{ fontSize: 11, color: activeColors.textMuted }}>{item.total}전 {item.wins}승 {item.draws}무 {item.losses}패</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? activeColors.brandRed : activeColors.brandNavy }}>
                    승률 {item.winRate.toFixed(0)}%
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* 3. Stadium Detailed Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={stadiumModalVisible}
        onRequestClose={() => setStadiumModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { backgroundColor: activeColors.bgCard, transform: [{ translateY: stadiumTranslateY }] }]}>
            {/* Drag Handle */}
            <View style={{ width: '100%', height: 20, alignItems: 'center', justifyContent: 'center', marginTop: 6 }} {...stadiumPanResponder.panHandlers}>
              <View style={[styles.modalHeaderDrag, { marginBottom: 0 }]} />
            </View>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: activeColors.borderColor }]}>
              <Text style={[styles.modalTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>
                경기장별 승률 (전체)
              </Text>
              <TouchableOpacity
                onPress={() => setStadiumModalVisible(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color={activeColors.textBody} />
              </TouchableOpacity>
            </View>

            {/* List */}
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {stadiumStatsList.map((item, idx) => (
                <View key={item.name} style={[styles.leaderboardRow, { borderBottomColor: activeColors.borderColor, paddingVertical: 12 }]}>
                  <View style={styles.leaderboardLeft}>
                    <Text style={[styles.rankText, { color: activeColors.textMuted }]}>
                      {idx + 1}
                    </Text>
                    <Ionicons name="location" size={18} color={isDark ? activeColors.brandRed : activeColors.brandNavy} />
                  </View>

                  <View style={styles.leaderboardCenter}>
                    <Text style={[styles.leaderboardTeamName, { color: activeColors.textBody }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#2E2E35' : '#E0E0E0' }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${item.winRate}%`,
                            backgroundColor: isDark ? activeColors.brandRed : '#001C48',
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.leaderboardRight}>
                    <Text style={[styles.leaderboardWinRateText, { color: isDark ? activeColors.brandRed : activeColors.brandNavy }]}>
                      {item.winRate.toFixed(0)}%
                    </Text>
                    <Text style={[styles.leaderboardStatsDetail, { color: activeColors.textMuted }]}>
                      {item.total}전 {item.wins}승 {item.draws}무 {item.losses}패
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  topBarRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  configBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
  },
  filterToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
  },
  filterToggleBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterToggleBtnActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  filterToggleBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  configBarText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  configModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    width: '100%',
  },
  configHintText: {
    fontSize: 11.5,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 10,
    lineHeight: 16,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CONFIG_ROW_HEIGHT,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  configRowDragging: {
    borderBottomWidth: 0,
    borderRadius: 8,
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  dragHandle: {
    paddingRight: 10,
    paddingVertical: 10,
  },
  configRowLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  reorderControls: {
    flexDirection: 'row',
    gap: 10,
  },
  moveBtn: {
    padding: 3,
  },
  statsCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 15,
  },
  sectionToggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  donutArea: {
    alignItems: 'center',
    marginVertical: 10,
  },
  outerCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winRatePercentText: {
    fontSize: 22,
    fontWeight: '900',
  },
  winRateLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    borderTopWidth: 1,
    paddingTop: 15,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryVal: {
    fontSize: 11,
    fontWeight: '800',
  },
  verticalDivider: {
    width: 1,
    height: 24,
  },
  emptyText: {
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 20,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  formCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCircleText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '900',
  },
  bgWin: {
    backgroundColor: '#10B981',
  },
  bgDraw: {
    backgroundColor: '#64748B',
  },
  bgLose: {
    backgroundColor: '#EE3224',
  },
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    width: '100%',
  },
  yAxisContainer: {
    height: 120,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginRight: 10,
    paddingBottom: 2,
    width: 20,
  },
  yAxisTickText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  chartBarsArea: {
    flex: 1,
    height: 140,
    position: 'relative',
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    height: 20,
  },
  chartBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
    height: 140,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  barTrackWrap: {
    position: 'relative',
  },
  barValueText: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 8.5,
    fontWeight: '900',
  },
  barTrack: {
    height: 120,
    width: 10,
    borderRadius: 5,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 5,
  },
  monthLabelText: {
    fontSize: 9.5,
    fontWeight: '800',
    marginTop: 6,
  },
  leaderboardList: {
    marginTop: 4,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  leaderboardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 44,
    gap: 8,
  },
  rankText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  leaderboardCenter: {
    flex: 1,
    paddingRight: 12,
  },
  leaderboardTeamName: {
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  leaderboardRight: {
    alignItems: 'flex-end',
    width: 70,
  },
  leaderboardWinRateText: {
    fontSize: 13,
    fontWeight: '900',
  },
  leaderboardStatsDetail: {
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  modalHeaderDrag: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CCCCCC',
    alignSelf: 'center',
    marginTop: 8,
  },
});
