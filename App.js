import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Image,
  useColorScheme,
  Linking,
} from 'react-native';
import { storage } from './utils/storage';
import {
  supabase,
  getProfile,
  upsertProfile,
  deleteProfileRemote,
  deleteAccountRemote,
  upsertDiaryLog,
  listDiaryLogs,
  deleteDiaryLogRemote,
  upsertExpense,
  listExpenses,
  deleteExpenseRemote,
  listGoods,
  listGoodsLogLinks,
  upsertGoodsItem,
  deleteGoodsItem,
  setGoodsLogLinks,
  setLogGoodsLinks,
  listFriends,
} from './utils/api';
import { signOut, unlinkKakao } from './utils/auth';
import { getAchievements } from './utils/achievements';
import { showAchievementUnlock } from './utils/achievementAlert';
import { initAds } from './utils/ads';
import AdBanner from './components/AdBanner';
import { Colors, applyAccentColor } from './constants/Colors';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import TutorialScreen from './screens/TutorialScreen';
import CalendarScreen from './screens/CalendarScreen';
import DiaryListScreen from './screens/DiaryListScreen';
import DiaryWriteScreen from './screens/DiaryWriteScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import WalletScreen from './screens/WalletScreen';
import MyPageScreen from './screens/MyPageScreen';
import AppAlertHost from './components/AppAlertHost';
import AchievementModal from './components/AchievementModal';
import { Ionicons } from '@expo/vector-icons';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [myTeam, setMyTeam] = useState('');
  const [themeMode, setThemeModeState] = useState('system'); // system, light, dark
  const [customAccent, setCustomAccentState] = useState('');
  const [isPremium, setIsPremiumState] = useState(false);
  const [adFreeUntil, setAdFreeUntilState] = useState(0);
  const [activeTab, setActiveTab] = useState('schedule'); // schedule, record, wallet, mypage
  const [recordSubTab, setRecordSubTab] = useState('list'); // list, analysis
  const [writeAutofill, setWriteAutofill] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isWriting, setIsWriting] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [focusedLogId, setFocusedLogId] = useState(null);
  const [editingLog, setEditingLog] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [session, setSession] = useState(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [goods, setGoods] = useState([]);
  const [goodsLogLinks, setGoodsLogLinksState] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingFriendCode, setPendingFriendCode] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const systemScheme = useColorScheme();
  const theme = themeMode === 'system' ? (systemScheme || 'light') : themeMode;
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';
  const activeTabColor = isDark ? activeColors.brandRed : activeColors.brandNavy;
  const isAdFree = isPremium || adFreeUntil > Date.now();

  // Look up the profile row for a logged-in Kakao user (null if they haven't
  // finished onboarding yet).
  const loadProfile = async (userId) => {
    const profile = await getProfile(userId);
    if (profile) {
      setHasProfile(true);
      setNickname(profile.nickname || '');
      setMyTeam(profile.my_team || '');
      setAvatarUrl(profile.avatar_url || '');
    } else {
      setHasProfile(false);
    }

    const [goodsList, goodsLinks, friendRows, logsList, expensesList] = await Promise.all([
      listGoods(userId),
      listGoodsLogLinks(userId),
      listFriends(userId),
      listDiaryLogs(userId),
      listExpenses(userId),
    ]);
    setGoods(goodsList || []);
    setGoodsLogLinksState(goodsLinks || []);
    setFriends((friendRows || []).map((r) => (r.requester_id === userId ? r.addressee : r.requester)).filter(Boolean));
    // null means the fetch failed/offline - keep whatever's cached locally
    // rather than wiping the screen; a successful fetch is the source of truth.
    if (logsList) {
      setLogs(logsList);
      storage.setItem('kleague_logs', logsList);
    }
    if (expensesList) {
      setExpenses(expensesList);
      storage.setItem('kleague_expenses', expensesList);
    }
  };

  // Kakao's profile photo shows up under different keys depending on how
  // Supabase normalizes it - check the common ones.
  const getKakaoAvatarUrl = (currentSession) => {
    const metadata = currentSession?.user?.user_metadata || {};
    return metadata.avatar_url || metadata.picture || '';
  };

  // Load local cache + current Supabase Auth session on launch
  useEffect(() => {
    async function loadConfig() {
      try {
        const savedThemeMode = await storage.getItem('kleague_theme_mode', 'system');
        const savedAccent = await storage.getItem('kleague_custom_accent', '');
        const savedIsPremium = await storage.getItem('kleague_is_premium', false);
        const savedAdFreeUntil = await storage.getItem('kleague_adfree_until', 0);
        const savedLogs = await storage.getItem('kleague_logs', []);
        const savedExpenses = await storage.getItem('kleague_expenses', []);

        // Static schedule data only - no auto score-fetching (client or
        // server-side), by explicit decision. Cache wins if present so any
        // manual edits persist across restarts; otherwise falls back to the
        // bundled schedule.json.
        const cachedSchedule = await storage.getItem('kleague_schedule_cache', null);
        if (cachedSchedule) {
          setSchedule(cachedSchedule);
        } else {
          const initialSchedule = require('./constants/schedule.json');
          setSchedule(initialSchedule);
        }

        setThemeModeState(savedThemeMode);
        setCustomAccentState(savedAccent);
        applyAccentColor(savedAccent);
        setIsPremiumState(savedIsPremium || false);
        setAdFreeUntilState(savedAdFreeUntil || 0);
        setLogs(savedLogs);
        setExpenses(savedExpenses);
        initAds();

        if (supabase) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          setSession(currentSession);
          if (currentSession) {
            await loadProfile(currentSession.user.id);
          }
        }
      } catch (err) {
        console.error('Failed to load storage config:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();

    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        if (newSession) {
          loadProfile(newSession.user.id);
        } else {
          setHasProfile(false);
          setNickname('');
          setMyTeam('');
          setAvatarUrl('');
          setGoods([]);
          setGoodsLogLinksState([]);
          setFriends([]);
        }
      });
      return () => authListener.subscription.unsubscribe();
    }
  }, []);

  // Autofill redirect effect
  useEffect(() => {
    if (writeAutofill && activeTab === 'record') {
      setIsWriting(true);
    }
  }, [writeAutofill, activeTab]);

  // Friend invite deep link: kleaguediary://friend/CODE (native) or
  // ?friend=CODE (web). Jumps to My Page and hands the code down so the
  // friends screen can prefill + search it.
  useEffect(() => {
    const handleUrl = (url) => {
      if (!url) return;
      const match = url.match(/friend[/=]([A-Z0-9]{4,12})/i);
      if (match) {
        setPendingFriendCode(match[1].toUpperCase());
        setActiveTab('mypage');
      }
    };
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  const handleOnboardingComplete = async (selections) => {
    try {
      setIsLoading(true);
      setNickname(selections.nickname);
      setMyTeam(selections.myTeam);

      if (session) {
        const chosenAvatarUrl = selections.avatar || getKakaoAvatarUrl(session);
        await upsertProfile(session.user.id, { ...selections, avatarUrl: chosenAvatarUrl });
        setAvatarUrl(chosenAvatarUrl);
        setHasProfile(true);
        setShowTutorial(true);
      }
    } catch (err) {
      console.error('Failed to save onboarding data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLog = async (newLog, integratedExpenses = [], selectedGoodsIds = []) => {
    const exists = logs.some((l) => l.id === newLog.id);
    let nextLogs;
    if (exists) {
      nextLogs = logs.map((l) => l.id === newLog.id ? newLog : l);
    } else {
      nextLogs = [newLog, ...logs];
    }

    // Diff achievements before/after so only genuinely new unlocks alert -
    // getAchievements is a pure recompute over the full log list, not stored state.
    const prevUnlocked = new Set(getAchievements(logs, myTeam, goods, goodsLogLinks).filter((a) => a.unlocked).map((a) => a.id));
    const newlyUnlocked = getAchievements(nextLogs, myTeam, goods, goodsLogLinks).filter((a) => a.unlocked && !prevUnlocked.has(a.id));

    setLogs(nextLogs);
    await storage.setItem('kleague_logs', nextLogs);

    const removedExpenseIds = expenses
      .filter((e) => e.matchId === newLog.id && !integratedExpenses.some((ie) => ie.id === e.id))
      .map((e) => e.id);
    const cleanExpenses = expenses.filter((e) => e.matchId !== newLog.id);
    const nextExpenses = [...integratedExpenses, ...cleanExpenses];
    setExpenses(nextExpenses);
    await storage.setItem('kleague_expenses', nextExpenses);

    const nextGoodsLinks = [
      ...goodsLogLinks.filter((l) => l.diary_log_id !== newLog.id),
      ...selectedGoodsIds.map((goodsId) => ({ goods_id: goodsId, diary_log_id: newLog.id })),
    ];
    setGoodsLogLinksState(nextGoodsLinks);

    setIsWriting(false);
    setEditingLog(null);

    if (session) {
      const userId = session.user.id;
      upsertDiaryLog(userId, newLog);
      integratedExpenses.forEach((exp) => upsertExpense(userId, exp));
      removedExpenseIds.forEach((id) => deleteExpenseRemote(userId, id));
      setLogGoodsLinks(newLog.id, selectedGoodsIds);
    }

    showAchievementUnlock(newlyUnlocked);
  };

  const handleDeleteLog = async (logId) => {
    const nextLogs = logs.filter((l) => l.id !== logId);
    setLogs(nextLogs);
    await storage.setItem('kleague_logs', nextLogs);
    // Also clean up any expenses associated with this log
    const nextExpenses = expenses.filter((e) => e.matchId !== logId);
    setExpenses(nextExpenses);
    await storage.setItem('kleague_expenses', nextExpenses);

    if (session) {
      // Deleting the diary_logs row cascades to its expenses server-side (see supabase/schema.sql)
      deleteDiaryLogRemote(session.user.id, logId);
    }
  };

  const handleSaveExpense = async (savedExpense) => {
    let nextExpenses;
    const exists = expenses.find((e) => e.id === savedExpense.id);
    if (exists) {
      nextExpenses = expenses.map((e) => e.id === savedExpense.id ? savedExpense : e);
    } else {
      nextExpenses = [savedExpense, ...expenses];
    }
    setExpenses(nextExpenses);
    await storage.setItem('kleague_expenses', nextExpenses);

    if (session) {
      upsertExpense(session.user.id, savedExpense);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    const nextExpenses = expenses.filter((e) => e.id !== expenseId);
    setExpenses(nextExpenses);
    await storage.setItem('kleague_expenses', nextExpenses);

    if (session) {
      deleteExpenseRemote(session.user.id, expenseId);
    }
  };

  const handleSaveSettings = async (selections) => {
    setNickname(selections.nickname);
    setMyTeam(selections.myTeam);
    setAvatarUrl(selections.avatar || '');

    if (session) {
      await upsertProfile(session.user.id, { ...selections, avatarUrl: selections.avatar });
    }
  };

  // linkedLogIds is only ever passed on create (as []) - editing an existing
  // goods item leaves its match links untouched, since those are now only
  // managed from the diary write flow (see handleSaveLog).
  const handleSaveGoodsItem = async (goodsItem, linkedLogIds) => {
    const exists = goods.some((g) => g.id === goodsItem.id);
    const nextGoods = exists
      ? goods.map((g) => (g.id === goodsItem.id ? { ...g, name: goodsItem.name, category: goodsItem.category, photo_url: goodsItem.photoUrl } : g))
      : [{ id: goodsItem.id, name: goodsItem.name, category: goodsItem.category, photo_url: goodsItem.photoUrl }, ...goods];
    setGoods(nextGoods);

    if (linkedLogIds !== undefined) {
      const nextLinks = [
        ...goodsLogLinks.filter((l) => l.goods_id !== goodsItem.id),
        ...linkedLogIds.map((logId) => ({ goods_id: goodsItem.id, diary_log_id: logId })),
      ];
      setGoodsLogLinksState(nextLinks);
    }

    if (session) {
      await upsertGoodsItem(session.user.id, goodsItem);
      if (linkedLogIds !== undefined) {
        await setGoodsLogLinks(goodsItem.id, linkedLogIds);
      }
    }
  };

  const handleDeleteGoodsItem = async (goodsId) => {
    setGoods(goods.filter((g) => g.id !== goodsId));
    setGoodsLogLinksState(goodsLogLinks.filter((l) => l.goods_id !== goodsId));

    if (session) {
      await deleteGoodsItem(goodsId);
    }
  };

  const setThemeMode = async (mode) => {
    setThemeModeState(mode);
    await storage.setItem('kleague_theme_mode', mode);
  };

  const toggleTheme = () => {
    setThemeMode(theme === 'light' ? 'dark' : 'light');
  };

  const setCustomAccent = async (hex) => {
    applyAccentColor(hex);
    setCustomAccentState(hex);
    await storage.setItem('kleague_custom_accent', hex);
  };

  // Local-only stand-in until real in-app purchase is wired up - lets premium
  // gated limits (diary length, photo count) be tested/toggled today.
  const setIsPremium = async (value) => {
    setIsPremiumState(value);
    await storage.setItem('kleague_is_premium', value);
  };

  const setAdFreeUntil = async (value) => {
    setAdFreeUntilState(value);
    await storage.setItem('kleague_adfree_until', value);
  };

  const handleLogout = async () => {
    setIsLoading(true);
    await signOut();
    await storage.clear();
    setNickname('');
    setMyTeam('');
    setLogs([]);
    setExpenses([]);
    setHasProfile(false);
    setAvatarUrl('');
    setGoods([]);
    setGoodsLogLinksState([]);
    setIsLoading(false);
  };

  // Full account purge: the delete-account Edge Function removes the
  // auth.users row, and profiles/diary_logs/expenses/goods all cascade off it
  // (see supabase/schema.sql). If that call fails - function not deployed yet,
  // no network - fall back to deleting the profile row, which still wipes
  // every piece of user data the client can reach.
  const handleWithdraw = async () => {
    setIsLoading(true);
    if (session) {
      const purged = await deleteAccountRemote();
      if (!purged) await deleteProfileRemote(session.user.id);
    }
    // Also drop the Kakao app connection, so withdrawing really disconnects
    // rather than leaving 또직관 listed in the user's linked Kakao services.
    await unlinkKakao();
    await signOut();
    await storage.clear();
    setNickname('');
    setMyTeam('');
    setLogs([]);
    setExpenses([]);
    setHasProfile(false);
    setAvatarUrl('');
    setGoods([]);
    setGoodsLogLinksState([]);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingCenter, { backgroundColor: activeColors.bgBody }]}>
        <ActivityIndicator size="large" color={activeColors.brandNavy} />
      </View>
    );
  }

  // Not logged in yet - show Kakao login
  if (!session) {
    return (
      <>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <LoginScreen theme={theme} onLoggedIn={() => {}} />
        <AppAlertHost theme={theme} />
      </>
    );
  }

  // Logged in but hasn't picked a team/nickname yet
  if (!hasProfile) {
    return (
      <>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <OnboardingScreen
          theme={theme}
          onComplete={handleOnboardingComplete}
          defaultAvatarUrl={getKakaoAvatarUrl(session)}
        />
        <AppAlertHost theme={theme} />
      </>
    );
  }

  // First-time signup only - a short swipeable walkthrough of core features
  // before landing in the main app shell.
  if (showTutorial) {
    return (
      <>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <TutorialScreen theme={theme} onFinish={() => setShowTutorial(false)} />
        <AppAlertHost theme={theme} />
      </>
    );
  }

  // Render main app layout with tabs mock shell
  const getTabTitle = () => {
    switch (activeTab) {
      case 'schedule': return '경기 일정';
      case 'record': return '나의 직관';
      case 'wallet': return '나의 지출';
      case 'mypage': return '마이페이지';
      default: return '또직관';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: activeColors.bgBody }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Dynamic Header (hidden on My Page so its own navy card sits at the very top) */}
      {activeTab !== 'mypage' && (
        <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
          <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>
            {getTabTitle()}
          </Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
              <Ionicons
                name={theme === 'dark' ? 'sunny' : 'moon'}
                size={18}
                color={activeColors.textBody}
              />
            </TouchableOpacity>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
            ) : (
              <Ionicons name="person-circle" size={22} color={activeColors.textMuted} />
            )}
            <Text style={[styles.headerUserText, { color: activeColors.textBody }]}>
              {nickname}님
            </Text>
          </View>
        </View>
      )}

      {/* Main View Port Container */}
      <View style={styles.mainViewport}>
        {activeTab === 'schedule' && (
          <CalendarScreen
            theme={theme}
            logs={logs}
            myTeam={myTeam}
            schedule={schedule}
            isAdFree={isAdFree}
            onWriteDiary={(matchDetails) => {
              setWriteAutofill(matchDetails);
              setActiveTab('record');
            }}
            onViewDiaryDetail={(logId) => {
              setFocusedLogId(logId);
              setRecordSubTab('list');
              setIsWriting(false);
              setActiveTab('record');
            }}
          />
        )}
        {activeTab === 'record' && (
          isWriting ? (
            <DiaryWriteScreen
              theme={theme}
              onSave={handleSaveLog}
              onCancel={() => {
                setIsWriting(false);
                setEditingLog(null);
              }}
              autofillData={writeAutofill}
              clearAutofill={() => setWriteAutofill(null)}
              editLogData={editingLog}
              existingExpenses={expenses.filter((e) => e.matchId === editingLog?.id)}
              goods={goods}
              existingGoodsIds={goodsLogLinks.filter((l) => l.diary_log_id === editingLog?.id).map((l) => l.goods_id)}
              onSaveGoods={handleSaveGoodsItem}
              isPremium={isPremium}
              friends={friends}
            />
          ) : (
            <View style={{ flex: 1 }}>
              {/* Record Sub Tab Selector */}
              <View style={[styles.subTabsContainer, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
                <TouchableOpacity
                  style={[styles.subTab, recordSubTab === 'list' && [styles.subTabActive, { borderColor: activeTabColor }]]}
                  onPress={() => setRecordSubTab('list')}
                >
                  <Text style={[styles.subTabText, { color: recordSubTab === 'list' ? activeTabColor : activeColors.textMuted }]}>
                    직관일지
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subTab, recordSubTab === 'analysis' && [styles.subTabActive, { borderColor: activeTabColor }]]}
                  onPress={() => setRecordSubTab('analysis')}
                >
                  <Text style={[styles.subTabText, { color: recordSubTab === 'analysis' ? activeTabColor : activeColors.textMuted }]}>
                    직관분석
                  </Text>
                </TouchableOpacity>
              </View>

              {recordSubTab === 'list' ? (
                <DiaryListScreen
                  theme={theme}
                  logs={logs}
                  expenses={expenses}
                  myTeam={myTeam}
                  isAdFree={isAdFree}
                  goods={goods}
                  goodsLogLinks={goodsLogLinks}
                  onDeleteLog={handleDeleteLog}
                  onOpenWriteForm={() => setIsWriting(true)}
                  focusedLogId={focusedLogId}
                  clearFocusedLogId={() => setFocusedLogId(null)}
                  onEditLog={(log) => {
                    setEditingLog(log);
                    setIsWriting(true);
                  }}
                />
              ) : (
                <AnalysisScreen
                  theme={theme}
                  logs={logs}
                  myTeam={myTeam}
                />
              )}
            </View>
          )
        )}
        {activeTab === 'wallet' && (
          <WalletScreen
            theme={theme}
            expenses={expenses}
            logs={logs}
            isAdFree={isAdFree}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        )}
        {activeTab === 'mypage' && (
          <MyPageScreen
            theme={theme}
            nickname={nickname}
            myTeam={myTeam}
            avatarUrl={avatarUrl}
            logs={logs}
            goods={goods}
            goodsLogLinks={goodsLogLinks}
            onLogout={handleLogout}
            onWithdraw={handleWithdraw}
            onSaveSettings={handleSaveSettings}
            onSaveGoods={handleSaveGoodsItem}
            onDeleteGoods={handleDeleteGoodsItem}
            themeMode={themeMode}
            onSetThemeMode={setThemeMode}
            customAccent={customAccent}
            onSetCustomAccent={setCustomAccent}
            isPremium={isPremium}
            onSetIsPremium={setIsPremium}
            adFreeUntil={adFreeUntil}
            onSetAdFreeUntil={setAdFreeUntil}
            isAdFree={isAdFree}
            userId={session?.user?.id}
            pendingFriendCode={pendingFriendCode}
            onConsumeFriendCode={() => setPendingFriendCode(null)}
          />
        )}
      </View>

      {/* Premium Bottom Tab Navigation Bar (hidden while writing a diary entry so the wizard flow gets full-screen focus) */}
      {!isWriting && (
      <View style={[styles.tabBar, { backgroundColor: activeColors.bgApp, borderTopColor: activeColors.borderColor }]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'schedule' && styles.tabItemActive]}
          onPress={() => setActiveTab('schedule')}
        >
          <Ionicons
            name={activeTab === 'schedule' ? 'calendar' : 'calendar-outline'}
            size={20}
            color={activeTab === 'schedule' ? activeTabColor : activeColors.textMuted}
          />
          <Text style={[styles.tabItemText, { color: activeTab === 'schedule' ? activeTabColor : activeColors.textMuted }]}>
            경기일정
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'record' && styles.tabItemActive]}
          onPress={() => setActiveTab('record')}
        >
          <Ionicons
            name={activeTab === 'record' ? 'document-text' : 'document-text-outline'}
            size={20}
            color={activeTab === 'record' ? activeTabColor : activeColors.textMuted}
          />
          <Text style={[styles.tabItemText, { color: activeTab === 'record' ? activeTabColor : activeColors.textMuted }]}>
            나의직관
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'wallet' && styles.tabItemActive]}
          onPress={() => setActiveTab('wallet')}
        >
          <Ionicons
            name={activeTab === 'wallet' ? 'wallet' : 'wallet-outline'}
            size={20}
            color={activeTab === 'wallet' ? activeTabColor : activeColors.textMuted}
          />
          <Text style={[styles.tabItemText, { color: activeTab === 'wallet' ? activeTabColor : activeColors.textMuted }]}>
            나의지출
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'mypage' && styles.tabItemActive]}
          onPress={() => setActiveTab('mypage')}
        >
          <Ionicons
            name={activeTab === 'mypage' ? 'person' : 'person-outline'}
            size={20}
            color={activeTab === 'mypage' ? activeTabColor : activeColors.textMuted}
          />
          <Text style={[styles.tabItemText, { color: activeTab === 'mypage' ? activeTabColor : activeColors.textMuted }]}>
            마이페이지
          </Text>
        </TouchableOpacity>
      </View>
      )}
      <AppAlertHost theme={theme} />
      <AchievementModal theme={theme} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeToggle: {
    padding: 6,
  },
  headerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  headerUserText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  mainViewport: {
    flex: 1,
  },
  tabBar: {
    height: 60,
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabItemActive: {
    backgroundColor: 'rgba(0, 28, 72, 0.03)',
  },
  tabItemText: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
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
});
