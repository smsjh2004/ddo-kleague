import React, { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Linking,
  Modal,
  StyleSheet,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { TEAM_COLORS } from '../constants/TeamData';
import { storage } from '../utils/storage';
import { showAlert } from '../utils/appAlert';
import { Ionicons } from '@expo/vector-icons';

const APP_VERSION = require('../app.json').expo.version;

const AD_FREE_UNTIL_KEY = 'kleague_adfree_until';
const AD_WATCH_SECONDS = 5;
const AD_FREE_DURATION_MS = 24 * 60 * 60 * 1000;

function formatRemaining(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
  return `${minutes}분 남음`;
}

const FAQ_ITEMS = [
  {
    q: '직관일지는 어떻게 작성하나요?',
    a: '경기 일정 탭에서 관람한 경기를 선택하거나, 나의 직관 탭의 + 버튼을 눌러 새 직관일지를 작성할 수 있어요.',
  },
  {
    q: '기록한 데이터는 안전하게 보관되나요?',
    a: '로그인 후 작성한 직관일지, 지출 내역, 굿즈 정보는 서버에 저장되어 기기를 바꿔도 유지됩니다.',
  },
  {
    q: '마이팀이나 닉네임을 변경하고 싶어요.',
    a: '마이페이지 프로필 옆의 연필 아이콘을 눌러 마이팀, 닉네임, 프로필 사진을 언제든 수정할 수 있어요.',
  },
  {
    q: '업적은 어떻게 달성하나요?',
    a: '직관 횟수, 승수, 연승 기록, 방문 경기장 수 등 직관일지 데이터를 기반으로 자동 계산되어 달성 시 마이페이지에 표시돼요.',
  },
];

const THEME_MODE_OPTIONS = [
  { key: 'system', label: '시스템', icon: 'phone-portrait-outline' },
  { key: 'light', label: '라이트', icon: 'sunny-outline' },
  { key: 'dark', label: '다크', icon: 'moon-outline' },
];

function getTeamColors(teamName) {
  const key = Object.keys(TEAM_COLORS).find((k) => TEAM_COLORS[k].name === teamName);
  return key ? TEAM_COLORS[key].colors.slice(0, 2) : [];
}


function SettingsRow({ icon, iconColor, label, value, onPress, textColor, showChevron = true }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <Ionicons name={icon} size={18} color={iconColor} style={styles.rowIcon} />
      <Text style={[styles.rowLabel, { color: textColor }]}>{label}</Text>
      {value ? <Text style={[styles.rowValue, { color: iconColor }]}>{value}</Text> : null}
      {onPress && showChevron ? (
        <Ionicons name="chevron-forward" size={16} color={iconColor} />
      ) : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen({
  theme = 'light',
  myTeam,
  onBack,
  onLogout,
  onWithdraw,
  themeMode = 'system',
  onSetThemeMode,
  customAccent,
  onSetCustomAccent,
  isPremium,
  onSetIsPremium,
}) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';
  const [detailKey, setDetailKey] = useState(null);
  const [pendingAccent, setPendingAccent] = useState(customAccent || '');

  const teamColors = getTeamColors(myTeam);

  // Premium: 프리미엄 업그레이드 (placeholder for future in-app purchase) + 하루
  // 광고 제거하기 (simulated rewarded ad - real ad SDK hooks into startAdSimulation later).
  const [adFreeUntil, setAdFreeUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [adPlaying, setAdPlaying] = useState(false);
  const [adSecondsLeft, setAdSecondsLeft] = useState(AD_WATCH_SECONDS);
  const adTimerRef = useRef(null);

  useEffect(() => {
    storage.getItem(AD_FREE_UNTIL_KEY, 0).then((saved) => setAdFreeUntil(saved || 0));
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => () => clearInterval(adTimerRef.current), []);

  // Ends the ad once the countdown reaches 0. Runs as its own effect (rather
  // than inline inside the setInterval's setState updater) since calling
  // showAlert/storage.setItem synchronously from within another component's
  // state updater triggers "Cannot update a component while rendering a
  // different component" - side effects belong in an effect, not a reducer.
  useEffect(() => {
    if (adPlaying && adSecondsLeft <= 0) {
      clearInterval(adTimerRef.current);
      finishAd();
    }
  }, [adPlaying, adSecondsLeft]);

  const isAdFreeActive = adFreeUntil > now;

  const startAdSimulation = () => {
    setAdSecondsLeft(AD_WATCH_SECONDS);
    setAdPlaying(true);
    adTimerRef.current = setInterval(() => {
      setAdSecondsLeft((prev) => prev - 1);
    }, 1000);
  };

  const finishAd = () => {
    setAdPlaying(false);
    const base = Math.max(Date.now(), adFreeUntil);
    const next = base + AD_FREE_DURATION_MS;
    setAdFreeUntil(next);
    storage.setItem(AD_FREE_UNTIL_KEY, next);
    showAlert('광고 제거 완료', '24시간 동안 광고가 제거됩니다!');
  };

  // Real in-app purchase isn't wired up yet, so this simulates the purchase
  // flow directly - lets premium-gated limits (diary length, photo count) be
  // toggled and tested today (same pattern as the ad-free simulation above).
  const handleUpgradePress = () => {
    if (isPremium) {
      showAlert('프리미엄 해지', '프리미엄 구독을 해지하시겠어요?', [
        { text: '취소', style: 'cancel' },
        { text: '해지하기', style: 'destructive', onPress: () => onSetIsPremium(false) },
      ]);
    } else {
      showAlert('프리미엄 업그레이드', '프리미엄으로 업그레이드하시겠어요? 직관일지를 999자까지 쓰고 이미지를 10장까지 등록할 수 있어요.', [
        { text: '취소', style: 'cancel' },
        { text: '업그레이드', onPress: () => onSetIsPremium(true) },
      ]);
    }
  };

  const confirmLogout = () => {
    showAlert('로그아웃', '정말 로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: onLogout },
    ]);
  };

  const confirmWithdraw = () => {
    showAlert(
      '회원탈퇴',
      '탈퇴 시 직관일지, 지출 내역, 굿즈 등 모든 기록이 삭제되며 복구할 수 없습니다. 정말 탈퇴하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        { text: '탈퇴하기', style: 'destructive', onPress: onWithdraw },
      ]
    );
  };

  const openMail = async (subject) => {
    const url = `mailto:kleaguediary.help@gmail.com?subject=${encodeURIComponent(subject)}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      showAlert('메일 앱을 열 수 없어요', 'kleaguediary.help@gmail.com 으로 직접 메일을 보내주세요.');
    }
  };

  const DETAIL_CONTENT = {
    faq: {
      title: '자주 묻는 질문',
      render: () => (
        <>
          {FAQ_ITEMS.map((item, idx) => (
            <View key={idx} style={styles.faqItem}>
              <Text style={[styles.faqQ, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>Q. {item.q}</Text>
              <Text style={[styles.faqA, { color: activeColors.textBody }]}>A. {item.a}</Text>
            </View>
          ))}
        </>
      ),
    },
    terms: {
      title: '서비스 이용약관',
      render: () => (
        <Text style={[styles.plainText, { color: activeColors.textBody }]}>
          제1조 (목적){'\n'}
          본 약관은 K리그 직관일지(이하 "서비스")의 이용 조건 및 절차, 이용자와 서비스 제공자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.{'\n\n'}
          제2조 (서비스의 제공){'\n'}
          서비스는 이용자가 직접 작성한 직관 기록, 지출 내역, 굿즈 정보 등을 저장·관리할 수 있는 기능을 제공합니다.{'\n\n'}
          제3조 (이용자의 의무){'\n'}
          이용자는 서비스 이용 시 관계 법령과 본 약관을 준수해야 하며, 타인의 정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.{'\n\n'}
          ※ 본 약관은 서비스 출시 전 최종 검토가 필요한 초안입니다.
        </Text>
      ),
    },
    privacy: {
      title: '개인정보 처리방침',
      render: () => (
        <Text style={[styles.plainText, { color: activeColors.textBody }]}>
          1. 수집하는 개인정보 항목{'\n'}
          카카오 계정 로그인 시 닉네임, 프로필 사진 등 최소한의 정보를 수집하며, 이용자가 직접 작성한 직관일지, 지출 내역, 굿즈 정보를 저장합니다.{'\n\n'}
          2. 개인정보의 이용 목적{'\n'}
          로그인 및 서비스 제공, 기기 간 데이터 동기화를 위한 목적으로만 이용됩니다.{'\n\n'}
          3. 개인정보의 보관 및 파기{'\n'}
          회원탈퇴 시 수집된 개인정보와 기록은 지체 없이 파기됩니다.{'\n\n'}
          ※ 본 방침은 서비스 출시 전 최종 검토가 필요한 초안입니다.
        </Text>
      ),
    },
    customTheme: {
      title: '테마 색상',
      render: () => (
        <>
          <Text style={[styles.themeHint, { color: activeColors.textMuted }]}>
            앱 전반의 포인트 색상을 원하는 색으로 바꿀 수 있어요. 라이트/다크 모드 모두 같은 색으로 표시돼요.
          </Text>

          <View style={styles.quickRow}>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: activeColors.borderColor }, !pendingAccent && { borderColor: activeColors.brandNavy, borderWidth: 2 }]}
              onPress={() => setPendingAccent('')}
            >
              <View style={[styles.quickSwatch, styles.defaultSwatch]}>
                <View style={{ flex: 1, backgroundColor: '#001C48' }} />
                <View style={{ flex: 1, backgroundColor: '#EE3224' }} />
              </View>
              <Text style={[styles.quickBtnText, { color: activeColors.textBody }]}>기본</Text>
            </TouchableOpacity>

            {teamColors.length === 0 ? (
              <View style={[styles.quickBtn, styles.quickBtnDisabled, { borderColor: activeColors.borderColor }]}>
                <View style={[styles.quickSwatch, { backgroundColor: '#cccccc' }]} />
                <Text style={[styles.quickBtnText, { color: activeColors.textBody }]}>마이팀 미설정</Text>
              </View>
            ) : (
              teamColors.map((hex, idx) => (
                <TouchableOpacity
                  key={hex}
                  style={[
                    styles.quickBtn,
                    { borderColor: activeColors.borderColor },
                    pendingAccent === hex && { borderColor: activeColors.brandNavy, borderWidth: 2 },
                  ]}
                  onPress={() => setPendingAccent(hex)}
                >
                  <View style={[styles.quickSwatch, { backgroundColor: hex }]} />
                  <Text style={[styles.quickBtnText, { color: activeColors.textBody }]}>
                    마이팀 컬러 {idx + 1}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: activeColors.brandNavy }]}
            onPress={() => {
              onSetCustomAccent(pendingAccent);
              setDetailKey(null);
            }}
          >
            <Text style={styles.applyBtnText}>적용</Text>
          </TouchableOpacity>
        </>
      ),
    },
  };

  if (detailKey) {
    const detail = DETAIL_CONTENT[detailKey];
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
        <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
          <TouchableOpacity onPress={() => setDetailKey(null)} style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>{detail.title}</Text>
          <View style={styles.headerBtn} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">{detail.render()}</ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>설정</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>테마</Text>
        <View style={[styles.sectionCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <View style={styles.themeModeBlock}>
            <Text style={[styles.themeModeLabel, { color: activeColors.textBody }]}>화면 모드</Text>
            <View style={[styles.segmentedRow, { backgroundColor: activeColors.bgTag }]}>
              {THEME_MODE_OPTIONS.map((opt) => {
                const isActive = themeMode === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.segmentedBtn, isActive && { backgroundColor: activeColors.bgCard }]}
                    onPress={() => onSetThemeMode(opt.key)}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={14}
                      color={isActive ? (isDark ? '#ffffff' : activeColors.brandNavy) : activeColors.textMuted}
                    />
                    <Text style={[styles.segmentedBtnText, { color: isActive ? (isDark ? '#ffffff' : activeColors.brandNavy) : activeColors.textMuted }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={[styles.divider, { marginLeft: 0, backgroundColor: activeColors.borderColor }]} />
          <SettingsRow
            icon="color-palette-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="테마 색상"
            onPress={() => setDetailKey('customTheme')}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>프리미엄</Text>
        <View style={[styles.sectionCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <SettingsRow
            icon="diamond-outline"
            iconColor="#FBC02D"
            textColor={activeColors.textBody}
            label={isPremium ? '프리미엄 이용 중' : '프리미엄 업그레이드'}
            value={isPremium ? '해지하기' : '업그레이드'}
            onPress={handleUpgradePress}
          />
          <View style={[styles.divider, { backgroundColor: activeColors.borderColor }]} />
          <SettingsRow
            icon={isAdFreeActive ? 'checkmark-circle-outline' : 'play-circle-outline'}
            iconColor={isAdFreeActive ? '#10B981' : activeColors.textMuted}
            textColor={activeColors.textBody}
            label="하루 광고 제거하기"
            value={isAdFreeActive ? formatRemaining(adFreeUntil - now) : null}
            onPress={isAdFreeActive ? undefined : startAdSimulation}
            showChevron={!isAdFreeActive}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>정보</Text>
        <View style={[styles.sectionCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <SettingsRow
            icon="help-circle-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="자주 묻는 질문"
            onPress={() => setDetailKey('faq')}
          />
          <View style={[styles.divider, { backgroundColor: activeColors.borderColor }]} />
          <SettingsRow
            icon="information-circle-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="버전정보"
            value={`v${APP_VERSION}`}
          />
          <View style={[styles.divider, { backgroundColor: activeColors.borderColor }]} />
          <SettingsRow
            icon="document-text-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="서비스 이용약관"
            onPress={() => setDetailKey('terms')}
          />
          <View style={[styles.divider, { backgroundColor: activeColors.borderColor }]} />
          <SettingsRow
            icon="shield-checkmark-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="개인정보 처리방침"
            onPress={() => setDetailKey('privacy')}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>지원</Text>
        <View style={[styles.sectionCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <SettingsRow
            icon="bug-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="버그/오류 제보"
            onPress={() => openMail('[버그 제보] ')}
          />
          <View style={[styles.divider, { backgroundColor: activeColors.borderColor }]} />
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="의견 보내기"
            onPress={() => openMail('[의견 보내기] ')}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: activeColors.textMuted }]}>계정</Text>
        <View style={[styles.sectionCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
          <SettingsRow
            icon="log-out-outline"
            iconColor={activeColors.textMuted}
            textColor={activeColors.textBody}
            label="로그아웃"
            onPress={confirmLogout}
          />
          <View style={[styles.divider, { backgroundColor: activeColors.borderColor }]} />
          <SettingsRow
            icon="person-remove-outline"
            iconColor="#EE3224"
            textColor="#EE3224"
            label="회원탈퇴"
            onPress={confirmWithdraw}
            showChevron={false}
          />
        </View>
      </ScrollView>

      {/* Simulated rewarded-ad placeholder - real ad SDK hooks in here later */}
      <Modal visible={adPlaying} transparent animationType="fade">
        <View style={styles.adOverlay}>
          <View style={[styles.adBox, { backgroundColor: activeColors.bgCard }]}>
            <Ionicons name="tv-outline" size={36} color={activeColors.textMuted} />
            <Text style={[styles.adText, { color: activeColors.textBody }]}>광고 재생 중...</Text>
            <Text style={[styles.adTimer, { color: activeColors.textMuted }]}>{adSecondsLeft}초 후 완료</Text>
          </View>
        </View>
      </Modal>
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
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 4,
  },
  sectionCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  rowIcon: {
    width: 20,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
  },
  rowValue: {
    fontSize: 12.5,
    fontWeight: '700',
    marginRight: 4,
  },
  divider: {
    height: 1,
    marginLeft: 44,
  },
  faqItem: {
    marginBottom: 20,
  },
  faqQ: {
    fontSize: 13.5,
    fontWeight: '900',
    marginBottom: 6,
  },
  faqA: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 19,
  },
  plainText: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 21,
  },
  themeModeBlock: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  themeModeLabel: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  segmentedRow: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
  },
  segmentedBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 6,
  },
  segmentedBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  themeHint: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 20,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  quickBtnDisabled: {
    opacity: 0.4,
  },
  quickSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  defaultSwatch: {
    borderWidth: 0,
  },
  quickBtnText: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  applyBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  adOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adBox: {
    width: 220,
    borderRadius: 14,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  adText: {
    fontSize: 13,
    fontWeight: '800',
  },
  adTimer: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
