import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { signInWithKakao } from '../utils/auth';
import { showAlert } from '../utils/appAlert';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen({ theme = 'light', onLoggedIn }) {
  const activeColors = Colors[theme];
  const [loading, setLoading] = useState(false);

  const handleKakaoLogin = async () => {
    setLoading(true);
    try {
      const session = await signInWithKakao();
      if (session && onLoggedIn) {
        onLoggedIn(session);
      }
    } catch (err) {
      showAlert('로그인 실패', err.message || '카카오 로그인 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: activeColors.bgBody }]}>
      <View style={styles.content}>
        <View style={styles.emblemWrap}>
          <View style={[styles.emblemRing, { borderColor: activeColors.brandRed }]} />
          <View style={[styles.emblem, { backgroundColor: activeColors.brandNavy }]}>
            <Ionicons name="football" size={38} color="#ffffff" />
          </View>
        </View>

        <Text style={[styles.title, { color: activeColors.brandNavy }]}>또직관</Text>
        <Text style={[styles.tagline, { color: activeColors.textMuted }]}>K-LEAGUE MATCH DIARY</Text>

        <Text style={[styles.subtitle, { color: activeColors.textMuted }]}>
          카카오 계정으로 로그인하고{'\n'}나만의 직관 기록을 시작해 보세요!
        </Text>

        <TouchableOpacity
          style={[styles.kakaoBtn, loading && styles.kakaoBtnDisabled]}
          onPress={handleKakaoLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#191919" />
          ) : (
            <Text style={styles.kakaoBtnText}>카카오로 시작하기</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emblemWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emblemRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    opacity: 0.4,
  },
  emblem: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginTop: 6,
    marginBottom: 28,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
  },
  kakaoBtn: {
    width: '100%',
    height: 52,
    borderRadius: 10,
    backgroundColor: '#FEE500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoBtnDisabled: {
    opacity: 0.7,
  },
  kakaoBtnText: {
    color: '#191919',
    fontSize: 15,
    fontWeight: '800',
  },
});
