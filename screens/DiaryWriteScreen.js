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
  Image,
  Animated,
  Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LEAGUE_TEAMS, TEAM_STADIUMS } from '../constants/TeamData';
import { Colors } from '../constants/Colors';
import { webContentWidth } from '../constants/sharedStyles';
import TeamBadge from '../components/TeamBadge';
import { getRefereeStatus } from '../utils/refereeStatus';
import { getTodayString, buildMonthGrid } from '../utils/date';
import useSwipeDismissModal from '../hooks/useSwipeDismissModal';
import { showAlert } from '../utils/appAlert';
import GoodsModal from './GoodsModal';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function DiaryWriteScreen({
  theme = 'light',
  onSave,
  onCancel,
  autofillData,
  clearAutofill,
  editLogData,
  existingExpenses,
  goods = [],
  existingGoodsIds = [],
  onSaveGoods,
  isPremium = false,
  friends = [],
}) {
  const [step, setStep] = useState(1);
  const [newGoodsModalVisible, setNewGoodsModalVisible] = useState(false);
  
  // Form State
  const [homeScore, setHomeScore] = useState('0');
  const [awayScore, setAwayScore] = useState('0');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [date, setDate] = useState(getTodayString());
  const [stadium, setStadium] = useState('');
  const [rating, setRating] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [review, setReview] = useState('');
  const [companionChip, setCompanionChip] = useState('혼관'); // 혼관/친구/가족/연인/기타
  const [customCompanionText, setCustomCompanionText] = useState('');
  // Each slot is either a friend picked from the selector or a manually-typed
  // name - { id, mode: 'friend'|'custom', friendId, customText }.
  const [companionSlots, setCompanionSlots] = useState([]);
  const [openSlotId, setOpenSlotId] = useState(null);

  const addCompanionSlot = () => {
    setCompanionSlots((prev) => [
      ...prev,
      { id: 'slot-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), mode: 'friend', friendId: null, customText: '' },
    ]);
  };
  const updateCompanionSlot = (id, patch) => {
    setCompanionSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const removeCompanionSlot = (id) => {
    setCompanionSlots((prev) => prev.filter((s) => s.id !== id));
    setOpenSlotId((prev) => (prev === id ? null : prev));
  };
  const [weather, setWeather] = useState('☀️맑음');
  const [selectedGoodsIds, setSelectedGoodsIds] = useState([]);
  const [goodsPickerVisible, setGoodsPickerVisible] = useState(false);
  const [refereeScore, setRefereeScore] = useState(50);
  const [sliderWidth, setSliderWidth] = useState(250);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [pickerCalendarDate, setPickerCalendarDate] = useState(new Date());

  const openDatePicker = () => {
    let initialDate = new Date();
    if (date.trim()) {
      const parsed = new Date(date.trim());
      if (!isNaN(parsed.getTime())) {
        initialDate = parsed;
      }
    }
    setPickerCalendarDate(initialDate);
    setDatePickerVisible(true);
  };

  const renderPickerCalendarCells = () => {
    const year = pickerCalendarDate.getFullYear();
    const month = pickerCalendarDate.getMonth();
    const { firstDayIndex, lastDate, prevLastDate, monthStr } = buildMonthGrid(year, month);

    const cells = [];

    // 1. Prev month trailing cells
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevLastDate - i;
      cells.push(
        <View key={`prev-${dayNum}`} style={{ width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: activeColors.textMuted, opacity: 0.3, fontSize: 12 }}>{dayNum}</Text>
        </View>
      );
    }

    // 2. Current month cells
    for (let i = 1; i <= lastDate; i++) {
      const dayStr = `${monthStr}-${i.toString().padStart(2, '0')}`;
      const isSelected = date === dayStr;
      
      cells.push(
        <TouchableOpacity
          key={`curr-${i}`}
          style={{
            width: '14.28%',
            aspectRatio: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => {
            setDate(dayStr);
            setDatePickerVisible(false);
          }}
        >
          {/* Fixed-size circle so the highlight stays round on any screen
              width - a radius on the percentage-width cell itself only looks
              circular on narrow viewports. */}
          <View style={[styles.pickerDayCircle, isSelected && { backgroundColor: activeColors.brandRed }]}>
            <Text style={{
              fontSize: 12,
              fontWeight: '700',
              color: isSelected ? '#ffffff' : activeColors.textBody,
            }}>{i}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return cells;
  };

  // Step 3 (지출일지 기록) Integrated Expenses State - a flat list of entries
  // (not one-slot-per-category) so a category can hold multiple expenses.
  const [expenseTrackingEnabled, setExpenseTrackingEnabled] = useState(false);
  const [expenseEntries, setExpenseEntries] = useState([]); // { id, category, amount, memo }[]

  const EXPENSE_DEFAULT_MEMO = {
    ticket: '티켓 예매',
    food: '푸드트럭/식음료',
    transport: '교통비/주차비',
    goods: 'MD/굿즈',
    etc: '기타 지출',
  };
  const EXPENSE_CATEGORY_META = [
    { key: 'ticket', label: '티켓', emoji: '🎫', memoPlaceholder: '예: E석 예매' },
    { key: 'food', label: '식음료', emoji: '🍔', memoPlaceholder: '예: 닭강정, 맥주' },
    { key: 'transport', label: '교통/주차', emoji: '🚌', memoPlaceholder: '예: KTX 왕복' },
    { key: 'goods', label: '굿즈', emoji: '🛍️', memoPlaceholder: '예: 유니폼 마킹' },
    { key: 'etc', label: '기타', emoji: '💰', memoPlaceholder: '예: 팬미팅 참가비' },
  ];

  const addExpenseEntry = (category) => {
    setExpenseEntries((prev) => [
      ...prev,
      { id: 'entry-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), category, amount: '', memo: '', goodsId: null },
    ]);
  };
  const updateExpenseEntry = (id, field, value) => {
    setExpenseEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };
  const removeExpenseEntry = (id) => {
    setExpenseEntries((prev) => prev.filter((e) => e.id !== id));
  };
  const activeExpenseCategories = [...new Set(expenseEntries.map((e) => e.category))];

  // Team picker states
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // 'home' or 'away'
  const [pickerDivision, setPickerDivision] = useState('all'); // all, k1, k2

  const { translateY: teamTranslateY, panResponder: teamPanResponder } =
    useSwipeDismissModal(() => setPickerVisible(false));

  const { translateY: dateTranslateY, panResponder: datePanResponder } =
    useSwipeDismissModal(() => setDatePickerVisible(false));

  const activeColors = Colors[theme];
  const isDark = theme === 'dark';

  // Apply autofill data when redirected from Calendar Screen
  useEffect(() => {
    if (autofillData) {
      setDate(autofillData.date || getTodayString());
      setStadium(autofillData.stadium || '');
      setHomeTeam(autofillData.homeTeam || '');
      setAwayTeam(autofillData.awayTeam || '');
      setHomeScore(autofillData.homeScore !== undefined && autofillData.homeScore !== null ? String(autofillData.homeScore) : '0');
      setAwayScore(autofillData.awayScore !== undefined && autofillData.awayScore !== null ? String(autofillData.awayScore) : '0');
      clearAutofill(); // Clear it immediately after loading
    }
  }, [autofillData]);

  // Apply edit log data when editing
  useEffect(() => {
    if (editLogData) {
      setHomeScore(editLogData.homeScore ? String(editLogData.homeScore) : '0');
      setAwayScore(editLogData.awayScore ? String(editLogData.awayScore) : '0');
      setHomeTeam(editLogData.homeTeam || '');
      setAwayTeam(editLogData.awayTeam || '');
      setDate(editLogData.date || getTodayString());
      setStadium(editLogData.stadium || '');
      setRating(editLogData.rating || 0);
      setPhotos(editLogData.photos || (editLogData.photo ? [editLogData.photo] : []));
      setReview(editLogData.review || '');

      const loadedCompanion = editLogData.companion || '혼관';
      if (editLogData.companionFriendIds && editLogData.companionFriendIds.length > 0) {
        // Saved with linked friends - each becomes a restorable slot, but any
        // manually-typed extra name isn't stored separately from the joined
        // display string, so that portion is left blank for re-entry on edit.
        setCompanionChip('친구');
        setCustomCompanionText('');
        setCompanionSlots(editLogData.companionFriendIds.map((fid, i) => ({
          id: 'existing-' + i, mode: 'friend', friendId: fid, customText: '',
        })));
      } else if (['혼관', '친구', '가족', '연인', '기타'].includes(loadedCompanion)) {
        setCompanionChip(loadedCompanion);
        setCustomCompanionText('');
        setCompanionSlots([]);
      } else {
        setCompanionChip('기타');
        setCustomCompanionText(loadedCompanion);
        setCompanionSlots([]);
      }

      setWeather(editLogData.weather || '☀️맑음');
      setRefereeScore(editLogData.refereeScore !== undefined ? editLogData.refereeScore : 50);
      setSelectedGoodsIds(existingGoodsIds || []);

      if (existingExpenses && existingExpenses.length > 0) {
        setExpenseEntries(existingExpenses.map((exp, i) => ({
          id: 'existing-' + (exp.id || i),
          category: exp.category,
          amount: String(exp.amount),
          memo: exp.memo || '',
          goodsId: exp.goodsId || null,
        })));
        setExpenseTrackingEnabled(true);
      }
    }
  // Deliberately keyed on editLogData alone (not existingExpenses/existingGoodsIds) -
  // those are inline arrays App.js recomputes on every render, so depending on them
  // re-ran this effect (and reset the user's in-progress edits) on any unrelated
  // parent re-render while the edit screen was open, not just when opening it.
  }, [editLogData]);

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!homeTeam || !awayTeam) {
        showAlert('알림', '경기할 양 팀 구단을 선택해주세요.');
        return false;
      }
      if (homeTeam === awayTeam) {
        showAlert('알림', '동일한 구단끼리는 경기를 치를 수 없습니다.');
        return false;
      }
      const scoreH = homeScore.trim();
      const scoreA = awayScore.trim();
      if (scoreH === '' || scoreA === '') {
        showAlert('알림', '홈팀과 원정팀 스코어를 모두 입력해주세요. (없으면 0 입력)');
        return false;
      }
      if (isNaN(parseInt(scoreH)) || isNaN(parseInt(scoreA))) {
        showAlert('알림', '점수는 올바른 숫자 형태로 기입해주세요.');
        return false;
      }
    } else if (currentStep === 2) {
      // Step 2: Referee Evaluation (no validation needed)
      return true;
    } else if (currentStep === 3) {
      // Step 3: Basic info (date must be filled)
      if (!date.trim()) {
        showAlert('알림', '직관 관전 날짜를 입력해주세요.');
        return false;
      }
    } else if (currentStep === 4) {
      // Step 4: Spending (optional)
      return true;
    } else if (currentStep === 5) {
      // Step 5: Stars Rating Selector
      if (rating === 0) {
        showAlert('알림', '이번 경기 직관 경험에 대한 평점 별점을 선택해주세요.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Tapping a step circle jumps straight there. Going back needs no checks
  // (those steps are already filled in); going forward still validates every
  // step in between so a required field further back can't be skipped.
  const goToStep = (target) => {
    if (target === step) return;
    if (target < step) {
      setStep(target);
      return;
    }
    for (let i = step; i < target; i++) {
      if (!validateStep(i)) return;
    }
    setStep(target);
  };

  const MAX_PHOTOS = isPremium ? 10 : 1;
  const MAX_REVIEW_CHARS = isPremium ? 999 : 200;

  const addPhotoFromGallery = async () => {
    if (photos.length >= MAX_PHOTOS) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('권한 필요', '사진 갤러리에 접근하려면 사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }

    try {
      // Multi-select so users can pick several photos in one go instead of
      // re-opening the picker per photo - allowsEditing/aspect are dropped
      // since the crop UI only supports single-selection picks.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: MAX_PHOTOS - photos.length,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUris = result.assets.map((a) => a.uri);
        setPhotos((prev) => [...prev, ...newUris].slice(0, MAX_PHOTOS));
      }
    } catch (e) {
      console.error('Image Picker Error:', e);
      showAlert('오류', '이미지를 불러오는 도중 오류가 발생했습니다.');
    }
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRegister = () => {
    if (!validateStep(5)) return;

    const slotFriendIds = companionSlots.filter((s) => s.mode === 'friend' && s.friendId).map((s) => s.friendId);
    const slotNames = companionSlots.map((s) => {
      if (s.mode === 'friend') {
        return friends.find((f) => f.id === s.friendId)?.nickname;
      }
      return s.customText.trim();
    }).filter(Boolean);
    const finalCompanion = companionChip === '친구'
      ? (slotNames.join(', ') || '친구')
      : companionChip === '기타'
        ? (customCompanionText.trim() || companionChip)
        : companionChip;

    const newLog = {
      id: editLogData ? editLogData.id : Date.now().toString(),
      homeTeam,
      awayTeam,
      homeScore: parseInt(homeScore.trim() === '' ? '0' : homeScore),
      awayScore: parseInt(awayScore.trim() === '' ? '0' : awayScore),
      date: date.trim(),
      stadium: stadium.trim() || 'K리그 경기장',
      rating,
      photos,
      photo: photos[0] || null,
      review: review.trim(),
      companion: finalCompanion,
      companionFriendIds: companionChip === '친구' ? slotFriendIds : [],
      weather,
      refereeScore,
    };

    const integratedExpenses = expenseEntries.map((e, i) => ({
      id: 'exp-' + Date.now() + '-' + i,
      matchId: newLog.id,
      matchTitle: `${homeTeam} VS ${awayTeam}`,
      date: date.trim(),
      category: e.category,
      amount: parseInt(e.amount) || 0,
      memo: e.memo.trim() || EXPENSE_DEFAULT_MEMO[e.category],
      goodsId: e.goodsId || null,
    }));

    onSave(newLog, integratedExpenses, selectedGoodsIds);
  };

  const openTeamPicker = (target) => {
    setPickerTarget(target);
    setPickerVisible(true);
  };

  const selectTeam = (teamName) => {
    if (pickerTarget === 'home') {
      setHomeTeam(teamName);
      if (TEAM_STADIUMS[teamName]) {
        setStadium(TEAM_STADIUMS[teamName]);
      }
    } else if (pickerTarget === 'away') {
      setAwayTeam(teamName);
    }
    setPickerVisible(false);
  };

  const renderStepper = () => {
    return (
      <View style={[styles.stepperContainer, { borderBottomColor: activeColors.dividerColor }]}>
        {[1, 2, 3, 4, 5].map((s) => {
          const isActive = step >= s;
          const isCurrent = step === s;
          return (
            <React.Fragment key={s}>
              {s > 1 && (
                <View style={[styles.stepLine, { backgroundColor: isActive ? activeColors.brandNavy : activeColors.borderColor }]} />
              )}
              <TouchableOpacity
                onPress={() => goToStep(s)}
                activeOpacity={0.7}
                style={[
                  styles.stepCircle,
                  { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor },
                  isActive && { backgroundColor: activeColors.brandNavy, borderColor: activeColors.brandNavy },
                  isCurrent && { backgroundColor: activeColors.brandRed, borderColor: activeColors.brandRed }
                ]}
              >
                <Text style={styles.stepCircleText}>{s}</Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  const showK1 = pickerDivision === 'all' || pickerDivision === 'k1';
  const showK2 = pickerDivision === 'all' || pickerDivision === 'k2';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      {renderStepper()}

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        {/* STEP 1: SCOREBOARD */}
        {step === 1 && (
          <View style={styles.stepWrapper}>
            <Text style={[styles.stepTitleText, { color: activeColors.brandNavy }]}>스코어보드 기록</Text>
            <Text style={[styles.stepDescText, { color: activeColors.textMuted }]}>
              홈팀과 원정팀 구단을 선택하고 경기 최종 점수를 기입해주세요.
            </Text>

            {/* Scoreboard Widget UI */}
            <View style={[styles.scoreBoardCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
              {/* Home Team Side */}
              <View style={styles.teamCol}>
                <TouchableOpacity
                  style={[styles.teamSelectBtn, { backgroundColor: activeColors.bgTag }]}
                  onPress={() => openTeamPicker('home')}
                >
                  {homeTeam ? (
                    <View style={styles.selectedTeamInfo}>
                      <TeamBadge teamName={homeTeam} size={28} />
                      <Text style={[styles.selectedTeamName, { color: activeColors.textBody }]}>{homeTeam}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.selectPlaceholder, { color: activeColors.textMuted }]}>홈팀 선택</Text>
                  )}
                </TouchableOpacity>
                <TextInput
                  style={[styles.scoreInput, { backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor, color: activeColors.textBody }]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={activeColors.textMuted}
                  value={homeScore}
                  onChangeText={setHomeScore}
                  onFocus={() => { if (homeScore === '0') setHomeScore(''); }}
                  onBlur={() => { if (homeScore.trim() === '') setHomeScore('0'); }}
                  maxLength={2}
                />
              </View>

              <Text style={styles.vsSeparator}>:</Text>

              {/* Away Team Side */}
              <View style={styles.teamCol}>
                <TouchableOpacity
                  style={[styles.teamSelectBtn, { backgroundColor: activeColors.bgTag }]}
                  onPress={() => openTeamPicker('away')}
                >
                  {awayTeam ? (
                    <View style={styles.selectedTeamInfo}>
                      <TeamBadge teamName={awayTeam} size={28} />
                      <Text style={[styles.selectedTeamName, { color: activeColors.textBody }]}>{awayTeam}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.selectPlaceholder, { color: activeColors.textMuted }]}>원정팀 선택</Text>
                  )}
                </TouchableOpacity>
                <TextInput
                  style={[styles.scoreInput, { backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor, color: activeColors.textBody }]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={activeColors.textMuted}
                  value={awayScore}
                  onChangeText={setAwayScore}
                  onFocus={() => { if (awayScore === '0') setAwayScore(''); }}
                  onBlur={() => { if (awayScore.trim() === '') setAwayScore('0'); }}
                  maxLength={2}
                />
              </View>
            </View>
          </View>
        )}

        {/* STEP 2: BASIC INFO & REFEREE */}
        {step === 2 && (
          <View style={styles.stepWrapper}>
            <Text style={[styles.stepTitleText, { color: activeColors.brandNavy }]}>직관 기본 정보 및 심판 평가</Text>
            <Text style={[styles.stepDescText, { color: activeColors.textMuted }]}>
              경기 날짜, 경기장, 날씨 및 동행인과 심판 판정을 평가해주세요.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: activeColors.textBody }]}>직관 날짜 *</Text>
              <TouchableOpacity
                style={[
                  styles.formInput,
                  {
                    backgroundColor: activeColors.bgInput,
                    borderColor: activeColors.borderColor,
                    justifyContent: 'space-between',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }
                ]}
                onPress={openDatePicker}
              >
                <Text style={{ color: date ? activeColors.textBody : activeColors.textMuted, fontSize: 13, fontWeight: '600' }}>
                  {date || '직관 날짜를 선택해주세요'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={activeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: activeColors.textBody }]}>경기 경기장</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor, color: activeColors.textBody }]}
                placeholder="경기장 명칭을 기입해주세요"
                placeholderTextColor={activeColors.textMuted}
                value={stadium}
                onChangeText={setStadium}
              />
            </View>

            {/* Weather Selection */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: activeColors.textBody, marginBottom: 8 }]}>오늘의 날씨 *</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['☀️맑음', '☁️흐림', '🌧️비', '❄️눈'].map((wOpt) => {
                  const isActive = weather === wOpt;
                  return (
                    <TouchableOpacity
                      key={wOpt}
                      style={[
                        styles.weatherBtn,
                        {
                          flex: 1,
                          height: 40,
                          borderRadius: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1.5,
                          borderColor: isActive ? activeColors.brandRed : activeColors.borderColor,
                          backgroundColor: isActive ? 'rgba(238, 50, 36, 0.08)' : activeColors.bgTag,
                        }
                      ]}
                      onPress={() => setWeather(wOpt)}
                    >
                      <Text style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: isActive ? activeColors.brandRed : activeColors.textBody
                      }}>
                        {wOpt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Companion Chips Selection */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: activeColors.textBody, marginBottom: 8 }]}>누구랑 갔나요? *</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['혼관', '친구', '가족', '연인', '기타'].map((cOpt) => {
                  const isActive = companionChip === cOpt;
                  return (
                    <TouchableOpacity
                      key={cOpt}
                      style={{
                        paddingHorizontal: 16,
                        height: 40,
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1.5,
                        borderColor: isActive ? activeColors.brandRed : activeColors.borderColor,
                        backgroundColor: isActive ? 'rgba(238, 50, 36, 0.08)' : activeColors.bgTag,
                      }}
                      onPress={() => {
                        setCompanionChip(cOpt);
                        if (cOpt !== '기타' && cOpt !== '친구') {
                          setCustomCompanionText('');
                        }
                        if (cOpt !== '친구') {
                          setCompanionSlots([]);
                          setOpenSlotId(null);
                        }
                      }}
                    >
                      <Text style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: isActive ? activeColors.brandRed : activeColors.textBody
                      }}>
                        {cOpt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {companionChip === '친구' && (
                <View style={{ marginTop: 10 }}>
                  {companionSlots.map((slot) => {
                    const selectedFriend = friends.find((f) => f.id === slot.friendId);
                    const isOpen = openSlotId === slot.id;
                    const label = slot.mode === 'custom'
                      ? (slot.customText.trim() || '이름 직접 입력')
                      : (selectedFriend ? selectedFriend.nickname : '친구 선택');
                    const hasValue = slot.mode === 'custom' ? !!slot.customText.trim() : !!selectedFriend;
                    // A friend already picked in another slot can't be picked again here.
                    const pickedElsewhere = companionSlots
                      .filter((s) => s.id !== slot.id && s.mode === 'friend' && s.friendId)
                      .map((s) => s.friendId);
                    const availableFriends = friends.filter((f) => !pickedElsewhere.includes(f.id));
                    return (
                      <View key={slot.id} style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            height: 44,
                            paddingLeft: 14,
                            paddingRight: 8,
                            borderRadius: 10,
                            borderWidth: 1.5,
                            borderColor: isOpen ? activeColors.brandRed : activeColors.borderColor,
                            backgroundColor: activeColors.bgInput,
                          }}>
                            {slot.mode === 'custom' ? (
                              <TextInput
                                style={{ flex: 1, fontSize: 13, fontWeight: '700', color: activeColors.textBody, padding: 0 }}
                                placeholder="이름을 입력해주세요"
                                placeholderTextColor={activeColors.textMuted}
                                value={slot.customText}
                                onChangeText={(t) => updateCompanionSlot(slot.id, { customText: t })}
                                maxLength={20}
                              />
                            ) : (
                              <TouchableOpacity style={{ flex: 1 }} onPress={() => setOpenSlotId(isOpen ? null : slot.id)}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: hasValue ? activeColors.textBody : activeColors.textMuted }}>
                                  {label}
                                </Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              onPress={() => setOpenSlotId(isOpen ? null : slot.id)}
                              style={{ padding: 6 }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={activeColors.textMuted} />
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity onPress={() => removeCompanionSlot(slot.id)} style={{ padding: 4 }}>
                            <Ionicons name="close-circle" size={20} color={activeColors.textMuted} />
                          </TouchableOpacity>
                        </View>

                        {isOpen && (
                          <View style={{ padding: 6, marginTop: 6, borderRadius: 8, borderWidth: 1.5, backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }}>
                            {friends.length === 0 && (
                              <View style={{ paddingVertical: 10, paddingHorizontal: 8 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: activeColors.textMuted, lineHeight: 17 }}>
                                  아직 추가된 친구가 없어요.{'\n'}마이페이지에서 친구를 추가해보세요!
                                </Text>
                              </View>
                            )}
                            {availableFriends.map((f) => (
                              <TouchableOpacity
                                key={f.id}
                                style={{ paddingVertical: 10, paddingHorizontal: 8 }}
                                onPress={() => {
                                  updateCompanionSlot(slot.id, { mode: 'friend', friendId: f.id, customText: '' });
                                  setOpenSlotId(null);
                                }}
                              >
                                <Text style={{ fontSize: 13, fontWeight: '700', color: slot.friendId === f.id ? activeColors.brandRed : activeColors.textBody }}>
                                  {f.nickname}
                                </Text>
                              </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                              style={{ paddingVertical: 10, paddingHorizontal: 8, borderTopWidth: availableFriends.length > 0 ? 1 : 0, borderTopColor: activeColors.borderColor }}
                              onPress={() => {
                                updateCompanionSlot(slot.id, { mode: 'custom', friendId: null });
                                setOpenSlotId(null);
                              }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '700', color: activeColors.brandRed }}>
                                ✏️ 목록에 없는 친구 (직접 입력)
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  <TouchableOpacity
                    onPress={addCompanionSlot}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      height: 44,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: activeColors.brandRed,
                      backgroundColor: 'rgba(238, 50, 36, 0.05)',
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="person-add-outline" size={16} color={activeColors.brandRed} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: activeColors.brandRed }}>
                      동행 친구 추가
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {companionChip === '기타' && (
                <View style={{ marginTop: 10 }}>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor, color: activeColors.textBody }]}
                    placeholder="누구와 함께 하셨는지 입력해주세요"
                    placeholderTextColor={activeColors.textMuted}
                    value={customCompanionText}
                    onChangeText={setCustomCompanionText}
                    maxLength={20}
                  />
                </View>
              )}
            </View>

            {/* Worn Goods - picking happens in a modal styled like the
                굿즈보관함 grid (image + name) so the user can see what each
                item actually looks like. If nothing's registered yet, a
                button opens the same add-goods form used in 마이페이지 so the
                user isn't forced to leave the diary flow to register one. */}
            <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Ionicons name="shirt-outline" size={15} color={activeColors.brandRed} />
                  <Text style={[styles.inputLabel, { color: activeColors.textBody, marginBottom: 0 }]}>착용한 굿즈 (선택)</Text>
                </View>
                <View style={{ borderWidth: 1.5, borderRadius: 10, padding: 12, backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }}>

                {goods.length === 0 && (
                  <Text style={{ fontSize: 12, fontWeight: '600', color: activeColors.textMuted, marginBottom: 10 }}>
                    등록된 굿즈가 없어요. 먼저 굿즈를 등록해보세요!
                  </Text>
                )}

                {selectedGoodsIds.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {goods.filter((item) => selectedGoodsIds.includes(item.id)).map((item) => (
                      <View key={item.id} style={styles.selectedGoodsChip}>
                        {item.photo_url ? (
                          <Image source={{ uri: item.photo_url }} style={styles.selectedGoodsChipImage} />
                        ) : (
                          <View style={[styles.selectedGoodsChipImage, styles.goodsImagePlaceholder, { backgroundColor: activeColors.bgTag }]}>
                            <Ionicons name="shirt-outline" size={14} color={activeColors.textMuted} />
                          </View>
                        )}
                        <Text style={{ fontSize: 12, fontWeight: '700', color: activeColors.textBody, maxWidth: 90 }} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <TouchableOpacity onPress={() => setSelectedGoodsIds((prev) => prev.filter((id) => id !== item.id))}>
                          <Ionicons name="close-circle" size={16} color={activeColors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => (goods.length > 0 ? setGoodsPickerVisible(true) : setNewGoodsModalVisible(true))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    height: 44,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: activeColors.brandRed,
                    backgroundColor: 'rgba(238, 50, 36, 0.05)',
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={16} color={activeColors.brandRed} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: activeColors.brandRed }}>
                    {goods.length > 0 ? '굿즈 보관함에서 선택' : '굿즈 등록하기'}
                  </Text>
                </TouchableOpacity>
                </View>
              </View>

            <Modal
              visible={goodsPickerVisible}
              animationType="slide"
              onRequestClose={() => setGoodsPickerVisible(false)}
            >
              <SafeAreaView style={[webContentWidth, { flex: 1, backgroundColor: activeColors.bgBody }]}>
                <View style={[styles.goodsPickerHeader, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
                  <View style={styles.goodsPickerHeaderBtn} />
                  <Text style={[styles.goodsPickerHeaderTitle, { color: activeColors.brandNavy }]}>굿즈 보관함</Text>
                  <TouchableOpacity
                    onPress={() => setGoodsPickerVisible(false)}
                    style={styles.goodsPickerHeaderBtn}
                  >
                    <Ionicons name="close" size={22} color={activeColors.textBody} />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {goods.map((item) => {
                      const isActive = selectedGoodsIds.includes(item.id);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.goodsGridItem}
                          activeOpacity={0.8}
                          onPress={() => {
                            setSelectedGoodsIds((prev) =>
                              prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                            );
                          }}
                        >
                          <View style={[styles.goodsGridImageWrap, { borderColor: isActive ? activeColors.brandRed : activeColors.borderColor }]}>
                            {item.photo_url ? (
                              <Image source={{ uri: item.photo_url }} style={styles.goodsGridImage} />
                            ) : (
                              <View style={[styles.goodsGridImage, styles.goodsImagePlaceholder, { backgroundColor: activeColors.bgTag }]}>
                                <Ionicons name="shirt-outline" size={26} color={activeColors.textMuted} />
                              </View>
                            )}
                            {isActive && (
                              <View style={[styles.goodsCheckOverlay, { backgroundColor: activeColors.brandRed }]}>
                                <Ionicons name="checkmark" size={14} color="#ffffff" />
                              </View>
                            )}
                          </View>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: activeColors.textBody, marginTop: 4, textAlign: 'center' }} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
                <View style={{ padding: 16 }}>
                  <TouchableOpacity
                    style={[styles.nextBtn, { backgroundColor: activeColors.brandNavy }]}
                    onPress={() => setGoodsPickerVisible(false)}
                  >
                    <Text style={styles.nextBtnText}>완료 ({selectedGoodsIds.length}개 선택)</Text>
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </Modal>

            <GoodsModal
              visible={newGoodsModalVisible}
              onClose={() => setNewGoodsModalVisible(false)}
              theme={theme}
              editingGoods={null}
              onSave={(goodsItem) => {
                if (onSaveGoods) onSaveGoods(goodsItem, []);
                setSelectedGoodsIds((prev) => [...prev, goodsItem.id]);
                setNewGoodsModalVisible(false);
              }}
            />

            {/* Referee Evaluation Slider */}
            <View style={{ marginTop: 24, paddingVertical: 12 }}>
              <Text style={[styles.inputLabel, { color: activeColors.textBody, marginBottom: 8 }]}>
                📢 심판 판정은 어땠나요? ({refereeScore}점)
              </Text>
              
              {/* Status comment bubble */}
              {(() => {
                const status = getRefereeStatus(refereeScore);
                return (
                  <View style={{
                    backgroundColor: activeColors.bgTag,
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: activeColors.borderColor,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <Text style={{ fontSize: 24 }}>{status.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: activeColors.brandRed }}>
                        {status.area}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: activeColors.textBody, marginTop: 2 }}>
                        {status.text}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* Slider Track Container */}
              <View
                style={{
                  height: 40,
                  justifyContent: 'center',
                  width: '100%',
                  position: 'relative',
                }}
                onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width || 250)}
                onStartShouldSetResponder={() => true}
                onResponderGrant={(evt) => {
                  const x = evt.nativeEvent.locationX;
                  let pct = x / sliderWidth;
                  if (pct < 0) pct = 0;
                  if (pct > 1) pct = 1;
                  setRefereeScore(Math.round(pct * 100));
                }}
                onResponderMove={(evt) => {
                  const x = evt.nativeEvent.locationX;
                  let pct = x / sliderWidth;
                  if (pct < 0) pct = 0;
                  if (pct > 1) pct = 1;
                  setRefereeScore(Math.round(pct * 100));
                }}
              >
                {/* Background track bar */}
                <View style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: activeColors.bgTag,
                  width: '100%',
                }} />
                
                {/* Active progress bar fill */}
                <View style={{
                  position: 'absolute',
                  left: 0,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: activeColors.brandNavy,
                  width: `${refereeScore}%`,
                }} />

                {/* Thumb indicator */}
                <View style={{
                  position: 'absolute',
                  left: `${refereeScore}%`,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: activeColors.brandRed,
                  marginLeft: -12,
                  elevation: 3,
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 2,
                }} />
              </View>

              {/* Min Max Labels */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 10, color: activeColors.textMuted, fontWeight: '700' }}>0 (최악)</Text>
                <Text style={{ fontSize: 10, color: activeColors.textMuted, fontWeight: '700' }}>50 (보통)</Text>
                <Text style={{ fontSize: 10, color: activeColors.textMuted, fontWeight: '700' }}>100 (최고)</Text>
              </View>
            </View>
          </View>
        )}

        {/* STEP 3: PHOTO & DIARY */}
        {step === 3 && (
          <View style={styles.stepWrapper}>
            <Text style={[styles.stepTitleText, { color: activeColors.brandNavy }]}>직관 이미지 및 일지 작성</Text>
            <Text style={[styles.stepDescText, { color: activeColors.textMuted }]}>
              오늘의 직관 사진을 업로드하고 생생한 직관 일지를 기록해 보세요.
            </Text>

            {/* Photo upload container */}
            <View style={styles.photoUploadArea}>
              <Text style={[styles.inputLabel, { color: activeColors.textBody, marginBottom: 8 }]}>
                직관 이미지 (선택, 최대 {MAX_PHOTOS}장) {photos.length}/{MAX_PHOTOS}
              </Text>
              {photos.length === 0 ? (
                <TouchableOpacity
                  style={[styles.photoPlaceholderBox, { backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor }]}
                  onPress={addPhotoFromGallery}
                >
                  <Ionicons name="camera-outline" size={28} color={activeColors.textMuted} />
                  <Text style={[styles.photoPlaceholderText, { color: activeColors.textMuted, marginTop: 4 }]}>갤러리에서 사진 가져오기</Text>
                </TouchableOpacity>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoThumbRow}>
                  {photos.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={styles.photoThumbContainer}>
                      <Image source={{ uri }} style={styles.photoThumb} />
                      <TouchableOpacity
                        style={styles.photoClearBtn}
                        onPress={() => removePhoto(index)}
                      >
                        <Text style={styles.photoClearText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <TouchableOpacity
                      style={[styles.photoAddTile, { backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor }]}
                      onPress={addPhotoFromGallery}
                    >
                      <Ionicons name="add" size={24} color={activeColors.textMuted} />
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
            </View>

            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.inputLabel, { color: activeColors.textBody }]}>직관 일지 작성</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: activeColors.textMuted }}>
                  {review.length}/{MAX_REVIEW_CHARS}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.formTextarea,
                  {
                    backgroundColor: activeColors.bgInput,
                    borderColor: activeColors.borderColor,
                    color: activeColors.textBody,
                  },
                ]}
                placeholder="오늘의 직관 이야기를 남겨주세요 (선수 활약, 경기장 분위기 등)"
                placeholderTextColor={activeColors.textMuted}
                multiline={true}
                numberOfLines={5}
                maxLength={MAX_REVIEW_CHARS}
                value={review}
                onChangeText={(text) => setReview(text.slice(0, MAX_REVIEW_CHARS))}
                textAlignVertical="top"
              />
            </View>
          </View>
        )}

        {/* STEP 4: INTEGRATED SPENDING */}
        {step === 4 && (
          <View style={styles.stepWrapper}>
            <Text style={[styles.stepTitleText, { color: activeColors.brandNavy }]}>직관 지출 기록 (선택)</Text>
            <Text style={[styles.stepDescText, { color: activeColors.textMuted }]}>
              오늘 직관을 위해 소비한 지출 내역이 있다면 가계부에 등록할 카테고리를 선택하고 금액을 기록해 보세요.
            </Text>

            {/* Master ON/OFF switch for expense tracking */}
            <View style={[styles.expenseToggleRow, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
              <Text style={[styles.rowLabelText, { color: activeColors.textBody, marginBottom: 0 }]}>지출 내역을 기록할까요?</Text>
              <Switch
                value={expenseTrackingEnabled}
                onValueChange={(value) => {
                  setExpenseTrackingEnabled(value);
                  if (!value) {
                    setExpenseEntries([]);
                  }
                }}
                trackColor={{ false: activeColors.bgTag, true: isDark ? activeColors.brandRed : activeColors.brandNavy }}
                thumbColor="#ffffff"
                activeThumbColor="#ffffff"
              />
            </View>

            {!expenseTrackingEnabled ? (
              <View style={[styles.noExpensesNotice, { borderColor: activeColors.borderColor }]}>
                <Text style={[styles.noExpensesNoticeText, { color: activeColors.textMuted }]}>
                  스위치를 켜면 티켓/식음료/교통/굿즈 지출을 기록할 수 있어요.
                </Text>
              </View>
            ) : (
              <>
            {/* Category selection row - tapping toggles the whole category on/off,
                adding/removing its first entry. Each active category can then get
                more entries via its own "+ 추가" button below. */}
            <View style={styles.spendingChipsRow}>
              {EXPENSE_CATEGORY_META.map((cat) => {
                const isActive = activeExpenseCategories.includes(cat.key);
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.spendingChip,
                      { backgroundColor: activeColors.bgTag, borderColor: activeColors.borderColor },
                      isActive && { backgroundColor: activeColors.brandNavy, borderColor: 'transparent' }
                    ]}
                    onPress={() => {
                      if (isActive) {
                        setExpenseEntries((prev) => prev.filter((e) => e.category !== cat.key));
                      } else {
                        addExpenseEntry(cat.key);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.spendingChipText, { color: isActive ? '#ffffff' : activeColors.textBody }]}>
                      {cat.emoji} {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Conditional input rows - one per expense entry, grouped by category */}
            <View style={styles.integratedExpensesContainer}>
              {EXPENSE_CATEGORY_META.filter((cat) => activeExpenseCategories.includes(cat.key)).map((cat) => {
                const entries = expenseEntries.filter((e) => e.category === cat.key);
                return (
                  <View key={cat.key} style={{ marginBottom: 4 }}>
                    <Text style={[styles.rowLabelText, { color: activeColors.brandNavy }]}>{cat.emoji} {cat.label} 지출</Text>
                    {entries.map((entry, idx) => (
                      <View key={entry.id} style={[styles.integratedExpenseRow, { borderColor: activeColors.borderColor, backgroundColor: activeColors.bgCard }]}>
                        <View style={styles.integratedExpenseRowLine}>
                          <TextInput
                            style={[styles.integratedInput, { flex: 0.8, minWidth: 0, backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor, color: activeColors.textBody }]}
                            keyboardType="numeric"
                            placeholder={`${cat.label} 금액 *`}
                            placeholderTextColor={activeColors.textMuted}
                            value={entry.amount}
                            onChangeText={(t) => updateExpenseEntry(entry.id, 'amount', t)}
                          />
                          <TextInput
                            style={[styles.integratedInput, { flex: 1, minWidth: 0, backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor, color: activeColors.textBody }]}
                            placeholder={cat.memoPlaceholder}
                            placeholderTextColor={activeColors.textMuted}
                            value={entry.memo}
                            onChangeText={(t) => updateExpenseEntry(entry.id, 'memo', t)}
                          />
                          {entries.length > 1 ? (
                            <TouchableOpacity
                              onPress={() => removeExpenseEntry(entry.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={styles.integratedExpenseDeleteBtn}
                            >
                              <Ionicons name="close-circle" size={20} color={activeColors.textMuted} />
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.integratedExpenseDeleteBtn} />
                          )}
                        </View>
                      </View>
                    ))}
                    <TouchableOpacity
                      onPress={() => addExpenseEntry(cat.key)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 2, marginBottom: 12 }}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={activeColors.brandRed} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: activeColors.brandRed }}>
                        {cat.label} 지출 추가
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {expenseEntries.length === 0 && (
                <View style={[styles.noExpensesNotice, { borderColor: activeColors.borderColor }]}>
                  <Text style={[styles.noExpensesNoticeText, { color: activeColors.textMuted }]}>
                    선택된 소비 지출 카테고리가 없습니다. {'\n'}상단에서 지출 항목 카드를 탭하여 추가해 보세요!
                  </Text>
                </View>
              )}
            </View>
              </>
            )}
          </View>
        )}

        {/* STEP 5: RATING */}
        {step === 5 && (
          <View style={styles.stepWrapper}>
            <Text style={[styles.stepTitleText, { color: activeColors.brandNavy }]}>직관 경기 평점</Text>
            <Text style={[styles.stepDescText, { color: activeColors.textMuted }]}>
              오늘 경기 직관 경험에 대한 평점 별점을 설정하고 일지를 등록하세요.
            </Text>

            {/* Stars Rating Selector */}
            <View style={styles.starsSelectorArea}>
              <Text style={[styles.inputLabel, { color: activeColors.textBody, marginBottom: 12 }]}>직관 평점 별점 설정 *</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((starVal) => (
                  <TouchableOpacity
                    key={starVal}
                    onPress={() => setRating(starVal)}
                    style={styles.starTouch}
                  >
                    <Ionicons
                      name={rating >= starVal ? 'star' : 'star-outline'}
                      size={36}
                      color="#FBC02D"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Dynamic Wizard Footer Navigation */}
        <View style={styles.footerRow}>
          {step > 1 ? (
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: activeColors.bgTag, flex: 1 }]}
              onPress={handlePrev}
            >
              <Text style={[styles.navBtnText, { color: activeColors.textBody }]}>이전단계</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: activeColors.bgTag, flex: 1 }]}
              onPress={onCancel}
            >
              <Text style={[styles.navBtnText, { color: activeColors.textBody }]}>취소</Text>
            </TouchableOpacity>
          )}

          {step < 5 ? (
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: activeColors.brandNavy, flex: 1 }]}
              onPress={handleNext}
            >
              <Text style={styles.nextBtnText}>다음단계</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: activeColors.brandRed, flex: 2.5 }]}
              onPress={handleRegister}
            >
              <Text style={styles.submitBtnText}>직관일지 등록</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      {/* Team Picker Overlay Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={pickerVisible}
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalSheet, { backgroundColor: activeColors.bgApp, transform: [{ translateY: teamTranslateY }] }]}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 14, paddingBottom: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10 }} {...teamPanResponder.panHandlers}>
              <View style={[styles.modalHeaderDrag, { marginBottom: 0 }]} />
            </View>
            <Text style={[styles.modalTitle, { color: activeColors.brandNavy }]}>구단 선택</Text>

            {/* Picker Division Toggle */}
            <View style={[styles.toggleContainer, { backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor, marginBottom: 15 }]}>
              <TouchableOpacity
                style={[styles.toggleBtn, pickerDivision === 'all' && { backgroundColor: activeColors.bgTag }]}
                onPress={() => setPickerDivision('all')}
              >
                <Text style={[styles.toggleBtnText, { color: pickerDivision === 'all' ? activeColors.textBody : activeColors.textMuted }]}>
                  전체
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, pickerDivision === 'k1' && { backgroundColor: activeColors.bgTag }]}
                onPress={() => setPickerDivision('k1')}
              >
                <Text style={[styles.toggleBtnText, { color: pickerDivision === 'k1' ? activeColors.textBody : activeColors.textMuted }]}>
                  K리그 1
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, pickerDivision === 'k2' && { backgroundColor: activeColors.bgTag }]}
                onPress={() => setPickerDivision('k2')}
              >
                <Text style={[styles.toggleBtnText, { color: pickerDivision === 'k2' ? activeColors.textBody : activeColors.textMuted }]}>
                  K리그 2
                </Text>
              </TouchableOpacity>
            </View>

            {/* Team Scroll Area */}
            <ScrollView style={{ maxHeight: 300 }}>
              {showK1 && (
                <View style={styles.pickerLeagueSection}>
                  <Text style={[styles.pickerLeagueTitle, { color: activeColors.textMuted }]}>🏆 K리그 1</Text>
                  <View style={styles.pickerGrid}>
                    {LEAGUE_TEAMS.K1.map((name) => (
                      <TouchableOpacity
                        key={name}
                        style={[styles.pickerTeamCard, { backgroundColor: activeColors.bgTag }]}
                        onPress={() => selectTeam(name)}
                      >
                        <TeamBadge teamName={name} size={20} />
                        <Text style={[styles.pickerTeamText, { color: activeColors.textBody }]}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {showK2 && (
                <View style={styles.pickerLeagueSection}>
                  <Text style={[styles.pickerLeagueTitle, { color: activeColors.textMuted }]}>⚽ K리그 2</Text>
                  <View style={styles.pickerGrid}>
                    {LEAGUE_TEAMS.K2.map((name) => (
                      <TouchableOpacity
                        key={name}
                        style={[styles.pickerTeamCard, { backgroundColor: activeColors.bgTag }]}
                        onPress={() => selectTeam(name)}
                      >
                        <TeamBadge teamName={name} size={20} />
                        <Text style={[styles.pickerTeamText, { color: activeColors.textBody }]}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: activeColors.bgTag, marginTop: 15 }]}
              onPress={() => setPickerVisible(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: activeColors.textBody }]}>닫기</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Date Picker Overlay Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={datePickerVisible}
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalSheet, { backgroundColor: activeColors.bgApp, transform: [{ translateY: dateTranslateY }] }]}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 14, paddingBottom: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10 }} {...datePanResponder.panHandlers}>
              <View style={[styles.modalHeaderDrag, { marginBottom: 0 }]} />
            </View>
            <Text style={[styles.modalTitle, { color: activeColors.brandNavy }]}>직관 날짜 선택</Text>

            {/* Picker Month Navigation */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  const y = pickerCalendarDate.getFullYear();
                  const m = pickerCalendarDate.getMonth();
                  setPickerCalendarDate(new Date(y, m - 1, 1));
                }}
                style={{ padding: 8 }}
              >
                <Ionicons name="chevron-back" size={20} color={activeColors.textBody} />
              </TouchableOpacity>
              <Text style={{ fontSize: 15, fontWeight: '800', color: activeColors.textBody }}>
                {pickerCalendarDate.getFullYear()}년 {(pickerCalendarDate.getMonth() + 1)}월
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const y = pickerCalendarDate.getFullYear();
                  const m = pickerCalendarDate.getMonth();
                  setPickerCalendarDate(new Date(y, m + 1, 1));
                }}
                style={{ padding: 8 }}
              >
                <Ionicons name="chevron-forward" size={20} color={activeColors.textBody} />
              </TouchableOpacity>
            </View>

            {/* Calendar Weekday Labels */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              {['일', '월', '화', '수', '목', '금', '토'].map((wd, index) => (
                <View key={wd} style={{ width: '14.28%', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: index === 0 ? '#E30613' : index === 6 ? (theme === 'dark' ? '#5B8DEF' : '#0047A0') : activeColors.textMuted }}>
                    {wd}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar Grid cells wrapper */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
              {renderPickerCalendarCells()}
            </View>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: activeColors.bgTag, marginTop: 20 }]}
              onPress={() => setDatePickerVisible(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: activeColors.textBody }]}>닫기</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  stepLine: {
    width: 40,
    height: 3,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  stepWrapper: {
    flex: 1,
  },
  stepTitleText: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  stepDescText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 20,
  },
  scoreBoardCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
  },
  teamSelectBtn: {
    width: '90%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    height: 48,
  },
  selectPlaceholder: {
    fontSize: 12,
    fontWeight: '800',
  },
  selectedTeamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedTeamName: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  scoreInput: {
    width: 60,
    height: 48,
    borderWidth: 1.5,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
  },
  vsSeparator: {
    fontSize: 24,
    fontWeight: '900',
    color: '#EE3224',
    marginHorizontal: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 8,
  },
  formInput: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 13.5,
    fontWeight: '700',
  },
  starsSelectorArea: {
    marginBottom: 20,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  starTouch: {
    padding: 6,
  },
  starIcon: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  starSelected: {
    color: '#FBC02D',
  },
  starUnselected: {
    color: '#CBD5E1',
  },
  photoUploadArea: {
    marginBottom: 20,
  },
  photoThumbRow: {
    gap: 10,
    paddingRight: 4,
  },
  photoThumbContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoAddTile: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoClearBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoClearText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -2,
  },
  photoPlaceholderBox: {
    height: 120,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderText: {
    fontSize: 11,
    fontWeight: '700',
  },
  formTextarea: {
    height: 140,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 13.5,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 30,
  },
  navBtn: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  nextBtn: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  goodsPickerHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  goodsPickerHeaderBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goodsPickerHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  goodsGridItem: {
    width: '30%',
    alignItems: 'center',
  },
  goodsGridImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
  },
  goodsGridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  goodsImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  goodsCheckOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedGoodsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(238, 50, 36, 0.08)',
  },
  selectedGoodsChipImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  submitBtn: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '900',
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
  toggleContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  pickerLeagueSection: {
    marginBottom: 15,
  },
  pickerLeagueTitle: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    paddingLeft: 2,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerTeamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  pickerTeamText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  modalCloseBtn: {
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  expenseToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  spendingChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  spendingChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  spendingChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  integratedExpensesContainer: {
    marginTop: 12,
    gap: 12,
  },
  integratedExpenseRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  integratedExpenseRowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  integratedExpenseDeleteBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabelText: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 2,
  },
  integratedInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '700',
  },
  noExpensesNotice: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noExpensesNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  pickerDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
