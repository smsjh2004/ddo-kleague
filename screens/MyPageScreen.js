import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { storage } from '../utils/storage';
import { getBingoGrid, getStampedStadiumKeys } from '../constants/stadiumBingo';
import { getAchievementTitle, getAchievements } from '../utils/achievements';
import useDragReorder from '../hooks/useDragReorder';
import AdBanner from '../components/AdBanner';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import SettingsScreen from './SettingsScreen';
import ProfileEditScreen from './ProfileEditScreen';
import AchievementsScreen from './AchievementsScreen';
import FriendsScreen from './FriendsScreen';
import GoodsScreen from './GoodsScreen';
import BingoScreen from './BingoScreen';

const DEFAULT_SECTION_ORDER = ['achievements', 'friends', 'goods', 'bingo'];
const SECTION_ORDER_KEY = 'kleague_mypage_section_order';
const TILE_ROW_HEIGHT = 82; // tile height + marginBottom, used to convert drag distance into swaps

// "울산 HD FC" -> "울산", "FC 서울" -> "서울", "제주 SK FC" -> "제주" etc,
// so the avatar corner badge can show a short team name instead of the league.
function getTeamShortLabel(teamName) {
  if (!teamName) return '';
  let name = teamName.trim();
  if (name.startsWith('FC ')) name = name.slice(3);
  name = name.replace(/\s*(HD|SK)?\s*FC\s*\d*$/, '').trim();
  return name.slice(0, 2);
}

