import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Modal,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { Colors } from '../constants/Colors';
import { webContentWidth } from '../constants/sharedStyles';
import { getTodayString } from '../utils/date';
import { formatWon, formatWonShort } from '../utils/format';
import useSwipeDismissModal from '../hooks/useSwipeDismissModal';
import { showAlert } from '../utils/appAlert';
import AdBanner from '../components/AdBanner';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const getCategories = (isDark) => ({
  ticket: { label: '티켓', color: '#FFA07A' },
  food: { label: '식음료', color: '#EE3224' },
  transport: { label: '교통', color: '#64748B' },
  goods: { label: '굿즈', color: '#FBC02D' },
  etc: { label: '기타', color: '#94A3B8' },
});

export default function WalletScreen({
  theme = 'light',
  expenses = [],
  logs = [],
  isAdFree = false,
  onSaveExpense,
  onDeleteExpense,
}) {
  const [activeSubTab, setActiveSubTab] = useState('summary'); // summary, history
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const minYear = new Date().getFullYear(); // don't let 이전달 browse before the current year
  
  // Register / Edit Overlay States
  const [formVisible, setFormVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const [formMatchId, setFormMatchId] = useState('');
  const [formCategory, setFormCategory] = useState('ticket');
  const [formAmount, setFormAmount] = useState('');
  const [formMemo, setFormMemo] = useState('');

  // Dropdown match list state
  const [matchDropdownVisible, setMatchDropdownVisible] = useState(false);

  // Tapped bar in the monthly spend chart - shows the exact amount as a
  // tooltip (the bar's own label is rounded to 만/천 units for space).
  const [tappedMonth, setTappedMonth] = useState(null);
  const [chartPlotWidth, setChartPlotWidth] = useState(0);

  const activeColors = Colors[theme];
  const CATEGORIES = getCategories(theme === 'dark');

  const { translateY: expenseTranslateY, panResponder: expensePanResponder } =
    useSwipeDismissModal(() => setFormVisible(false));

  // Month navigation
  const isAtMinMonth = currentYear === minYear && currentMonth === 1;

  const handlePrevMonth = () => {
    if (isAtMinMonth) return;
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Calculations for Summary
  const totalSpent = expenses.reduce((sum, item) => sum + parseInt(item.amount || 0), 0);
  const recordedMatchesCount = logs.length;
  const avgSpentPerMatch = recordedMatchesCount > 0 ? Math.round(totalSpent / recordedMatchesCount) : 0;

  // Category sums
  const catSums = { ticket: 0, food: 0, transport: 0, goods: 0, etc: 0 };
  expenses.forEach((item) => {
    if (catSums[item.category] !== undefined) {
      catSums[item.category] += parseInt(item.amount || 0);
    }
  });

  const maxCatSum = Math.max(...Object.values(catSums), 1);

  // Monthly spend chart - buckets by month number the same way (not per-year)
  // as AnalysisScreen's "월별 직관 횟수" card, reusing its vertical bar look.
  const currentMonthNum = parseInt(getTodayString().split('-')[1]);
  const monthlyExpenseData = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0 }));
  expenses.forEach((item) => {
    if (item.date) {
      const m = parseInt(item.date.split('-')[1]);
      if (m >= 1 && m <= 12) {
        monthlyExpenseData[m - 1].amount += parseInt(item.amount || 0);
      }
    }
  });
  const maxMonthlyExpense = Math.max(...monthlyExpenseData.map((d) => d.amount), 1);
  // Top padding in the 120px chart canvas so the max-value point's circle
  // (radius 4) doesn't get clipped by the SVG's top edge.
  const CHART_TOP_PAD = 8;

  // Month-specific list filtering
  const visibleExpenses = expenses.filter((item) => {
    if (!item.date) return false;
    const [y, m] = item.date.split('-');
    return parseInt(y) === currentYear && parseInt(m) === currentMonth;
  });

  const monthlySpentTotal = visibleExpenses.reduce((sum, item) => sum + parseInt(item.amount || 0), 0);

  // Form Management
  const openRegisterForm = (expense = null) => {
    if (expense) {
      setEditingExpense(expense);
      setFormMatchId(expense.matchId || '');
      setFormCategory(expense.category || 'ticket');
      setFormAmount(expense.amount.toString());
      setFormMemo(expense.memo || '');
    } else {
      setEditingExpense(null);
      setFormMatchId('');
      setFormCategory('ticket');
      setFormAmount('');
      setFormMemo('');
    }
    setFormVisible(true);
  };

  const handleFormSave = () => {
    if (!formAmount.trim() || isNaN(formAmount)) {
      showAlert('알림', '올바른 지출 금액을 입력해주세요.');
      return;
    }
    const selectedLog = logs.find((l) => l.id === formMatchId);
    const dateStr = selectedLog ? selectedLog.date : getTodayString();
    const matchTitle = selectedLog ? `${selectedLog.homeTeam} VS ${selectedLog.awayTeam}` : 'K리그 직관';

    const savedData = {
      id: editingExpense ? editingExpense.id : Date.now().toString(),
      matchId: formMatchId || null,
      matchTitle,
      date: dateStr,
      category: formCategory,
      amount: parseInt(formAmount),
      memo: formMemo.trim(),
    };

    onSaveExpense(savedData);
    setFormVisible(false);
  };

  // Digits only - keyboardType="numeric" only changes the on-screen keyboard, doesn't block paste/physical input
  const handleAmountChange = (text) => {
    setFormAmount(text.replace(/[^0-9]/g, ''));
  };

  // Swipe-to-reveal edit/delete on each history card, replacing the old "..." bottom sheet.
  // One Animated.Value + PanResponder per row, cached by id so they survive re-renders.
  const SWIPE_ACTION_WIDTH = 144;
  const swipeAnims = React.useRef({}).current;
  const swipeResponders = React.useRef({}).current;
  const openSwipeIdRef = React.useRef(null);

  const getSwipeAnim = (id) => {
    if (!swipeAnims[id]) swipeAnims[id] = new Animated.Value(0);
    return swipeAnims[id];
  };

  const closeSwipeRow = (id) => {
    Animated.spring(getSwipeAnim(id), { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    if (openSwipeIdRef.current === id) openSwipeIdRef.current = null;
  };

  const openSwipeRow = (id) => {
    if (openSwipeIdRef.current && openSwipeIdRef.current !== id) {
      closeSwipeRow(openSwipeIdRef.current);
    }
    Animated.spring(getSwipeAnim(id), { toValue: -SWIPE_ACTION_WIDTH, useNativeDriver: true, bounciness: 0 }).start();
    openSwipeIdRef.current = id;
  };

  const getSwipeResponder = (id) => {
    if (!swipeResponders[id]) {
      let startValue = 0;
      swipeResponders[id] = PanResponder.create({
        onMoveShouldSetPanResponder: (evt, gestureState) =>
          Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5,
        onPanResponderGrant: () => {
          getSwipeAnim(id).stopAnimation((value) => { startValue = value; });
        },
        onPanResponderMove: (evt, gestureState) => {
          const next = Math.min(0, Math.max(-SWIPE_ACTION_WIDTH, startValue + gestureState.dx));
          getSwipeAnim(id).setValue(next);
        },
        onPanResponderRelease: (evt, gestureState) => {
          const shouldOpen = gestureState.dx < -SWIPE_ACTION_WIDTH / 2 || gestureState.vx < -0.5;
          if (shouldOpen) openSwipeRow(id); else closeSwipeRow(id);
        },
      });
    }
    return swipeResponders[id];
  };

  const handleSwipeDelete = (item) => {
    closeSwipeRow(item.id);
    showAlert('지출 내역 삭제', '이 지출 명세를 영구적으로 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => onDeleteExpense(item.id) },
    ]);
  };

  // One-time peek animation on the first card so users discover the swipe action exists.
  const swipeHintShownRef = React.useRef(false);
  useEffect(() => {
    if (!swipeHintShownRef.current && activeSubTab === 'history' && visibleExpenses.length > 0) {
      swipeHintShownRef.current = true;
      const firstId = visibleExpenses[0].id;
      const timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(getSwipeAnim(firstId), { toValue: -48, duration: 220, useNativeDriver: true }),
          Animated.timing(getSwipeAnim(firstId), { toValue: 0, duration: 220, delay: 450, useNativeDriver: true }),
        ]).start();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeSubTab, visibleExpenses.length]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      
      {/* Sub Tabs Toggle Bar */}
      <View style={[styles.subTabsContainer, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'summary' && [styles.subTabActive, { borderColor: activeColors.brandNavy }]]}
          onPress={() => setActiveSubTab('summary')}
        >
          <Text style={[styles.subTabText, { color: activeSubTab === 'summary' ? activeColors.brandNavy : activeColors.textMuted }]}>
            지출요약
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'history' && [styles.subTabActive, { borderColor: activeColors.brandNavy }]]}
          onPress={() => setActiveSubTab('history')}
        >
          <Text style={[styles.subTabText, { color: activeSubTab === 'history' ? activeColors.brandNavy : activeColors.textMuted }]}>
            지출내역
          </Text>
        </TouchableOpacity>
      </View>

      <AdBanner hidden={isAdFree} />

      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* SUB TAB 1: SUMMARY */}
        {activeSubTab === 'summary' && (
          <View style={styles.tabContent}>
            {/* Total balance card */}
            <View style={[styles.balanceCard, { backgroundColor: activeColors.brandNavy }]}>
              <Text style={styles.balanceLabel}>직관에 사용한 총 누적 예산</Text>
              <Text style={styles.balanceAmountText}>{formatWon(totalSpent)}</Text>
              
              <View style={styles.balanceSubRow}>
                <View style={styles.balanceSubItem}>
                  <Text style={styles.balanceSubLabel}>경기당 평균</Text>
                  <Text style={styles.balanceSubVal}>{formatWon(avgSpentPerMatch)}</Text>
                </View>
                <View style={styles.balanceSubDivider} />
                <View style={styles.balanceSubItem}>
                  <Text style={styles.balanceSubLabel}>기록 경기수</Text>
                  <Text style={styles.balanceSubVal}>{recordedMatchesCount}경기</Text>
                </View>
              </View>
            </View>

            {/* Category breakdown bar list */}
            <View style={[styles.card, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
              <Text style={[styles.cardTitle, { color: activeColors.brandNavy }]}>카테고리별 지출 요약</Text>
              {Object.keys(CATEGORIES).map((key) => {
                const sum = catSums[key] || 0;
                const progressWidth = maxCatSum > 0 ? (sum / maxCatSum) * 100 : 0;
                return (
                  <View key={key} style={styles.categoryRow}>
                    <View style={styles.categoryLabelRow}>
                      <Text style={[styles.categoryLabelText, { color: activeColors.textBody }]}>
                        {CATEGORIES[key].label}
                      </Text>
                      <Text style={[styles.categoryValText, { color: activeColors.brandNavy }]}>
                        {formatWon(sum)}
                      </Text>
                    </View>
                    <View style={[styles.barTrack, { backgroundColor: activeColors.bgTag }]}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${progressWidth}%`,
                            backgroundColor: CATEGORIES[key].color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Monthly spend chart */}
            <View style={[styles.card, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
              <Text style={[styles.cardTitle, { color: activeColors.brandNavy }]}>월별 지출</Text>
              {(() => {
                const getYTicks = () => {
                  const ticks = [];
                  const step = Math.ceil(maxMonthlyExpense / 4);
                  for (let i = maxMonthlyExpense; i >= 0; i -= step) {
                    ticks.push(Math.round(i));
                  }
                  if (ticks[ticks.length - 1] !== 0) ticks.push(0);
                  return Array.from(new Set(ticks)).sort((a, b) => b - a);
                };
                const yTicks = getYTicks();
                const accentColor = theme === 'dark' ? activeColors.brandRed : activeColors.brandNavy;
                const dimTint = theme === 'dark' ? '#EE3224' : '#001C48';

                return (
                  <View style={styles.mChartWrapper}>
                    <View style={{ flex: 1 }}>
                      <View
                        style={styles.mChartBarsArea}
                        onLayout={(e) => setChartPlotWidth(e.nativeEvent.layout.width)}
                      >
                        {yTicks.map((tick) => (
                          <View
                            key={`grid-${tick}`}
                            style={[
                              styles.mChartGridLine,
                              {
                                borderTopColor: activeColors.dividerColor,
                                bottom: maxMonthlyExpense > 0 ? `${(tick / maxMonthlyExpense) * 100}%` : 0,
                              },
                            ]}
                          />
                        ))}

                        {/* Line/points drawn via an absolute SVG overlay (pointerEvents="none" so
                            taps still reach the per-month touch columns below it), positioned in
                            the same 120px-tall coordinate space the grid lines/columns use. */}
                        {chartPlotWidth > 0 && (
                          <Svg
                            width={chartPlotWidth}
                            height={120}
                            style={{ position: 'absolute', left: 0, top: 0 }}
                            pointerEvents="none"
                          >
                            <Polyline
                              points={monthlyExpenseData.map((d, i) => {
                                const x = (i + 0.5) * (chartPlotWidth / 12);
                                const y = 120 - (maxMonthlyExpense > 0 ? (d.amount / maxMonthlyExpense) * (120 - CHART_TOP_PAD) : 0);
                                return `${x},${y}`;
                              }).join(' ')}
                              fill="none"
                              stroke={accentColor}
                              strokeWidth={2}
                            />
                            {monthlyExpenseData.filter((d) => d.amount > 0).map((d) => {
                              const i = d.month - 1;
                              const x = (i + 0.5) * (chartPlotWidth / 12);
                              const y = 120 - (maxMonthlyExpense > 0 ? (d.amount / maxMonthlyExpense) * (120 - CHART_TOP_PAD) : 0);
                              const isCurrentMonth = d.month === currentMonthNum;
                              return (
                                <Circle
                                  key={d.month}
                                  cx={x}
                                  cy={y}
                                  r={4}
                                  fill={isCurrentMonth ? accentColor : dimTint}
                                />
                              );
                            })}
                          </Svg>
                        )}

                        <View style={styles.mChartBarsRow}>
                          {monthlyExpenseData.map((d) => {
                            const pointHeight = maxMonthlyExpense > 0 ? (d.amount / maxMonthlyExpense) * (120 - CHART_TOP_PAD) : 0;
                            const hasAmount = d.amount > 0;
                            const isCurrentMonth = d.month === currentMonthNum;
                            return (
                              <TouchableOpacity
                                key={d.month}
                                style={styles.mPointCol}
                                activeOpacity={hasAmount ? 0.6 : 1}
                                disabled={!hasAmount}
                                onPress={() => setTappedMonth((prev) => (prev === d.month ? null : d.month))}
                              >
                                {/* Amount is hidden until tapped - no always-on label above the point. */}
                                {hasAmount && tappedMonth === d.month && (
                                  <View style={[styles.mTooltipChip, { backgroundColor: activeColors.brandNavy, bottom: pointHeight + 10 }]}>
                                    <Text style={styles.mTooltipChipText} numberOfLines={1}>{formatWon(d.amount)}</Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.mMonthLabelsRow}>
                        {monthlyExpenseData.map((d) => {
                          const isCurrentMonth = d.month === currentMonthNum;
                          return (
                            <Text
                              key={d.month}
                              style={[
                                styles.mMonthLabelText,
                                { color: isCurrentMonth ? accentColor : activeColors.textMuted },
                                isCurrentMonth && { fontWeight: '900' },
                              ]}
                            >
                              {d.month}
                              {isCurrentMonth ? ' ●' : ''}
                            </Text>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>
          </View>
        )}

        {/* SUB TAB 2: HISTORY */}
        {activeSubTab === 'history' && (
          <View style={styles.tabContent}>
            
            {/* Month Carousel Selector */}
            <View style={[styles.carouselContainer, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.carouselBtn} disabled={isAtMinMonth}>
                <Text style={[styles.carouselBtnText, { color: isAtMinMonth ? activeColors.borderColor : activeColors.textBody }]}>◀</Text>
              </TouchableOpacity>
              <Text style={[styles.carouselMonthText, { color: activeColors.brandNavy }]}>
                {currentYear}년 {currentMonth}월 지출
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.carouselBtn}>
                <Text style={[styles.carouselBtnText, { color: activeColors.textBody }]}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Monthly Total Display */}
            <View style={[styles.monthlyTotalCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
              <Text style={[styles.monthlyTotalLabel, { color: activeColors.textMuted }]}>이번 달 사용한 금액</Text>
              <Text style={[styles.monthlyTotalAmount, { color: activeColors.brandRed }]}>
                {formatWon(monthlySpentTotal)}
              </Text>
            </View>

            {/* Thin Expense List */}
            {visibleExpenses.length === 0 ? (
              <View style={[styles.card, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor, padding: 30, alignItems: 'center' }]}>
                <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>
                  이번 달에 기록된 지출 명세가 없습니다.
                </Text>
              </View>
            ) : (
              visibleExpenses.map((item) => {
                return (
                  <View key={item.id} style={styles.swipeRowContainer}>
                    {/* Edit/delete buttons revealed behind the card when swiped left */}
                    <View style={styles.swipeActionsRow}>
                      <TouchableOpacity
                        style={[styles.swipeActionBtn, { backgroundColor: activeColors.bgTag }]}
                        onPress={() => {
                          closeSwipeRow(item.id);
                          openRegisterForm(item);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="create-outline" size={18} color={activeColors.textBody} />
                        <Text style={[styles.swipeActionText, { color: activeColors.textBody }]}>수정</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.swipeActionBtn, { backgroundColor: '#EE3224' }]}
                        onPress={() => handleSwipeDelete(item)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ffffff" />
                        <Text style={[styles.swipeActionText, { color: '#ffffff' }]}>삭제</Text>
                      </TouchableOpacity>
                    </View>

                    <Animated.View
                      {...getSwipeResponder(item.id).panHandlers}
                      style={[
                        styles.thinCard,
                        { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor },
                        { transform: [{ translateX: getSwipeAnim(item.id) }] },
                      ]}
                    >
                      {/* Tapping the card toggles the same swipe-actions reveal as
                          swiping left does - two ways to reach the same 수정/삭제 menu. */}
                      <TouchableOpacity
                        style={styles.thinCardTouchable}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (openSwipeIdRef.current === item.id) {
                            closeSwipeRow(item.id);
                          } else {
                            openSwipeRow(item.id);
                          }
                        }}
                      >
                        <View style={styles.thinLeft}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                            <Ionicons name="calendar-outline" size={10} color={activeColors.textMuted} />
                            <Text style={[styles.thinDateText, { color: activeColors.textMuted, marginBottom: 0 }]}>
                              {item.date} ({item.matchTitle})
                            </Text>
                          </View>
                          <Text style={[styles.thinDescText, { color: activeColors.textBody }]}>
                            {CATEGORIES[item.category].label} {item.memo ? `| ${item.memo}` : ''}
                          </Text>
                        </View>
                        <Text style={[styles.thinAmountText, { color: activeColors.brandNavy, marginLeft: 12 }]}>
                          {formatWon(item.amount)}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                );
              })
            )}
          </View>
        )}

      </ScrollView>

      {/* FAB Add Button (available in both tabs) */}
      <TouchableOpacity
        style={[styles.fabBtn, { backgroundColor: activeColors.brandNavy }]}
        onPress={() => openRegisterForm(null)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabBtnText}>+</Text>
      </TouchableOpacity>

      {/* Expense Form Modal (Register / Edit) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={formVisible}
        onRequestClose={() => setFormVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalSheet, { backgroundColor: activeColors.bgApp, transform: [{ translateY: expenseTranslateY }] }]}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 14, paddingBottom: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10 }} {...expensePanResponder.panHandlers}>
              <View style={[styles.modalHeaderDrag, { marginBottom: 0 }]} />
            </View>
            <Text style={[styles.modalTitle, { color: activeColors.brandNavy }]}>
              {editingExpense ? '지출 내역 수정' : '직관 지출 등록'}
            </Text>

            {/* Match Selection Dropdown Mock */}
            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: activeColors.textBody }]}>관련 경기 (선택사항)</Text>
              {logs.length === 0 ? (
                <View style={styles.noMatchesAlert}>
                  <Text style={{ color: activeColors.textMuted, fontSize: 11, fontWeight: '700' }}>
                    등록된 직관일지가 없어요. 경기 연결 없이 지출만 등록할 수 있어요.
                  </Text>
                </View>
              ) : (
                <View style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={[styles.dropdownBtn, { backgroundColor: activeColors.bgTag }]}
                    onPress={() => setMatchDropdownVisible(!matchDropdownVisible)}
                  >
                    <Text style={{ color: formMatchId ? activeColors.textBody : activeColors.textMuted, fontSize: 12.5, fontWeight: '700' }}>
                      {formMatchId ? (() => {
                        const m = logs.find((l) => l.matchId === formMatchId || l.id === formMatchId);
                        return m ? `${m.date} ${m.homeTeam} vs ${m.awayTeam}` : '선택 안 함';
                      })() : '선택 안 함 (경기 연결 없이 등록)'}
                    </Text>
                    <Ionicons name={matchDropdownVisible ? 'chevron-up' : 'chevron-down'} size={15} color={activeColors.textBody} />
                  </TouchableOpacity>

                  {/* Dropdown Menu List Overlay */}
                  {matchDropdownVisible && (
                    <View style={[styles.dropdownList, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
                      <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled={true}>
                        <TouchableOpacity
                          style={[styles.dropdownItem, { borderBottomColor: activeColors.borderColor }]}
                          onPress={() => {
                            setFormMatchId('');
                            setMatchDropdownVisible(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: activeColors.textMuted }]}>
                            선택 안 함
                          </Text>
                        </TouchableOpacity>
                        {logs.map((m) => (
                          <TouchableOpacity
                            key={m.matchId || m.id}
                            style={[styles.dropdownItem, { borderBottomColor: activeColors.borderColor }]}
                            onPress={() => {
                              setFormMatchId(m.matchId || m.id);
                              setMatchDropdownVisible(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: activeColors.textBody }]}>
                              {m.date} {m.homeTeam} vs {m.awayTeam}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Category Option Selector */}
            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: activeColors.textBody }]}>지출 항목 *</Text>
              <View style={styles.chipsRow}>
                {Object.keys(CATEGORIES).map((key) => {
                  const cat = CATEGORIES[key];
                  const isActive = formCategory === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.chipBtn,
                        { backgroundColor: activeColors.bgTag, borderColor: activeColors.borderColor },
                        isActive && { borderColor: cat.color, backgroundColor: cat.color + '15' }
                      ]}
                      onPress={() => setFormCategory(key)}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: activeColors.textBody },
                        isActive && { color: cat.color, fontWeight: '900' }
                      ]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Amount input */}
            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: activeColors.textBody }]}>지출 금액 *</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: activeColors.bgInput, color: activeColors.textBody, borderColor: activeColors.borderColor }]}
                placeholder="금액을 입력하세요 (원)"
                placeholderTextColor={activeColors.textMuted}
                keyboardType="numeric"
                value={formAmount}
                onChangeText={handleAmountChange}
              />
            </View>

            {/* Memo input */}
            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: activeColors.textBody }]}>메모 (선택)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: activeColors.bgInput, color: activeColors.textBody, borderColor: activeColors.borderColor }]}
                placeholder="지출 관련 메모를 적어주세요"
                placeholderTextColor={activeColors.textMuted}
                value={formMemo}
                onChangeText={setFormMemo}
              />
            </View>

            {/* Actions */}
            <View style={styles.formActionsRow}>
              {editingExpense ? (
                <>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { backgroundColor: activeColors.bgTag }]}
                    onPress={() => setFormVisible(false)}
                  >
                    <Text style={[styles.cancelBtnText, { color: activeColors.textBody }]}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: activeColors.brandNavy }]}
                    onPress={handleFormSave}
                  >
                    <Text style={styles.actionBtnText}>수정 완료</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { backgroundColor: activeColors.bgTag }]}
                    onPress={() => setFormVisible(false)}
                  >
                    <Text style={[styles.cancelBtnText, { color: activeColors.textBody }]}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: activeColors.brandNavy }]}
                    onPress={handleFormSave}
                    disabled={logs.length === 0}
                  >
                    <Text style={styles.actionBtnText}>지출 등록</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

          </Animated.View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  subTabsContainer: {
    height: 48,
    flexDirection: 'row',
    borderBottomWidth: 1.5,
  },
  subTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderColor: 'transparent',
  },
  subTabActive: {
    borderBottomWidth: 3,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '800',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  tabContent: {
    width: '100%',
  },
  balanceCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10.5,
    fontWeight: '700',
  },
  balanceAmountText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    marginVertical: 8,
  },
  balanceSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 10,
    marginTop: 6,
  },
  balanceSubItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceSubLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
  },
  balanceSubVal: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  balanceSubDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  card: {
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
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 15,
  },
  mChartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    width: '100%',
  },
  mChartBarsArea: {
    width: '100%',
    height: 120,
    position: 'relative',
  },
  mChartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    height: 20,
  },
  mChartBarsRow: {
    flexDirection: 'row',
    width: '100%',
    height: 120,
  },
  mPointCol: {
    flex: 1,
    height: '100%',
    position: 'relative',
  },
  mMonthLabelsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 6,
  },
  mTooltipChip: {
    position: 'absolute',
    alignSelf: 'center',
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 10,
    elevation: 10,
  },
  mTooltipChipText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    flexShrink: 0,
  },
  mMonthLabelText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9.5,
    fontWeight: '800',
  },
  categoryRow: {
    marginBottom: 12,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryLabelText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  categoryValText: {
    fontSize: 12,
    fontWeight: '900',
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    width: '100%',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  carouselContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1.5,
    borderRadius: 10,
    marginBottom: 12,
  },
  carouselBtn: {
    padding: 6,
  },
  carouselBtnText: {
    fontSize: 11,
    fontWeight: '900',
  },
  carouselMonthText: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  monthlyTotalCard: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  monthlyTotalLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  monthlyTotalAmount: {
    fontSize: 20,
    fontWeight: '900',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  thinCard: {
    borderWidth: 1.5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thinCardTouchable: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thinLeft: {
    flex: 1,
  },
  thinDateText: {
    fontSize: 9.5,
    fontWeight: '600',
    marginBottom: 3,
  },
  thinDescText: {
    fontSize: 12,
    fontWeight: '800',
  },
  thinAmountText: {
    fontSize: 13,
    fontWeight: '900',
  },
  swipeRowContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  swipeActionsRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
  },
  swipeActionBtn: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  swipeActionText: {
    fontSize: 10,
    fontWeight: '800',
  },
  fabBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 99,
  },
  fabBtnText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    ...webContentWidth,
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
    fontWeight: '900',
    alignSelf: 'center',
    marginBottom: 15,
  },
  formSection: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 8,
  },
  noMatchesAlert: {
    padding: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.05)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.2)',
  },
  dropdownBtn: {
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    borderWidth: 1.5,
    borderRadius: 8,
    zIndex: 999,
    padding: 6,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  formInput: {
    height: 44,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: '700',
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  saveBtn: {
    flex: 2,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
