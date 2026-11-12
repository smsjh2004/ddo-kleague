import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const COPY = {
  preferences: ['앱을 준비하고 있어요', '저장된 설정을 불러오고 있어요.'],
  restoring: ['다시 만나서 반가워요', '로그인 정보를 안전하게 확인하고 있어요.'],
  profile: ['나의 직관을 연결하는 중', '프로필을 불러오고 있어요. 잠시만 기다려주세요.'],
  saving: ['잠시만 기다려주세요', '요청하신 내용을 처리하고 있어요.'],
};

export default function LoadingScreen({ theme = 'light', stage = 'restoring', error, onRetry, onReset }) {
  const colors = Colors[theme];
  const [title, detail] = COPY[stage] || COPY.restoring;
  const step = stage === 'profile' ? 1 : 0;
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bgBody }]}>
      <View style={styles.content}>
        <View style={[styles.emblem, { backgroundColor: colors.brandNavy }]}>
          <Ionicons name="football" size={38} color="#fff" />
        </View>
        <Text style={[styles.brand, { color: colors.brandNavy }]}>또직관</Text>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>K-LEAGUE MATCH DIARY</Text>

        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]} accessibilityLiveRegion="polite">
          {error ? <Ionicons name="cloud-offline-outline" size={30} color={colors.brandRed} /> : <ActivityIndicator size="large" color={colors.brandNavy} />}
          <Text style={[styles.title, { color: colors.textMain }]}>{error ? '연결을 다시 확인해주세요' : title}</Text>
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            {error ? '로그인 정보를 불러오지 못했어요.\n네트워크를 확인한 뒤 다시 시도해주세요.' : detail}
          </Text>
          {!error && stage !== 'saving' && (
            <View style={styles.steps}>
              {['로그인 확인', '프로필 연결', '준비 완료'].map((label, index) => (
                <View key={label} style={styles.step}>
                  <View style={[styles.stepLine, { backgroundColor: index <= step ? colors.brandNavy : colors.bgTag }]} />
                  <Text style={[styles.stepText, { color: index === step ? colors.textBody : colors.textMuted }]}>{label}</Text>
                </View>
              ))}
            </View>
          )}
          {error && onRetry && (
            <TouchableOpacity accessibilityRole="button" style={[styles.primary, { backgroundColor: colors.brandNavy }]} onPress={onRetry}>
              <Text style={styles.primaryText}>다시 시도</Text>
            </TouchableOpacity>
          )}
          {error && onReset && (
            <TouchableOpacity accessibilityRole="button" style={styles.secondary} onPress={onReset}>
              <Text style={[styles.secondaryText, { color: colors.textBody }]}>로그인 화면으로 돌아가기</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.footnote, { color: colors.textMuted }]}>
          {error ? '앱 데이터를 지우지 않아도 다시 시도할 수 있어요.' : '오늘의 경기, 오래 기억할 나의 순간.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  emblem: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  brand: { fontSize: 30, fontWeight: '900' },
  tagline: { fontSize: 10, fontWeight: '800', letterSpacing: 2.3, marginTop: 6, marginBottom: 28 },
  card: { width: '100%', padding: 24, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', marginTop: 20, textAlign: 'center' },
  detail: { fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  steps: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 24 },
  step: { flex: 1 },
  stepLine: { height: 4, borderRadius: 2, marginBottom: 8 },
  stepText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  primary: { width: '100%', borderRadius: 10, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondary: { minHeight: 44, justifyContent: 'center', marginTop: 6 },
  secondaryText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  footnote: { fontSize: 11, marginTop: 22, textAlign: 'center' },
});
