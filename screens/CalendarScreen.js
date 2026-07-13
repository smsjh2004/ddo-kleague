import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  Dimensions,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
} from 'react-native';
import MOCK_SCHEDULE from '../constants/schedule.json';
import { Colors } from '../constants/Colors';
import TeamBadge from '../components/TeamBadge';
import { getTodayString } from '../utils/date';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function CalendarScreen({
  theme = 'light',
  logs = [],
  myTeam,
  schedule = [],
  onWriteDiary,
  onViewDiaryDetail,
}) {
  const matchesSource = schedule && schedule.length > 0 ? schedule : MOCK_SCHEDULE;
  const todayStr = getTodayString();
  const [currentDate, setCurrentDate] = useState(new Date()); // Root baseline date
  const [selectedDay, setSelectedDay] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [activeMatch, setActiveMatch] = useState(null);
  // No myTeam yet -> default to showing everyone's schedule instead of an empty "my team" view
  const [viewMode, setViewMode] = useState(() => (myTeam && myTeam.trim() !== '' ? 'myteam' : 'all'));
  const [divisionFilter, setDivisionFilter] = useState('all'); // 'all' | 'K1' | 'K2'

  const activeColors = Colors[theme];
  const isDark = theme === 'dark';
  const cleanMyTeam = (myTeam || '').trim();
  // Light theme brand accent is navy, dark theme's is red - same swap used for the bottom tab bar in App.js
  const segmentActiveColor = isDark ? activeColors.brandRed : activeColors.brandNavy;

  const sheetTranslateY = React.useRef(new Animated.Value(0)).current;
  const sheetPanResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 20 || gestureState.vy > 0.2) {
          setSheetVisible(false);
          setTimeout(() => {
            sheetTranslateY.setValue(0);
          }, 300);
        } else {
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const isMatchOfSelectedTeams = (match) => {
    return !!cleanMyTeam && (match.home.trim() === cleanMyTeam || match.away.trim() === cleanMyTeam);
  };

  const getDDay = (matchDate) => {
    const baseline = new Date(todayStr);
    const target = new Date(matchDate);
    const diff = Math.ceil((target - baseline) / (1000 * 60 * 60 * 24));
    if (diff === 0) return '오늘!';
    return diff > 0 ? `D-${diff}` : '종료';
  };

  // Get next match of myTeam (D-Day countdown)
  const getNextMyTeamMatch = () => {
    if (!myTeam) return null;
    const cleanTeam = myTeam.trim();
    const futureMatches = matchesSource.filter((m) => {
      return m.date >= todayStr && (m.home.trim() === cleanTeam || m.away.trim() === cleanTeam);
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
    return futureMatches[0] || null;
  };

  const nextMyTeamMatch = getNextMyTeamMatch();

  // Calendar cell math helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11
  const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;

  const firstDayIndex = new Date(year, month, 1).getDay(); // weekday index (0-6)
  const lastDate = new Date(year, month + 1, 0).getDate(); // days in month
  const prevLastDate = new Date(year, month, 0).getDate(); // days in previous month

  // Filter matches of this visible month: "내 팀 경기만" narrows to favorite
  // teams, "전체 일정 보기" shows everything (optionally narrowed by division)
  const monthMatches = matchesSource.filter((match) => {
    if (!match.date.startsWith(monthStr)) return false;
    if (viewMode === 'myteam') return isMatchOfSelectedTeams(match);
    return divisionFilter === 'all' || match.league === divisionFilter;
  });

  // Filter visible list based on day click selection
  const dayFilteredMatches = selectedDay
    ? monthMatches.filter((m) => {
        const d = parseInt(m.date.split('-')[2]);
        return d === selectedDay;
      })
    : monthMatches;

  // "전체 일정 보기": bubble myTeam's matches to the top of the card list
  // (stable sort keeps everything else in its original order)
  const displayedMatches = viewMode === 'all'
    ? [...dayFilteredMatches].sort((a, b) => {
        const aFav = isMatchOfSelectedTeams(a) ? 0 : 1;
        const bFav = isMatchOfSelectedTeams(b) ? 0 : 1;
        return aFav - bFav;
      })
    : dayFilteredMatches;

  // Functional updates so these stay correct even when called from a
  // PanResponder ref created on an earlier render (swipe gesture below).
  const handlePrevMonth = () => {
    setSelectedDay(null);
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDay(null);
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Swipe left/right on the calendar card to move between months
  const swipePanResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) =>
        Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5,
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx < -40) {
          handleNextMonth();
        } else if (gestureState.dx > 40) {
          handlePrevMonth();
        }
      },
    })
  ).current;

  // Jump the calendar to a match's month and focus that day (used by the D-Day widget)
  const focusOnMatch = (match) => {
    const [y, m, d] = match.date.split('-').map(Number);
    setCurrentDate(new Date(y, m - 1, 1));
    setSelectedDay(d);
  };

  const handleCellClick = (dayNum, isCurrentMonth) => {
    if (!isCurrentMonth) return;
    setSelectedDay(selectedDay === dayNum ? null : dayNum);
  };

  const handleCardClick = (match) => {
    const matchLog = logs.find((l) =>
      l.date === match.date &&
      ((l.homeTeam === match.home && l.awayTeam === match.away) ||
       (l.homeTeam === match.away && l.awayTeam === match.home))
    );

    if (matchLog) {
      if (onViewDiaryDetail) {
        onViewDiaryDetail(matchLog.id);
      }
    } else {
      setActiveMatch(match);
      setSheetVisible(true);
    }
  };

  // Render Grid Cells
  const renderCalendarCells = () => {
    const cells = [];

    // 1. Prev month trailing cells
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevLastDate - i;
      cells.push(
        <View key={`prev-${dayNum}`} style={styles.dayCellContainer}>
          <Text style={[styles.dayText, styles.mutedText]}>{dayNum}</Text>
        </View>
      );
    }

    // 2. Current month cells
    for (let i = 1; i <= lastDate; i++) {
      const cellDayStr = `${monthStr}-${i.toString().padStart(2, '0')}`;
      const dayMatches = matchesSource.filter((m) => m.date === cellDayStr);
      const favMatch = dayMatches.find((m) => isMatchOfSelectedTeams(m));

      // "내 팀 경기만" mode: H/A badge for the favorite team's match that day
      let badgeType = ''; // 'H' or 'A'
      if (viewMode === 'myteam' && favMatch) {
        badgeType = favMatch.home.trim() === cleanMyTeam ? 'H' : 'A';
      }

      // "전체 일정 보기" mode: a dot for any match that day, a glowing red
      // dot instead if it's a favorite team's match
      const dayMatchesInDivision = divisionFilter === 'all'
        ? dayMatches
        : dayMatches.filter((m) => m.league === divisionFilter);
      const showAllModeDot = viewMode === 'all' && dayMatchesInDivision.length > 0;
      const showFavDot = showAllModeDot && !!favMatch;

      const isToday = cellDayStr === todayStr;
      const isSelected = selectedDay === i;
      const dayHasLog = logs.some((l) => l.date === cellDayStr);

      // Priority when a day is more than one thing at once: tapped selection
      // always wins (clearest, most immediate state), then "today", then a
      // recorded diary log - so states never fight for the same border/fill.
      let circleStyle = null;
      let dayTextStyle = { color: activeColors.textBody };
      if (isSelected) {
        circleStyle = { backgroundColor: activeColors.brandRed };
        dayTextStyle = { color: '#ffffff', fontWeight: '900' };
      } else if (isToday) {
        circleStyle = { borderWidth: 1.5, borderColor: activeColors.brandNavy };
        dayTextStyle = { color: activeColors.brandNavy, fontWeight: '900' };
      } else if (dayHasLog) {
        circleStyle = isDark
          ? { backgroundColor: 'rgba(251, 192, 45, 0.18)', borderWidth: 1, borderColor: '#FBC02D' }
          : { backgroundColor: '#FFFDF0', borderWidth: 1, borderColor: '#FBC02D' };
      }

      cells.push(
        <TouchableOpacity
          key={`curr-${i}`}
          style={styles.dayCellContainer}
          onPress={() => handleCellClick(i, true)}
          activeOpacity={0.7}
        >
          <View style={[styles.dayCircle, circleStyle]}>
            <Text style={[styles.dayText, dayTextStyle]}>
              {i}
            </Text>
          </View>
          {dayHasLog && (
            <View style={[styles.logBadge, { borderColor: activeColors.bgCard }]}>
              <Text style={styles.logBadgeEmoji}>👑</Text>
            </View>
          )}
          {badgeType !== '' && (
            <View style={[styles.haBadge, { backgroundColor: badgeType === 'H' ? (isDark ? '#475569' : '#001C48') : '#EE3224' }]}>
              <Text style={styles.haBadgeText}>{badgeType}</Text>
            </View>
          )}
          {showAllModeDot && (
            <View
              style={[
                styles.dotIndicator,
                showFavDot ? styles.dotIndicatorFav : { backgroundColor: activeColors.textMuted },
              ]}
            />
          )}
        </TouchableOpacity>
      );
    }

    // 3. Next month leading cells (pad to grid size 42)
    const totalCellsAdded = cells.length;
    const remainingCells = 42 - totalCellsAdded;
    for (let i = 1; i <= remainingCells; i++) {
      cells.push(
        <View key={`next-${i}`} style={styles.dayCellContainer}>
          <Text style={[styles.dayText, styles.mutedText]}>{i}</Text>
        </View>
      );
    }

    return cells;
  };

  // A match only counts as "over" once it's a past date, or today with a final
  // score already synced in - keeps same-day matches blocked until they finish.
  const hasMatchEnded = activeMatch && (
    activeMatch.date < todayStr ||
    (activeMatch.homeScore !== null && activeMatch.homeScore !== undefined &&
     activeMatch.awayScore !== null && activeMatch.awayScore !== undefined)
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* 내 팀 경기만 / 전체 일정 보기 세그먼트 토글 */}
        <View style={[styles.viewModeToggle, { backgroundColor: activeColors.bgTag, borderColor: activeColors.borderColor }]}>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'myteam' && [styles.viewModeBtnActive, { backgroundColor: activeColors.bgCard }]]}
            onPress={() => { setViewMode('myteam'); setSelectedDay(null); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.viewModeBtnText, { color: viewMode === 'myteam' ? segmentActiveColor : activeColors.textMuted }]}>
              내 팀 경기만
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'all' && [styles.viewModeBtnActive, { backgroundColor: activeColors.bgCard }]]}
            onPress={() => { setViewMode('all'); setSelectedDay(null); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.viewModeBtnText, { color: viewMode === 'all' ? segmentActiveColor : activeColors.textMuted }]}>
              전체 일정 보기
            </Text>
          </TouchableOpacity>
        </View>

        {/* 마이팀 미등록 안내 배너 */}
        {!myTeam && (
          <View style={[styles.teamNudgeBanner, { backgroundColor: 'rgba(238, 50, 36, 0.08)', borderColor: 'rgba(238, 50, 36, 0.2)' }]}>
            <Ionicons name="information-circle-outline" size={14} color={activeColors.brandRed} />
            <Text style={[styles.teamNudgeText, { color: activeColors.brandRed }]}>
              마이페이지에서 응원 구단을 등록하면 내 팀 경기만 모아볼 수 있어요!
            </Text>
          </View>
        )}

        {/* 디비전 필터 (전체 일정 모드에서만) */}
        {viewMode === 'all' && (
          <View style={styles.divisionFilterRow}>
            {[
              { key: 'all', label: '전체' },
              { key: 'K1', label: 'K리그 1' },
              { key: 'K2', label: 'K리그 2' },
              { key: '코리아컵', label: '코리아컵' },
            ].map((d) => {
              const isActive = divisionFilter === d.key;
              return (
                <TouchableOpacity
                  key={d.key}
                  style={[
                    styles.divisionPill,
                    { borderColor: activeColors.borderColor, backgroundColor: activeColors.bgTag },
                    isActive && { backgroundColor: activeColors.brandNavy, borderColor: 'transparent' },
                  ]}
                  onPress={() => { setDivisionFilter(d.key); setSelectedDay(null); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.divisionPillText, { color: isActive ? '#ffffff' : activeColors.textBody }]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Next Match D-Day Widget */}
        {viewMode === 'myteam' && nextMyTeamMatch && (
          <TouchableOpacity
            style={[styles.ddayWidget, { backgroundColor: activeColors.brandNavy }]}
            onPress={() => focusOnMatch(nextMyTeamMatch)}
            activeOpacity={0.85}
          >
            <View style={styles.ddayHeaderLeft}>
              <Text style={styles.ddayTitleText}>다음 경기까지</Text>
              <Text style={styles.ddayCountdownText}>{getDDay(nextMyTeamMatch.date)}</Text>
            </View>
            <View style={styles.ddayHeaderRight}>
              <Text style={styles.ddayMatchTeamsText}>
                {nextMyTeamMatch.home} VS {nextMyTeamMatch.away}
              </Text>
              <Text style={styles.ddayMatchMetaText}>
                {nextMyTeamMatch.date.replace(/-/g, '.')} {nextMyTeamMatch.time} | {nextMyTeamMatch.stadium}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Premium Calendar Card */}
        <View
          style={[styles.calendarCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}
          {...swipePanResponder.panHandlers}
        >
          {/* Calendar Header Navigation */}
          <View style={styles.calendarNavHeader}>
            <TouchableOpacity onPress={handlePrevMonth} style={[styles.navBtn, { backgroundColor: activeColors.bgTag }]}>
              <Ionicons name="chevron-back" size={16} color={activeColors.textBody} />
            </TouchableOpacity>
            <Text style={[styles.monthTitleText, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>
              {year}년 {(month + 1).toString().padStart(2, '0')}월
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={[styles.navBtn, { backgroundColor: activeColors.bgTag }]}>
              <Ionicons name="chevron-forward" size={16} color={activeColors.textBody} />
            </TouchableOpacity>
          </View>

          {/* Calendar Weekdays Row */}
          <View style={[styles.weekdaysRow, { borderBottomColor: activeColors.dividerColor }]}>
            <Text style={[styles.weekdayText, { color: '#EE3224' }]}>일</Text>
            <Text style={[styles.weekdayText, { color: activeColors.textMuted }]}>월</Text>
            <Text style={[styles.weekdayText, { color: activeColors.textMuted }]}>화</Text>
            <Text style={[styles.weekdayText, { color: activeColors.textMuted }]}>수</Text>
            <Text style={[styles.weekdayText, { color: activeColors.textMuted }]}>목</Text>
            <Text style={[styles.weekdayText, { color: activeColors.textMuted }]}>금</Text>
            <Text style={[styles.weekdayText, { color: isDark ? '#5B8DEF' : '#0047A0' }]}>토</Text>
          </View>

          {/* Calendar Days Grid */}
          <View style={styles.daysGrid}>
            {renderCalendarCells()}
          </View>
        </View>

        {/* Selected Matches List Section */}
        <View style={styles.listSection}>
          <View style={styles.listHeaderRow}>
            <Text style={[styles.listHeaderTitle, { color: activeColors.textBody }]}>
              {selectedDay ? `${year}년 ${month + 1}월 ${selectedDay}일 일정` : `${year}년 ${month + 1}월 전체 일정`}
            </Text>
            {selectedDay && (
              <TouchableOpacity
                onPress={() => setSelectedDay(null)}
                style={[styles.resetBtn, { backgroundColor: activeColors.bgTag }]}
              >
                <Text style={[styles.resetBtnText, { color: activeColors.textBody }]}>전체 보기</Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.matchCountBadge, { color: activeColors.textMuted }]}>
              {displayedMatches.length}경기
            </Text>
          </View>

          {displayedMatches.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
              <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>
                오늘은 잔디 구장이 쉬어가는 날! {'\n'}축구 대신 맛집이나 일지 구경은 어떠신가요?
              </Text>
            </View>
          ) : (
            displayedMatches.map((match, idx) => {
              const dday = getDDay(match.date);
              const matchLog = logs.find((l) =>
                l.date === match.date &&
                ((l.homeTeam === match.home && l.awayTeam === match.away) ||
                 (l.homeTeam === match.away && l.awayTeam === match.home))
              );
              return (
                <TouchableOpacity
                  key={`${match.date}-${idx}`}
                  style={[
                    styles.matchCard,
                    {
                      backgroundColor: activeColors.bgCard,
                      borderColor: activeColors.borderColor,
                    },
                    selectedDay && styles.cardHighlighted,
                  ]}
                  onPress={() => handleCardClick(match)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardMetaRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.leagueBadge, { backgroundColor: activeColors.bgTag }]}>
                        <Text style={[styles.leagueBadgeText, { color: activeColors.textBody }]}>
                          {match.league}리그 | {match.date.substring(5)}
                        </Text>
                      </View>
                      {viewMode === 'all' && isMatchOfSelectedTeams(match) && (
                        <View style={[styles.myTeamBadge, { backgroundColor: segmentActiveColor }]}>
                          <Ionicons name="star" size={9} color="#ffffff" />
                          <Text style={styles.myTeamBadgeText}>MY팀</Text>
                        </View>
                      )}
                      {matchLog && (
                        <View style={styles.loggedBadge}>
                          <Ionicons name="checkmark-circle" size={10} color="#10B981" />
                          <Text style={styles.loggedBadgeText}>기록 완료</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.kickoffText, { color: activeColors.textMuted }]}>
                      {match.time} Kickoff
                    </Text>
                  </View>

                  <View style={styles.teamsGridRow}>
                    <View style={styles.teamCol}>
                      <TeamBadge teamName={match.home} size={24} />
                      <Text style={[styles.teamNameLabel, { color: activeColors.textBody }]}>{match.home}</Text>
                    </View>
                    {match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null ? (
                      <Text style={[styles.vsText, { fontWeight: '700', fontSize: 16, color: activeColors.brandRed }]}>
                        {match.homeScore} : {match.awayScore}
                      </Text>
                    ) : (
                      <Text style={styles.vsText}>VS</Text>
                    )}
                    <View style={[styles.teamCol, { flexDirection: 'row-reverse' }]}>
                      <TeamBadge teamName={match.away} size={24} />
                      <Text style={[styles.teamNameLabel, { color: activeColors.textBody, marginRight: 8 }]}>{match.away}</Text>
                    </View>
                  </View>

                  <View style={[styles.cardFooterRow, { borderTopColor: activeColors.dividerColor }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="location-outline" size={12} color={activeColors.textMuted} />
                      <Text style={[styles.stadiumText, { color: activeColors.textMuted }]}>
                        {match.stadium}
                      </Text>
                    </View>
                    <View style={[styles.ddayBadge, { backgroundColor: dday === '오늘!' ? '#EE3224' : (isDark ? '#475569' : '#001C48') }]}>
                      <Text style={styles.ddayText}>{dday}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Match Action Sheet (Modal) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={sheetVisible}
        onRequestClose={() => setSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSheetVisible(false)}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              style={[styles.modalSheet, { backgroundColor: activeColors.bgApp, transform: [{ translateY: sheetTranslateY }] }]}
            >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 14, paddingBottom: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10 }} {...sheetPanResponder.panHandlers}>
              <View style={[styles.modalHeaderDrag, { marginBottom: 0 }]} />
            </View>
            
            {activeMatch && (
              <View style={styles.modalContent}>
                <View style={[styles.leagueBadge, { backgroundColor: activeColors.bgTag, alignSelf: 'center', marginBottom: 12 }]}>
                  <Text style={[styles.leagueBadgeText, { color: activeColors.textBody }]}>
                    {activeMatch.league}리그 | {activeMatch.date} ({activeMatch.time})
                  </Text>
                </View>

                <View style={styles.modalTeamsRow}>
                  <TeamBadge teamName={activeMatch.home} size={30} />
                  <Text style={[styles.modalTeamText, { color: activeColors.textBody }]}>{activeMatch.home}</Text>
                  {activeMatch.homeScore !== undefined && activeMatch.homeScore !== null && activeMatch.awayScore !== undefined && activeMatch.awayScore !== null ? (
                    <Text style={[styles.modalVsText, { fontWeight: '700', fontSize: 20, color: activeColors.brandRed, marginHorizontal: 12 }]}>
                      {activeMatch.homeScore} : {activeMatch.awayScore}
                    </Text>
                  ) : (
                    <Text style={styles.modalVsText}>VS</Text>
                  )}
                  <Text style={[styles.modalTeamText, { color: activeColors.textBody }]}>{activeMatch.away}</Text>
                  <TeamBadge teamName={activeMatch.away} size={30} />
                </View>

                    {(() => {
                  const existingDiary = logs.find((l) => l.matchId === activeMatch.id);
                  if (existingDiary) {
                    return (
                      <View style={{ gap: 10, marginTop: 15, alignItems: 'center', width: '100%' }}>
                        <TouchableOpacity
                          style={[styles.modalWriteBtn, { backgroundColor: isDark ? activeColors.brandRed : '#001C48' }]}
                          onPress={() => {
                            setSheetVisible(false);
                            onViewDiaryDetail(existingDiary.id);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.modalWriteBtnText}>직관 상세 보기</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  if (!hasMatchEnded) {
                    return (
                      <View style={[styles.upcomingNotice, { backgroundColor: isDark ? 'rgba(238, 50, 36, 0.08)' : 'rgba(0, 28, 72, 0.05)', borderColor: isDark ? 'rgba(238, 50, 36, 0.2)' : 'rgba(0, 28, 72, 0.12)' }]}>
                        <Ionicons name="time-outline" size={16} color={activeColors.textMuted} />
                        <Text style={[styles.upcomingNoticeText, { color: activeColors.textMuted }]}>
                          아직 경기 전이에요. 경기가 끝난 뒤에 직관일지를 작성할 수 있어요!
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <View style={{ gap: 10, marginTop: 15, alignItems: 'center', width: '100%' }}>
                      {activeMatch.date < todayStr && (
                        <Text style={[styles.pastAlertText, { color: activeColors.brandRed }]}>
                          작성된 직관일지가 없습니다.
                        </Text>
                      )}
                      <TouchableOpacity
                        style={[styles.modalWriteBtn, { backgroundColor: activeColors.brandRed }]}
                        onPress={() => {
                          setSheetVisible(false);
                          onWriteDiary({
                            matchId: activeMatch.id,
                            date: activeMatch.date,
                            stadium: activeMatch.stadium,
                            homeTeam: activeMatch.home,
                            awayTeam: activeMatch.away,
                            homeScore: activeMatch.homeScore,
                            awayScore: activeMatch.awayScore,
                          });
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.modalWriteBtnText}>직관일지 작성하기</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
              </View>
            )}
          </Animated.View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  viewModeToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  viewModeBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  viewModeBtnActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  viewModeBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  teamNudgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  teamNudgeText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '700',
    lineHeight: 14,
  },
  divisionFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  divisionPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  divisionPillText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  calendarCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: '900',
  },
  monthTitleText: {
    fontSize: 15,
    fontWeight: '900',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    paddingBottom: 6,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCellContainer: {
    width: '14.28%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
    position: 'relative',
  },
  dayText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  mutedText: {
    color: '#CBD5E1',
    opacity: 0.5,
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haBadge: {
    position: 'absolute',
    bottom: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  logBadge: {
    position: 'absolute',
    top: 5,
    right: 9,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    backgroundColor: '#FBC02D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBadgeEmoji: {
    fontSize: 8,
    lineHeight: 9,
  },
  dotIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotIndicatorFav: {
    backgroundColor: '#EE3224',
    shadowColor: '#EE3224',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
  haBadgeText: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: '900',
  },
  listSection: {
    marginTop: 20,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    flex: 1,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  resetBtnText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  matchCountBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  matchCard: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardHighlighted: {
    borderColor: '#EE3224',
    borderWidth: 1.8,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leagueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  leagueBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  kickoffText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  teamsGridRow: {
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
  teamNameLabel: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  vsText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#EE3224',
    marginHorizontal: 16,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  stadiumText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ddayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ddayText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
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
  modalContent: {
    alignItems: 'center',
    width: '100%',
  },
  modalTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 10,
  },
  modalTeamText: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalVsText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#EE3224',
  },
  modalStadiumText: {
    fontSize: 12,
    fontWeight: '600',
    marginVertical: 6,
  },
  futureAlertBox: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(238, 50, 36, 0.08)',
    marginTop: 15,
    alignItems: 'center',
  },
  futureAlertText: {
    color: '#EE3224',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  pastWriteBox: {
    width: '100%',
    alignItems: 'center',
    marginTop: 15,
  },
  pastAlertText: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  upcomingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginTop: 15,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  upcomingNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  modalWriteBtn: {
    width: '80%',
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  modalWriteBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '900',
  },
  modalCloseBtn: {
    width: '100%',
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  ddayWidget: {
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  ddayHeaderLeft: {
    alignItems: 'flex-start',
  },
  ddayTitleText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 9.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  ddayCountdownText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '950',
  },
  ddayHeaderRight: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: 15,
  },
  ddayMatchTeamsText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  ddayMatchMetaText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'right',
  },
  logIndicatorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
    marginTop: 2,
    alignSelf: 'center',
  },
  loggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  myTeamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  myTeamBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  loggedBadgeText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '900',
  },
});