export default function MyPageScreen({
  theme = 'light',
  nickname,
  myTeam,
  avatarUrl,
  logs = [],
  goods = [],
  goodsLogLinks = [],
  onLogout,
  onWithdraw,
  onSaveSettings,
  onSaveGoods,
  onDeleteGoods,
  themeMode,
  onSetThemeMode,
  customAccent,
  onSetCustomAccent,
  isPremium,
  onSetIsPremium,
  adFreeUntil,
  onSetAdFreeUntil,
  isAdFree = false,
  userId,
  pendingFriendCode,
  onConsumeFriendCode,
}) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [profileEditVisible, setProfileEditVisible] = useState(false);
  const [activeSubScreen, setActiveSubScreen] = useState(null); // achievements, friends, goods, bingo
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_SECTION_ORDER);
  const [editMode, setEditMode] = useState(false);

  // Friend deep link (kleaguediary://friend/CODE) - jump straight into the
  // friends subscreen; FriendsScreen consumes the code from there.
  useEffect(() => {
    if (pendingFriendCode) {
      setSettingsVisible(false);
      setProfileEditVisible(false);
      setActiveSubScreen('friends');
    }
  }, [pendingFriendCode]);

  useEffect(() => {
    storage.getItem(SECTION_ORDER_KEY, DEFAULT_SECTION_ORDER).then((saved) => {
      const isValid = Array.isArray(saved) &&
        saved.length === DEFAULT_SECTION_ORDER.length &&
        DEFAULT_SECTION_ORDER.every((k) => saved.includes(k));
      setSectionOrder(isValid ? saved : DEFAULT_SECTION_ORDER);
    });
  }, []);

  const moveSection = (key, direction) => {
    const index = sectionOrder.indexOf(key);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sectionOrder.length) return;
    const next = [...sectionOrder];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setSectionOrder(next);
    storage.setItem(SECTION_ORDER_KEY, next);
  };

  // Drag-to-reorder for the tile list, via the left-side drag handle.
  const { dragKey, dragY, getDragResponder } = useDragReorder(
    sectionOrder, setSectionOrder, TILE_ROW_HEIGHT, SECTION_ORDER_KEY
  );

  const title = useMemo(() => getAchievementTitle(logs, myTeam), [logs, myTeam]);
  const achievements = useMemo(
    () => getAchievements(logs, myTeam, goods, goodsLogLinks),
    [logs, myTeam, goods, goodsLogLinks]
  );
  const unlockedCount = useMemo(() => achievements.filter((a) => a.unlocked).length, [achievements]);
  const k1Stamped = useMemo(
    () => getStampedStadiumKeys(logs, getBingoGrid('k1', myTeam, 0)).size,
    [logs, myTeam]
  );
  const k2Stamped = useMemo(
    () => getStampedStadiumKeys(logs, getBingoGrid('k2', myTeam, 0)).size,
    [logs, myTeam]
  );
  const teamShortLabel = getTeamShortLabel(myTeam);

  if (settingsVisible) {
    return (
      <SettingsScreen
        theme={theme}
        myTeam={myTeam}
        onBack={() => setSettingsVisible(false)}
        onLogout={onLogout}
        onWithdraw={onWithdraw}
        themeMode={themeMode}
        onSetThemeMode={onSetThemeMode}
        customAccent={customAccent}
        onSetCustomAccent={onSetCustomAccent}
        isPremium={isPremium}
        onSetIsPremium={onSetIsPremium}
        adFreeUntil={adFreeUntil}
        onSetAdFreeUntil={onSetAdFreeUntil}
      />
    );
  }

  if (profileEditVisible) {
    return (
      <ProfileEditScreen
        theme={theme}
        nickname={nickname}
        myTeam={myTeam}
        avatarUrl={avatarUrl}
        onBack={() => setProfileEditVisible(false)}
        onSave={(selections) => {
          onSaveSettings(selections);
          setProfileEditVisible(false);
        }}
      />
    );
  }

  if (activeSubScreen === 'achievements') {
    return (
      <AchievementsScreen
        theme={theme}
        logs={logs}
        myTeam={myTeam}
        goods={goods}
        goodsLogLinks={goodsLogLinks}
        onBack={() => setActiveSubScreen(null)}
      />
    );
  }

  if (activeSubScreen === 'friends') {
    return (
      <FriendsScreen
        theme={theme}
        onBack={() => setActiveSubScreen(null)}
        userId={userId}
        nickname={nickname}
        initialSearchCode={pendingFriendCode}
        onConsumeSearchCode={onConsumeFriendCode}
        myLogs={logs}
        myTeam={myTeam}
      />
    );
  }

  if (activeSubScreen === 'goods') {
    return (
      <GoodsScreen
        theme={theme}
        goods={goods}
        goodsLogLinks={goodsLogLinks}
        logs={logs}
        myTeam={myTeam}
        onBack={() => setActiveSubScreen(null)}
        onSaveGoods={onSaveGoods}
        onDeleteGoods={onDeleteGoods}
      />
    );
  }

  if (activeSubScreen === 'bingo') {
    return <BingoScreen theme={theme} logs={logs} myTeam={myTeam} onBack={() => setActiveSubScreen(null)} />;
  }

  const renderReorderControls = (key) => {
    if (!editMode) return null;
    const index = sectionOrder.indexOf(key);
    return (
      <View style={styles.reorderControls}>
        <TouchableOpacity
          onPress={() => moveSection(key, 'up')}
          disabled={index === 0}
          style={styles.moveBtn}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="chevron-up" size={16} color={index === 0 ? activeColors.borderColor : activeColors.textBody} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => moveSection(key, 'down')}
          disabled={index === sectionOrder.length - 1}
          style={styles.moveBtn}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="chevron-down" size={16} color={index === sectionOrder.length - 1 ? activeColors.borderColor : activeColors.textBody} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderTile = (key, emoji, label, subtitle) => (
    <Animated.View
      key={key}
      style={[
        styles.tile,
        { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor },
        dragKey === key && [styles.tileDragging, { transform: [{ translateY: dragY }] }],
      ]}
    >
      {editMode && (
        <View
          style={styles.dragHandle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          {...getDragResponder(key).panHandlers}
        >
          <MaterialIcons name="drag-indicator" size={20} color={activeColors.textMuted} />
        </View>
      )}
      <TouchableOpacity
        style={styles.tileMain}
        onPress={() => setActiveSubScreen(key)}
        activeOpacity={0.7}
        disabled={editMode}
      >
        <View style={[styles.tileEmojiWrap, { backgroundColor: activeColors.bgTag }]}>
          <Text style={styles.tileEmoji}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tileTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>{label}</Text>
          <Text style={[styles.tileSubtitle, { color: activeColors.textMuted }]}>{subtitle}</Text>
        </View>
        {!editMode && <Ionicons name="chevron-forward" size={18} color={activeColors.textMuted} />}
      </TouchableOpacity>
      {renderReorderControls(key)}
    </Animated.View>
  );

  const SECTION_RENDERERS = {
    achievements: () => renderTile('achievements', '🎖️', '업적', `${unlockedCount} / ${achievements.length} 달성`),
    friends: () => renderTile('friends', '🤝', '친구', '친구코드로 직관 메이트 추가'),
    goods: () => renderTile('goods', '🧥', '굿즈 보관함', `${goods.length}개 등록됨`),
    bingo: () => renderTile('bingo', '📍', '원정 구단 도장깨기', `K1 ${k1Stamped}/9 · K2 ${k2Stamped}/16`),
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <AdBanner hidden={isAdFree} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Header Card */}
        <View style={[styles.headerCard, { backgroundColor: activeColors.brandNavy }]}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTopLeft}>
              <Ionicons name="person-circle-outline" size={18} color="#ffffff" />
              <Text style={styles.headerCardTitle}>마이페이지</Text>
            </View>
            <View style={styles.headerTopRight}>
              <TouchableOpacity onPress={() => setEditMode(!editMode)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="options-outline" size={20} color={editMode ? '#FBC02D' : '#ffffff'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSettingsVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="settings-outline" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={[styles.avatarImg, { borderColor: isDark ? '#001C48' : '#EE3224' }]} />
              ) : (
                <View style={[styles.avatarImg, styles.avatarPlaceholder, { borderColor: isDark ? '#001C48' : '#EE3224' }]}>
                  <Ionicons name="person" size={30} color="rgba(255,255,255,0.5)" />
                </View>
              )}
              {teamShortLabel !== '' && (
                <View style={[styles.teamBadge, { backgroundColor: activeColors.brandRed }]}>
                  <Text style={styles.teamBadgeText} numberOfLines={1}>{teamShortLabel}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.editAvatarBadge, { backgroundColor: '#ffffff', borderColor: activeColors.brandNavy }]}
                onPress={() => setProfileEditVisible(true)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="pencil" size={11} color={activeColors.brandNavy} />
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfoCol}>
              <View style={styles.nicknameRow}>
                <Text style={styles.nicknameText} numberOfLines={1}>{nickname}</Text>
                {myTeam ? (
                  <View style={styles.teamPill}>
                    <Text style={styles.teamPillText} numberOfLines={1}>{myTeam.replace(' FC', '')} 팬</Text>
                  </View>
                ) : null}
              </View>
              <View style={[styles.titlePill, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.titlePillText} numberOfLines={1}>{title.emoji} {title.text}</Text>
              </View>
            </View>
          </View>
        </View>

        {editMode && (
          <Text style={[styles.editHint, { color: activeColors.textMuted }]}>
            ⠿ 손잡이를 드래그하거나 화살표로 순서를 바꾸세요.
          </Text>
        )}

        {sectionOrder.map((key) => (SECTION_RENDERERS[key] ? SECTION_RENDERERS[key]() : null))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    position: 'relative',
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#EE3224',
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadge: {
    position: 'absolute',
    bottom: -2,
    left: -4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#001C48',
    maxWidth: 40,
  },
  teamBadgeText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900',
  },
  editAvatarBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfoCol: {
    flex: 1,
    gap: 6,
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nicknameText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    flexShrink: 1,
  },
  teamPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  teamPillText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
  },
  titlePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  titlePillText: {
    color: '#FBC02D',
    fontSize: 11.5,
    fontWeight: '800',
  },
  editHint: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 10,
    marginLeft: 2,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  tileDragging: {
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 10,
  },
  dragHandle: {
    paddingLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  tileEmojiWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileEmoji: {
    fontSize: 20,
  },
  tileTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 2,
  },
  tileSubtitle: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  reorderControls: {
    flexDirection: 'row',
    gap: 2,
    paddingRight: 12,
  },
  moveBtn: {
    padding: 3,
  },
});
