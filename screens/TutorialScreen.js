import React, { useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { CalendarPreview, DiaryPreview, MyPagePreview } from '../components/TutorialPreview';

const { width } = Dimensions.get('window');

// `preview` renders a miniature of the screen being described; pages without
// one (welcome, finish) fall back to the emoji.
const PAGES = [
  {
    emoji: '⚽',
    title: '또직관에 오신 걸 환영해요!',
    desc: '이제부터 K리그 직관 기록과 승률 통계를\n또직관 하나로 관리할 수 있어요.',
    bullets: [],
  },
  {
    preview: CalendarPreview,
    title: '경기 일정을 한눈에',
    desc: 'K1·K2·코리아컵 전체 일정을 캘린더로 확인하고,\n내 팀 경기만 모아볼 수 있어요.',
    bullets: [
      '내 팀 다음 경기 D-Day 위젯',
      '리그·팀별 필터로 원하는 경기만 보기',
    ],
  },
  {
    preview: DiaryPreview,
    title: '직관일지 작성하기',
    desc: '직관한 경기의 순간을 사진과 함께 기록하고\n평점, 소감, 심판 판정까지 남겨보세요.',
    bullets: [
      '사진 등록 + 별점 + 소감 기록',
      '이날 지출한 티켓·식음료·교통·굿즈 비용도 같이 기록',
      '착용한 굿즈를 연결해서 승률 확인',
    ],
  },
  {
    preview: MyPagePreview,
    title: '마이페이지에서 더 즐기기',
    desc: '기록이 쌓일수록 마이페이지가 풍성해져요.',
    bullets: [
      '직관 기록 기반 업적 달성하기',
      '굿즈 보관함 & 원정 구단 도장깨기 빙고',
      '친구 추가하고 서로의 직관 피드 구경하기',
    ],
  },
  {
    emoji: '🎉',
    title: '준비 완료!',
    desc: '이제 첫 직관일지를 남기러 가볼까요?',
    bullets: [],
  },
];

export default function TutorialScreen({ theme = 'light', onFinish }) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';
  const activeAccent = isDark ? activeColors.brandRed : activeColors.brandNavy;

  const [pageIndex, setPageIndex] = useState(0);
  const isLastPage = pageIndex === PAGES.length - 1;
  const page = PAGES[pageIndex];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <View style={styles.skipRow}>
        {!isLastPage && (
          <TouchableOpacity onPress={onFinish} activeOpacity={0.7}>
            <Text style={[styles.skipText, { color: activeColors.textMuted }]}>건너뛰기</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.page, { width, flexGrow: 1, justifyContent: 'center' }]}
        showsVerticalScrollIndicator={false}
      >
        {page.preview ? (
          <View style={styles.previewWrap}>
            <page.preview theme={theme} />
          </View>
        ) : (
          <Text style={styles.pageEmoji}>{page.emoji}</Text>
        )}
        <Text style={[styles.pageTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>
          {page.title}
        </Text>
        <Text style={[styles.pageDesc, { color: activeColors.textMuted }]}>{page.desc}</Text>
        {page.bullets.length > 0 && (
          <View style={[styles.bulletCard, { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor }]}>
            {page.bullets.map((b, j) => (
              <View key={j} style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={16} color={activeAccent} />
                <Text style={[styles.bulletText, { color: activeColors.textBody }]}>{b}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.dotsRow}>
        {PAGES.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => setPageIndex(i)} activeOpacity={0.7}>
            <View
              style={[
                styles.dot,
                { backgroundColor: i === pageIndex ? activeAccent : activeColors.bgTag },
                i === pageIndex && styles.dotActive,
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: activeAccent }]}
          onPress={() => (isLastPage ? onFinish() : setPageIndex(pageIndex + 1))}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>{isLastPage ? '시작하기' : '다음'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  skipRow: {
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  page: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 20,
  },
  pageEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  previewWrap: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  pageDesc: {
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  bulletCard: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  nextBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
});
