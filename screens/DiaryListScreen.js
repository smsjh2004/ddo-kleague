import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  Image,
  Dimensions,
  TextInput,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
} from 'react-native';
import { Colors } from '../constants/Colors';
import TeamBadge from '../components/TeamBadge';
import { LEAGUE_TEAMS } from '../constants/TeamData';
import { getRefereeStatus } from '../utils/refereeStatus';
import { showAlert } from '../utils/appAlert';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function DiaryListScreen({
  theme = 'light',
  logs = [],
  expenses = [],
  myTeam,
  onDeleteLog,
  onOpenWriteForm,
  writeAutofill,
  setWriteAutofill,
  focusedLogId,
  clearFocusedLogId,
  onEditLog,
}) {
  const [selectedLog, setSelectedLog] = useState(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  // Per-card photo index for the feed view, keyed by log id (each card cycles independently).
  const [feedPhotoIndex, setFeedPhotoIndex] = useState({});

  // Reset back to the first photo whenever a different log's detail view opens.
  useEffect(() => {
    setPhotoIndex(0);
  }, [selectedLog?.id]);

  const filterTranslateY = React.useRef(new Animated.Value(0)).current;
  const filterPanResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          filterTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 20 || gestureState.vy > 0.2) {
          setFilterVisible(false);
          setTimeout(() => {
            filterTranslateY.setValue(0);
          }, 300);
        } else {
          Animated.spring(filterTranslateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;
  
  // Filter States
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterOutcome, setFilterOutcome] = useState('all'); // all, win, draw, lose
  const [sortOrder, setSortOrder] = useState('newest'); // newest, oldest
  const [viewMode, setViewMode] = useState('large'); // simplified, large, feed
  const [filterLeagueTab, setFilterLeagueTab] = useState('K1'); // K1, K2

  // Temporary Modal Filter States
  const [tempViewMode, setTempViewMode] = useState('large');
  const [tempFilterOutcome, setTempFilterOutcome] = useState('all');
  const [tempFilterTeam, setTempFilterTeam] = useState('all');
  const [tempFilterLeagueTab, setTempFilterLeagueTab] = useState('K1');

  const openFilterModal = () => {
    setTempViewMode(viewMode);
    setTempFilterOutcome(filterOutcome);
    setTempFilterTeam(filterTeam);
    setTempFilterLeagueTab(filterLeagueTab);
    setFilterVisible(true);
  };

  useEffect(() => {
    if (focusedLogId) {
      const matchedLog = logs.find((l) => l.id === focusedLogId);
      if (matchedLog) {
        setSelectedLog(matchedLog);
      }
      if (clearFocusedLogId) {
        clearFocusedLogId();
      }
    }
  }, [focusedLogId, logs]);

  useEffect(() => {
    if (selectedLog === null) {
      setMenuVisible(false);
    }
  }, [selectedLog]);

  const activeColors = Colors[theme];

  // Helper to determine match outcome relative to myTeam
  const calculateOutcome = (log) => {
    const home = log.homeTeam.trim();
    const away = log.awayTeam.trim();
    const homeScore = parseInt(log.homeScore);
    const awayScore = parseInt(log.awayScore);

    if (isNaN(homeScore) || isNaN(awayScore)) return '무';

    const cleanMyTeam = myTeam.trim();
    const isHome = home === cleanMyTeam;
    const isAway = away === cleanMyTeam;

    if (!isHome && !isAway) {
      // Neutral match
      if (homeScore > awayScore) return '승';
      if (homeScore < awayScore) return '패';
      return '무';
    }

    if (homeScore === awayScore) return '무';

    if (isHome) {
      return homeScore > awayScore ? '승' : '패';
    } else {
      return awayScore > homeScore ? '승' : '패';
    }
  };

  // Filter & Sort Logic
  const getFilteredLogs = () => {
    let result = [...logs];

    // 1. Team Filter
    if (filterTeam !== 'all') {
      result = result.filter(
        (log) => log.homeTeam === filterTeam || log.awayTeam === filterTeam
      );
    }

    // 2. Outcome Filter
    if (filterOutcome !== 'all') {
      result = result.filter((log) => {
        const outcome = calculateOutcome(log);
        if (filterOutcome === 'win') return outcome === '승';
        if (filterOutcome === 'draw') return outcome === '무';
        if (filterOutcome === 'lose') return outcome === '패';
        return true;
      });
    }

    // 3. Sorting
    result.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  };

  const filteredLogs = getFilteredLogs();

  const isDark = theme === 'dark';
  const activeColor = isDark ? activeColors.brandRed : activeColors.brandNavy;
  const activeTintBg = isDark ? 'rgba(238, 50, 36, 0.15)' : 'rgba(0, 28, 72, 0.06)';
  const activeTextColor = isDark ? '#ffffff' : activeColors.brandNavy;

  const handleCardClick = (log) => {
    setSelectedLog(log);
  };

  const handleDelete = (logId) => {
    onDeleteLog(logId);
    setSelectedLog(null);
  };

  const handleDeleteConfirm = (logId) => {
    showAlert(
      '일지 삭제',
      '정말로 이 직관일지를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => handleDelete(logId) }
      ]
    );
  };

  // Flattened team choices for drop-down filter
  const allTeams = [...LEAGUE_TEAMS.K1, ...LEAGUE_TEAMS.K2];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      {/* List Header Filter bar */}
      <View style={[styles.filterBar, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
        <TouchableOpacity
          style={styles.iconOnlyBtn}
          onPress={openFilterModal}
          activeOpacity={0.7}
        >
          <Ionicons name="filter-outline" size={20} color={activeColors.textBody} />
        </TouchableOpacity>

        {/* Quick Sorting Toggle Button (Text + Icon, borderless) */}
        <TouchableOpacity
          onPress={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
          style={[styles.sortTextBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
          activeOpacity={0.7}
        >
          <Text style={{ color: activeColors.textBody, fontSize: 11.5, fontWeight: '800' }}>
            {sortOrder === 'newest' ? '최신순' : '오래된순'}
          </Text>
          <Ionicons
            name={sortOrder === 'newest' ? 'arrow-down-outline' : 'arrow-up-outline'}
            size={13}
            color={activeColors.textBody}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>
              기록된 직관일지가 없습니다. {'\n'}첫 번째 일지를 남겨보세요!
            </Text>
            <TouchableOpacity
              style={[styles.writeBtn, { backgroundColor: activeColors.brandNavy }]}
              onPress={() => onOpenWriteForm()}
            >
              <Text style={styles.writeBtnText}>첫 직관 등록하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredLogs.map((log) => {
            const outcome = calculateOutcome(log);

            if (viewMode === 'simplified') {
              // Simplified View mode (Image 1 layout)
              const cleanDate = log.date.substring(2).replace(/-/g, '.');
              return (
                <TouchableOpacity
                  key={log.id}
                  style={[styles.simplifiedCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}
                  onPress={() => handleCardClick(log)}
                  activeOpacity={0.7}
                >
                  {/* Left part: Date and Place */}
                  <View style={styles.simLeftCol}>
                    <Text style={[styles.simDateText, { color: activeColors.brandNavy }]}>{cleanDate}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
                      <Ionicons name="location" size={10} color="#EE3224" />
                      <Text style={[styles.simStadiumText, { color: activeColors.textMuted }]} numberOfLines={1}>
                        {log.stadium.replace('월드컵경기장', ' W').replace('축구경기장', ' 축구장')}
                      </Text>
                    </View>
                  </View>

                  {/* Vertical Line */}
                  <View style={[styles.simVerticalLine, { backgroundColor: activeColors.borderColor }]} />

                  {/* Center part: Teams & logos matchup */}
                  <View style={styles.simCenterCol}>
                    <Text style={[styles.simTeamText, { color: activeColors.textBody, textAlign: 'right' }]} numberOfLines={1}>
                      {log.homeTeam.replace(' FC', '').substring(0, 4)}
                    </Text>
                    <TeamBadge teamName={log.homeTeam} size={15} />
                    <Text style={{ fontSize: 9, fontWeight: '800', color: activeColors.textMuted }}>VS</Text>
                    <TeamBadge teamName={log.awayTeam} size={15} />
                    <Text style={[styles.simTeamText, { color: activeColors.textBody }]} numberOfLines={1}>
                      {log.awayTeam.replace(' FC', '').substring(0, 4)}
                    </Text>
                  </View>

                  {/* Right part: Score and Rating stars */}
                  <View style={styles.simRightCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[styles.simScoreText, { color: activeColor }]}>
                        {log.homeScore}:{log.awayScore}
                      </Text>
                      <View style={[
                        styles.simOutcomeBadge,
                        outcome === '승' ? { backgroundColor: '#10B981' } : outcome === '패' ? { backgroundColor: '#EE3224' } : { backgroundColor: '#64748B' }
                      ]}>
                        <Text style={styles.simOutcomeBadgeText}>{outcome}</Text>
                      </View>
                    </View>
                    <Text style={styles.simStarsText}>⭐ {log.rating}</Text>
                  </View>
                </TouchableOpacity>
              );
            }

            if (viewMode === 'feed') {
              // Feed View (Instagram-style - Image 2 layout)
              const isWin = outcome === '승';
              const isLose = outcome === '패';
              return (
                <TouchableOpacity
                  key={log.id}
                  style={[styles.feedCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}
                  onPress={() => handleCardClick(log)}
                  activeOpacity={0.8}
                >
                  {/* Photo (Square aspect ratio 1:1) - slideshow when the log has multiple photos */}
                  <View style={styles.feedPhotoContainer}>
                    {(() => {
                      const photoList = log.photos && log.photos.length > 0
                        ? log.photos
                        : (log.photo ? [log.photo] : []);
                      if (photoList.length === 0) {
                        return (
                          <View style={[styles.feedPhotoPlaceholder, { backgroundColor: isDark ? activeColors.brandRed : '#001C48' }]}>
                            <Ionicons name="football-outline" size={40} color="rgba(255,255,255,0.2)" />
                            <Text style={styles.feedPlaceholderText}>⚽ 직관의 순간</Text>
                          </View>
                        );
                      }
                      const safeIndex = Math.min(feedPhotoIndex[log.id] || 0, photoList.length - 1);
                      return (
                        <>
                          <Image source={{ uri: photoList[safeIndex] }} style={styles.feedImage} />
                          {photoList.length > 1 && (
                            <>
                              <TouchableOpacity
                                style={[styles.feedPhotoNavBtn, styles.feedPhotoNavBtnLeft]}
                                onPress={(e) => {
                                  // Stop the press from bubbling to the card's onPress (RN Web
                                  // dispatches nested Touchables as real DOM clicks, which bubble
                                  // unlike native's exclusive gesture responder) - without this,
                                  // tapping the arrow also opens the diary detail behind it.
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
                      );
                    })()}
                  </View>

                  <View style={styles.feedBodyContainer}>
                    {/* Outcome Badge */}
                    <View style={[
                      styles.feedOutcomeBadge,
                      isWin ? { backgroundColor: '#10B981' } : isLose ? { backgroundColor: '#EE3224' } : { backgroundColor: '#64748B' }
                    ]}>
                      <Text style={styles.feedOutcomeText}>
                        {isWin ? '승리' : isLose ? '패배' : '무승부'}
                      </Text>
                    </View>

                    {/* Matchup row */}
                    <View style={styles.feedMatchupRow}>
                      <TeamBadge teamName={log.homeTeam} size={18} />
                      <Text style={[styles.feedMatchupText, { color: activeColors.textBody }]} numberOfLines={1}>
                        {log.homeTeam} {log.homeScore} VS {log.awayScore} {log.awayTeam}
                      </Text>
                      <TeamBadge teamName={log.awayTeam} size={18} />
                    </View>

                    {/* Meta location/date */}
                    <Text style={[styles.feedMetaText, { color: activeColors.textMuted }]}>
                      {log.date} | {log.stadium}
                    </Text>

                    {/* Review text box */}
                    <View style={[styles.feedThoughtsBox, { backgroundColor: activeColors.bgTag }]}>
                      <Text style={[styles.feedThoughtsText, { color: activeColors.textBody }]} numberOfLines={3}>
                        {log.review || '작성된 소감이 없습니다.'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }

            // Default 'large' View mode
            return (
              <TouchableOpacity
                key={log.id}
                style={[styles.diaryCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}
                onPress={() => handleCardClick(log)}
                activeOpacity={0.7}
              >
                {/* Top Row: Rating text stars & Outcome Badge */}
                <View style={[styles.cardHeaderRow, { borderBottomColor: activeColors.dividerColor }]}>
                  <Text style={[styles.ratingTextLabel, { color: activeColors.textBody }]}>
                    ⭐ 직관경험: {'★'.repeat(log.rating)}{'☆'.repeat(5 - log.rating)}
                  </Text>
                  <View style={[
                    styles.outcomeBadge,
                    outcome === '승' ? { backgroundColor: '#10B981' } : outcome === '패' ? { backgroundColor: '#EE3224' } : { backgroundColor: '#64748B' }
                  ]}>
                    <Text style={styles.outcomeBadgeText}>
                      {outcome === '승' ? '승리' : outcome === '패' ? '패배' : '무승부'}
                    </Text>
                  </View>
                </View>

                {/* Scoreboard display */}
                <View style={styles.scoreboardArea}>
                  <View style={styles.listTeamLeft}>
                    <TeamBadge teamName={log.homeTeam} size={20} />
                    <Text style={[styles.listTeamName, { color: activeColors.textBody }]} numberOfLines={1}>
                      {log.homeTeam}
                    </Text>
                  </View>
                  
                  <View style={[styles.listScoreBox, { backgroundColor: isDark ? activeColors.brandRed : '#001C48' }]}>
                    <Text style={styles.listScoreText}>
                      {log.homeScore}:{log.awayScore}
                    </Text>
                  </View>

                  <View style={styles.listTeamRight}>
                    <Text style={[styles.listTeamName, { color: activeColors.textBody, textAlign: 'right' }]} numberOfLines={1}>
                      {log.awayTeam}
                    </Text>
                    <TeamBadge teamName={log.awayTeam} size={20} />
                  </View>
                </View>

                {/* Dashed Separator Line */}
                <View style={[styles.dashedDivider, { borderBottomColor: activeColors.borderColor }]} />

                {/* Card Footer details */}
                <View style={styles.cardFooterRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="calendar-outline" size={13} color={activeColors.textMuted} />
                    <Text style={[styles.metaText, { color: activeColors.textMuted }]}>
                      {log.date}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="location-outline" size={13} color={activeColors.textMuted} />
                    <Text style={[styles.metaText, { color: activeColors.textMuted }]}>
                      {log.stadium}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* 1. Filter Settings modal sheet */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterVisible}
        onRequestClose={() => setFilterVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterVisible(false)}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              style={[styles.modalSheet, { backgroundColor: activeColors.bgApp, transform: [{ translateY: filterTranslateY }] }]}
            >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 14, paddingBottom: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10 }} {...filterPanResponder.panHandlers}>
              <View style={[styles.modalHeaderDrag, { marginBottom: 0 }]} />
            </View>
            <Text style={[styles.modalTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>직관일지 필터</Text>

            {/* 1. View Mode Settings */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: activeColors.textBody }]}>보기 모드 설정</Text>
              <View style={styles.chipsRow}>
                {[
                  { key: 'large', label: '기본모드', icon: 'albums-outline' },
                  { key: 'simplified', label: '간단모드', icon: 'list-outline' },
                  { key: 'feed', label: '피드모드', icon: 'images-outline' }
                ].map((modeOpt) => {
                  const isActive = tempViewMode === modeOpt.key;
                  const chipColor = isActive
                    ? (isDark ? activeColors.brandRed : activeColors.brandNavy)
                    : activeColors.textBody;
                  return (
                    <TouchableOpacity
                      key={modeOpt.key}
                      style={[
                        styles.chipBtn,
                        styles.chipBtnWithIcon,
                        { borderColor: activeColors.borderColor },
                        isActive && {
                          borderColor: isDark ? activeColors.brandRed : activeColors.brandNavy,
                          backgroundColor: isDark ? 'rgba(238, 50, 36, 0.1)' : 'rgba(0, 71, 160, 0.1)',
                        }
                      ]}
                      onPress={() => setTempViewMode(modeOpt.key)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={modeOpt.icon} size={14} color={chipColor} />
                      <Text style={[styles.chipText, { color: chipColor }]}>
                        {modeOpt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Outcome Filter Chips */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: activeColors.textBody }]}>경기 결과 필터</Text>
              <View style={styles.chipsRow}>
                {[
                  { key: 'all', label: '전체 결과' },
                  { key: '승', label: '승리' },
                  { key: '무', label: '무승부' },
                  { key: '패', label: '패배' }
                ].map((outOpt) => {
                  const isActive = tempFilterOutcome === outOpt.key;
                  return (
                    <TouchableOpacity
                      key={outOpt.key}
                      style={[
                        styles.chipBtn,
                        { borderColor: activeColors.borderColor },
                        isActive && {
                          borderColor: isDark ? activeColors.brandRed : activeColors.brandNavy,
                          backgroundColor: isDark ? 'rgba(238, 50, 36, 0.1)' : 'rgba(0, 71, 160, 0.1)',
                        }
                      ]}
                      onPress={() => setTempFilterOutcome(outOpt.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: activeColors.textBody },
                        isActive && { color: isDark ? activeColors.brandRed : activeColors.brandNavy }
                      ]}>
                        {outOpt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Team Filter selector (Convenient division tabs & 3-column grid) */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: activeColors.textBody, marginBottom: 10 }]}>특정 구단 필터</Text>
              
              {/* League tabs inside filter */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  style={[
                    styles.leagueSubTab,
                    tempFilterLeagueTab === 'K1' ? {
                      borderColor: activeColor,
                      borderWidth: 1.5,
                      backgroundColor: activeTintBg
                    } : {
                      borderColor: activeColors.borderColor,
                      borderWidth: 1,
                      backgroundColor: activeColors.bgTag
                    }
                  ]}
                  onPress={() => setTempFilterLeagueTab('K1')}
                >
                  <Text style={[styles.leagueSubTabText, { color: tempFilterLeagueTab === 'K1' ? activeTextColor : activeColors.textBody }]}>
                    K리그 1
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.leagueSubTab,
                    tempFilterLeagueTab === 'K2' ? {
                      borderColor: activeColor,
                      borderWidth: 1.5,
                      backgroundColor: activeTintBg
                    } : {
                      borderColor: activeColors.borderColor,
                      borderWidth: 1,
                      backgroundColor: activeColors.bgTag
                    }
                  ]}
                  onPress={() => setTempFilterLeagueTab('K2')}
                >
                  <Text style={[styles.leagueSubTabText, { color: tempFilterLeagueTab === 'K2' ? activeTextColor : activeColors.textBody }]}>
                    K리그 2
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 3-Column Team Grid */}
              <View style={styles.teamFilterGrid}>
                {['전체', ...LEAGUE_TEAMS[tempFilterLeagueTab]].map((teamName) => {
                  const isAll = teamName === '전체';
                  const isActive = isAll ? tempFilterTeam === 'all' : tempFilterTeam === teamName;
                  return (
                    <TouchableOpacity
                      key={teamName}
                      style={[
                        styles.teamFilterGridCell,
                        isActive ? {
                          borderColor: activeColor,
                          borderWidth: 1.5,
                          backgroundColor: activeTintBg
                        } : {
                          borderColor: activeColors.borderColor,
                          borderWidth: 1,
                          backgroundColor: activeColors.bgTag
                        }
                      ]}
                      onPress={() => {
                        setTempFilterTeam(isAll ? 'all' : teamName);
                      }}
                    >
                      {!isAll && <TeamBadge teamName={teamName} size={13} />}
                      <Text style={[
                        styles.teamFilterGridCellText,
                        { color: isActive ? activeTextColor : activeColors.textBody },
                        isAll && { textAlign: 'center', fontWeight: '950', flex: 1 }
                      ]} numberOfLines={1}>
                        {isAll ? '전체' : teamName.replace(' FC', '')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 4. Filter Reset and Apply Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
              <TouchableOpacity
                style={[
                  styles.filterResetBtn,
                  { borderColor: activeColors.borderColor, backgroundColor: activeColors.bgApp }
                ]}
                onPress={() => {
                  setTempViewMode('large');
                  setTempFilterOutcome('all');
                  setTempFilterTeam('all');
                  setTempFilterLeagueTab('K1');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterResetBtnText, { color: isDark ? '#ffffff' : activeColors.textMuted }]}>
                  초기화
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterApplyBtn,
                  { backgroundColor: activeColor }
                ]}
                onPress={() => {
                  setViewMode(tempViewMode);
                  setFilterOutcome(tempFilterOutcome);
                  setFilterTeam(tempFilterTeam);
                  setFilterLeagueTab(tempFilterLeagueTab);
                  setFilterVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.filterApplyBtnText}>
                  필터 적용하기
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* 2. Diary Detail View modal sheet */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={selectedLog !== null}
        onRequestClose={() => setSelectedLog(null)}
      >
        <View style={[styles.detailOverlay, { backgroundColor: activeColors.bgBody }]}>
          <SafeAreaView style={{ flex: 1 }}>
            {selectedLog && (
              <View style={{ flex: 1 }}>
                {/* Header Row */}
                <View style={[styles.detailHeader, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
                  <TouchableOpacity
                    onPress={() => setSelectedLog(null)}
                    style={styles.detailHeaderBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
                  </TouchableOpacity>
                  <Text style={[styles.detailHeaderTitle, { color: isDark ? activeColors.brandRed : activeColors.brandNavy }]}>직관일지 상세</Text>
                  <TouchableOpacity
                    onPress={() => setMenuVisible(!menuVisible)}
                    style={styles.detailHeaderBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="ellipsis-vertical" size={22} color={activeColors.textBody} />
                  </TouchableOpacity>
                </View>

                {menuVisible && (
                  <View style={[styles.menuDropdown, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
                    <TouchableOpacity
                      style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: activeColors.borderColor }]}
                      onPress={() => {
                        setMenuVisible(false);
                        setSelectedLog(null);
                        if (onEditLog) {
                          onEditLog(selectedLog);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={16} color={activeColors.textBody} style={{ marginRight: 8 }} />
                      <Text style={[styles.menuItemText, { color: activeColors.textBody }]}>수정</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        setMenuVisible(false);
                        handleDeleteConfirm(selectedLog.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EE3224" style={{ marginRight: 8 }} />
                      <Text style={[styles.menuItemText, { color: '#EE3224' }]}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <ScrollView contentContainerStyle={styles.detailScrollContent}>
                  {/* Photo Display Card - slideshow with < > nav when the log has multiple photos */}
                  {(() => {
                    const photoList = selectedLog.photos && selectedLog.photos.length > 0
                      ? selectedLog.photos
                      : (selectedLog.photo ? [selectedLog.photo] : []);
                    if (photoList.length === 0) return null;
                    const safeIndex = Math.min(photoIndex, photoList.length - 1);
                    return (
                      <View style={[styles.detailPhotoCard, { borderColor: activeColors.borderColor }]}>
                        <Image source={{ uri: photoList[safeIndex] }} style={styles.detailCardImage} />
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
                    );
                  })()}

                  {/* Match Summary Card */}
                  <View style={[styles.detailCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
                    <View style={styles.detailSummaryHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                        <Ionicons name="calendar-outline" size={13} color={activeColors.textMuted} />
                        <Text style={[styles.detailSummaryMetaText, { color: activeColors.textMuted }]}>
                          {selectedLog.date}
                        </Text>
                        <Text style={{ color: activeColors.textMuted, fontSize: 11 }}>|</Text>
                        <Ionicons name="location" size={13} color="#EE3224" />
                        <Text style={[styles.detailSummaryMetaText, { color: activeColors.textMuted }]} numberOfLines={1}>
                          {selectedLog.stadium}
                        </Text>
                      </View>
                      
                      {/* Outcome Badge */}
                      {(() => {
                        const outcome = calculateOutcome(selectedLog);
                        const isWin = outcome === '승';
                        const isLose = outcome === '패';
                        return (
                          <View style={[
                            styles.detailOutcomeBadge,
                            isWin ? { backgroundColor: '#10B981' } : isLose ? { backgroundColor: '#EE3224' } : { backgroundColor: '#64748B' }
                          ]}>
                            <Text style={styles.detailOutcomeBadgeText}>
                              {isWin ? '승리 (WIN)' : isLose ? '패배 (LOSE)' : '무승부 (DRAW)'}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>

                    <View style={styles.detailScoreboardRow}>
                      <View style={styles.detailTeamCol}>
                        <TeamBadge teamName={selectedLog.homeTeam} size={28} />
                        <Text style={[styles.detailTeamName, { color: activeColors.textBody }]}>{selectedLog.homeTeam}</Text>
                      </View>
                      <Text style={[styles.detailScoreText, { color: activeColors.brandNavy }]}>
                        {selectedLog.homeScore} : {selectedLog.awayScore}
                      </Text>
                      <View style={styles.detailTeamCol}>
                        <TeamBadge teamName={selectedLog.awayTeam} size={28} />
                        <Text style={[styles.detailTeamName, { color: activeColors.textBody }]}>{selectedLog.awayTeam}</Text>
                      </View>
                    </View>

                    {/* Weather & Companion Details */}
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginTop: 12,
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: activeColors.borderColor,
                    }}>
                      <Text style={{ fontSize: 12, color: activeColors.textMuted, fontWeight: '700' }}>
                        ⛅ 날씨: <Text style={{ color: activeColors.textBody }}>{selectedLog.weather || '☀️맑음'}</Text>
                      </Text>
                      <Text style={{ fontSize: 12, color: activeColors.textMuted, fontWeight: '700' }}>
                        👥 동행인: <Text style={{ color: activeColors.textBody }}>{selectedLog.companion || '혼관'}</Text>
                      </Text>
                    </View>
                  </View>

                  {/* Rating Card */}
                  <View style={[styles.detailCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
                    <Text style={[styles.detailCardLabel, { color: activeColors.textMuted }]}>나의 평점</Text>
                    <View style={styles.detailStarsRow}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons
                          key={i}
                          name={i < selectedLog.rating ? 'star' : 'star-outline'}
                          size={24}
                          color="#FBC02D"
                          style={{ marginRight: 6 }}
                        />
                      ))}
                    </View>
                  </View>

                  {/* Referee Evaluation Card */}
                  {selectedLog.refereeScore !== undefined && (
                    <View style={[styles.detailCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
                      <Text style={[styles.detailCardLabel, { color: activeColors.textMuted }]}>
                        📢 심판 평가 ({selectedLog.refereeScore}점)
                      </Text>
                      {(() => {
                        const { emoji, text: desc } = getRefereeStatus(selectedLog.refereeScore);
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                            <Text style={{ fontSize: 24 }}>{emoji}</Text>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: activeColors.textBody, flex: 1 }}>
                              {desc}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* Spending Card */}
                  {(() => {
                    const logExpenses = expenses.filter((e) => e.matchId === selectedLog.id);
                    const totalSpent = logExpenses.reduce((acc, curr) => acc + curr.amount, 0);
                    if (logExpenses.length === 0) return null;
                    return (
                      <View style={[styles.detailCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
                        <View style={styles.detailSpendingHeader}>
                          <Text style={[styles.detailCardLabel, { color: activeColors.brandNavy, marginBottom: 0 }]}>
                            💵 이날의 소비 지출
                          </Text>
                          <Text style={[styles.detailSpendingTotalText, { color: activeColors.brandNavy }]}>
                            {totalSpent.toLocaleString()}원
                          </Text>
                        </View>
                        <View style={[styles.detailSpendingDivider, { backgroundColor: activeColors.dividerColor }]} />
                        {logExpenses.map((e) => {
                          const emoji = e.category === 'ticket' ? '🎫' : e.category === 'food' ? '🍔' : e.category === 'transport' ? '🚌' : '🛍️';
                          const label = e.category === 'ticket' ? '티켓' : e.category === 'food' ? '식음료' : e.category === 'transport' ? '교통' : '굿즈/기타';
                          return (
                            <View key={e.id} style={styles.detailSpendingRow}>
                              <Text style={[styles.detailSpendingRowLabel, { color: activeColors.textBody }]}>
                                {emoji} {label} | {e.memo || label}
                              </Text>
                              <Text style={[styles.detailSpendingRowAmount, { color: activeColors.brandNavy }]}>
                                {e.amount.toLocaleString()}원
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })()}

                  {/* Thoughts Card */}
                  <View style={[styles.detailCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
                    <Text style={[styles.detailCardLabel, { color: activeColors.brandNavy }]}>📝 직관 상세 소감</Text>
                    <Text style={[styles.detailThoughtsText, { color: activeColors.textBody }]}>
                      {selectedLog.review || '기록된 소감이 없습니다.'}
                    </Text>
                  </View>
                </ScrollView>
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
      {/* Floating Action Button for writing new log */}
      <TouchableOpacity
        style={[
          styles.fabBtn,
          {
            backgroundColor: theme === 'dark' ? activeColors.brandRed : activeColors.brandNavy,
          }
        ]}
        onPress={() => onOpenWriteForm()}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#ffffff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1.5,
  },
  iconOnlyBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortTextBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  teamFilterChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  writeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  writeBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  diaryCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    paddingBottom: 6,
  },
  ratingStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  starText: {
    color: '#FBC02D',
    fontSize: 13,
    fontWeight: 'bold',
  },
  outcomeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  outcomeBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
  },
  scoreboardArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  teamCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  teamNameText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  scoreCol: {
    marginHorizontal: 12,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  metaText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  photoContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    height: 120,
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 35,
  },
  modalHeaderDrag: {
    width: 40,
    height: 4,
    backgroundColor: '#C6C8CA',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '950',
    alignSelf: 'center',
    marginBottom: 15,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipBtnWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  teamHorizontalScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  modalCloseBtn: {
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  modalCloseBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  detailOverlay: {
    flex: 1,
  },
  detailHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1.5,
  },
  detailHeaderBtn: {
    padding: 8,
  },
  detailHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  menuDropdown: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 110,
    borderRadius: 8,
    borderWidth: 1.5,
    zIndex: 1000,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '800',
  },
  detailScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  detailPhotoCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
    height: 180,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  detailCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoNavBtnLeft: {
    left: 8,
  },
  photoNavBtnRight: {
    right: 8,
  },
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
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  photoDotActive: {
    backgroundColor: '#ffffff',
    width: 14,
  },
  detailCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  detailSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailSummaryMetaText: {
    fontSize: 11,
    fontWeight: '800',
  },
  detailOutcomeBadge: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detailOutcomeBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
  },
  detailScoreboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailTeamCol: {
    alignItems: 'center',
    flex: 1.5,
  },
  detailTeamName: {
    fontSize: 12.5,
    fontWeight: '950',
    marginTop: 6,
    textAlign: 'center',
  },
  detailScoreText: {
    fontSize: 26,
    fontWeight: '950',
    letterSpacing: 2,
    flex: 1,
    textAlign: 'center',
  },
  detailCardLabel: {
    fontSize: 12.5,
    fontWeight: '900',
    marginBottom: 10,
  },
  detailStarsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  detailSpendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailSpendingTotalText: {
    fontSize: 14,
    fontWeight: '950',
  },
  detailSpendingDivider: {
    height: 1,
    marginVertical: 12,
  },
  detailSpendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  detailSpendingRowLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailSpendingRowAmount: {
    fontSize: 12,
    fontWeight: '900',
  },
  detailThoughtsText: {
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  ratingTextLabel: {
    fontSize: 12,
    fontWeight: '850',
  },
  listTeamLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1.5,
  },
  listTeamRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flex: 1.5,
  },
  listTeamName: {
    fontSize: 12.5,
    fontWeight: '900',
    flex: 1,
  },
  listScoreBox: {
    backgroundColor: '#001C48',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  listScoreText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '950',
  },
  dashedDivider: {
    borderBottomWidth: 1.2,
    borderStyle: 'dashed',
    marginVertical: 10,
    width: '100%',
  },
  simplifiedCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  simLeftCol: {
    width: 90,
    justifyContent: 'center',
  },
  simDateText: {
    fontSize: 12.5,
    fontWeight: '900',
  },
  simStadiumText: {
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 2,
  },
  simVerticalLine: {
    width: 1.5,
    height: 36,
    marginHorizontal: 12,
  },
  simCenterCol: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  simRightCol: {
    width: 70,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  simTeamText: {
    fontSize: 12,
    fontWeight: '850',
    maxWidth: 45,
  },
  simScoreText: {
    fontSize: 12,
    fontWeight: '900',
  },
  simOutcomeBadge: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  simOutcomeBadgeText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900',
  },
  simStarsText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FBC02D',
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
  leagueSubTab: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leagueSubTabText: {
    fontSize: 12,
    fontWeight: '900',
  },
  teamFilterChipAll: {
    width: '100%',
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  teamFilterChipTextAll: {
    fontSize: 11.5,
    fontWeight: '900',
  },
  teamFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
  },
  teamFilterGridCell: {
    width: '32%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  teamFilterGridCellText: {
    fontSize: 10.5,
    fontWeight: '850',
    flex: 1,
  },
  filterResetBtn: {
    flex: 3,
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterResetBtnText: {
    fontSize: 13,
    fontWeight: '900',
  },
  filterApplyBtn: {
    flex: 7,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterApplyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  fabBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 999,
  },
});
