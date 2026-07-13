import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LEAGUE_TEAMS, TEAM_COLORS } from '../constants/TeamData';
import { Colors } from '../constants/Colors';
import { showAlert } from '../utils/appAlert';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Native color badge preview helper using flex splits
const TeamBadgePreview = ({ colors }) => {
  const badgeColors = colors || ['#cccccc', '#777777'];
  return (
    <View style={styles.badgeContainer}>
      {badgeColors.length === 1 ? (
        <View style={[styles.badgeHalf, { backgroundColor: badgeColors[0], width: '100%' }]} />
      ) : badgeColors.length === 2 ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={[styles.badgeHalf, { backgroundColor: badgeColors[0] }]} />
          <View style={[styles.badgeHalf, { backgroundColor: badgeColors[1] }]} />
        </View>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={[styles.badgeHalf, { backgroundColor: badgeColors[0] }]} />
          <View style={[styles.badgeHalf, { backgroundColor: badgeColors[1] }]} />
          <View style={[styles.badgeHalf, { backgroundColor: badgeColors[2] }]} />
        </View>
      )}
    </View>
  );
};

export default function OnboardingScreen({ theme = 'light', onComplete, defaultAvatarUrl = '' }) {
  // Onboarding Step: 1 = Team Selection, 2 = Nickname Input
  const [onboardStep, setOnboardStep] = useState(1);
  const [nickname, setNickname] = useState('');
  const [avatarUri, setAvatarUri] = useState(defaultAvatarUrl);
  const [tempSelectedTeam, setTempSelectedTeam] = useState('');
  const [activeDivision, setActiveDivision] = useState('k1'); // k1, k2 (Removed 'all' / 전체)

  const activeColors = Colors[theme];

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('권한 필요', '프로필 사진을 변경하려면 사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Avatar Image Picker Error:', e);
      showAlert('오류', '이미지를 불러오는 도중 오류가 발생했습니다.');
    }
  };

  // Load colors dynamically based on team name
  const getTeamColors = (teamName) => {
    const key = Object.keys(TEAM_COLORS).find((k) => TEAM_COLORS[k].name === teamName);
    return key ? TEAM_COLORS[key].colors : ['#cccccc', '#777777'];
  };

  const handleTeamClick = (teamName) => {
    setTempSelectedTeam(tempSelectedTeam === teamName ? '' : teamName);
  };

  const handleNextStep = () => {
    if (!tempSelectedTeam) {
      showAlert('선택 오류', '응원하는 마이팀을 선택해 주세요.');
      return;
    }
    setOnboardStep(2);
  };

  const handleSubmit = () => {
    if (!nickname.trim()) {
      showAlert('입력 오류', '닉네임을 입력해 주세요!');
      return;
    }

    onComplete({
      nickname: nickname.trim(),
      avatar: avatarUri,
      myTeam: tempSelectedTeam,
    });
  };

  const renderTeamCard = (teamName) => {
    const colors = getTeamColors(teamName);
    const isSelected = tempSelectedTeam === teamName;

    return (
      <TouchableOpacity
        key={teamName}
        style={[
          styles.teamCard,
          {
            backgroundColor: activeColors.bgCard,
            borderColor: activeColors.borderColor,
          },
          isSelected && styles.cardMyTeam,
        ]}
        onPress={() => handleTeamClick(teamName)}
        activeOpacity={0.7}
      >
        {isSelected && (
          <View style={[styles.rankBadge, styles.bgRed]}>
            <Text style={styles.rankBadgeText}>마이팀</Text>
          </View>
        )}
        <TeamBadgePreview colors={colors} />
        <Text style={[styles.teamNameText, { color: activeColors.textBody }]} numberOfLines={1}>
          {teamName}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: activeColors.bgBody }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Header Title Section */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: activeColors.brandNavy }]}>
            K리그 직관일지
          </Text>
          <Text style={[styles.headerSubtitle, { color: activeColors.textMuted }]}>
            나만의 K리그 직관 기록과 승률 통계를 시작해 보세요!
          </Text>
        </View>

        {/* STEP 1: TEAM SELECTION (3 Columns, k1 and k2 only) */}
        {onboardStep === 1 && (
          <View style={styles.stepWrapper}>
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: activeColors.textBody }]}>
                마이팀 선택
              </Text>
              <Text style={[styles.sectionSubtext, { color: activeColors.textMuted }]}>
                응원하는 구단을 하나 선택해주세요.
              </Text>

              {/* Segment Controls (K리그1, K리그2만 존재) */}
              <View style={[styles.toggleContainer, { backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor }]}>
                <TouchableOpacity
                  style={[styles.toggleBtn, activeDivision === 'k1' && { backgroundColor: activeColors.bgTag }]}
                  onPress={() => setActiveDivision('k1')}
                >
                  <Text style={[styles.toggleBtnText, { color: activeDivision === 'k1' ? activeColors.textBody : activeColors.textMuted }]}>
                    K리그 1
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, activeDivision === 'k2' && { backgroundColor: activeColors.bgTag }]}
                  onPress={() => setActiveDivision('k2')}
                >
                  <Text style={[styles.toggleBtnText, { color: activeDivision === 'k2' ? activeColors.textBody : activeColors.textMuted }]}>
                    K리그 2
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Team Grid Lists (3 Columns) */}
            <View style={styles.gridSection}>
              <Text style={[styles.gridTitle, { color: activeColors.textMuted }]}>
                {activeDivision === 'k1' ? 'K리그 1 구단 목록' : 'K리그 2 구단 목록'}
              </Text>
              <View style={styles.grid}>
                {activeDivision === 'k1'
                  ? LEAGUE_TEAMS.K1.map((name) => renderTeamCard(name))
                  : LEAGUE_TEAMS.K2.map((name) => renderTeamCard(name))}
              </View>
            </View>

            {/* Next Button */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: activeColors.brandNavy },
                !tempSelectedTeam && styles.submitBtnDisabled,
              ]}
              onPress={handleNextStep}
              disabled={!tempSelectedTeam}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnText}>다음 단계로 (닉네임 설정)</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: NICKNAME INPUT & FINAL START */}
        {onboardStep === 2 && (
          <View style={styles.stepWrapper}>
            {/* Profile Photo Picker */}
            <View style={[styles.section, styles.avatarSection]}>
              <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={styles.avatarTouch}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: activeColors.bgTag, borderColor: activeColors.borderColor }]}>
                    <Ionicons name="camera-outline" size={26} color={activeColors.textMuted} />
                  </View>
                )}
                <View style={[styles.avatarEditBadge, { backgroundColor: activeColors.brandRed }]}>
                  <Ionicons name="camera" size={12} color="#ffffff" />
                </View>
              </TouchableOpacity>
              <Text style={[styles.avatarHintText, { color: activeColors.textMuted }]}>
                탭해서 프로필 사진 변경
              </Text>
            </View>

            {/* Nickname Input Form */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: activeColors.textBody }]}>
                닉네임 설정 *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: activeColors.bgInput,
                    borderColor: activeColors.borderColor,
                    color: activeColors.textBody,
                  },
                ]}
                placeholder="직관러 닉네임을 입력하세요"
                placeholderTextColor={activeColors.textMuted}
                value={nickname}
                onChangeText={setNickname}
                maxLength={12}
                autoFocus={true}
              />
            </View>

            {/* Selected Summary Section */}
            <View style={[styles.summaryCard, { backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor }]}>
              <Text style={[styles.summaryTitle, { color: activeColors.textBody, borderBottomColor: activeColors.dividerColor }]}>선택 구단 정보</Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: activeColors.textMuted }]}>마이팀</Text>
                <Text style={[styles.summaryValue, { color: activeColors.brandNavy, fontWeight: 'bold' }]}>
                  {tempSelectedTeam || '선택 안됨'}
                </Text>
              </View>
            </View>

            {/* Action buttons footer */}
            <View style={styles.flowFooterRow}>
              <TouchableOpacity
                style={[styles.prevBtn, { backgroundColor: activeColors.bgTag }]}
                onPress={() => setOnboardStep(1)}
              >
                <Text style={[styles.prevBtnText, { color: activeColors.textBody }]}>이전</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: activeColors.brandNavy, flex: 2.5, marginTop: 0 },
                  (!nickname.trim()) && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!nickname.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.submitBtnText}>시작하기 (직관 등록하기)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginVertical: 15,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '600',
  },
  stepWrapper: {
    width: '100%',
  },
  section: {
    marginTop: 15,
    width: '100%',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  sectionSubtext: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '700',
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 5,
  },
  avatarTouch: {
    width: 84,
    height: 84,
    position: 'relative',
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHintText: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 8,
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
  gridSection: {
    marginTop: 20,
  },
  gridTitle: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    paddingLeft: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  teamCard: {
    width: (width - 48) / 3, // 3 Columns configuration
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  teamNameText: {
    fontSize: 9.5,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
    width: '100%',
  },
  badgeContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  badgeHalf: {
    flex: 1,
    height: '100%',
  },
  rankBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    zIndex: 20,
  },
  bgRed: {
    backgroundColor: '#EE3224',
  },
  rankBadgeText: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: '900',
  },
  cardMyTeam: {
    borderColor: '#EE3224',
    borderWidth: 2,
  },
  summaryCard: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
    borderBottomWidth: 1,
    paddingBottom: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  submitBtn: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  submitBtnDisabled: {
    backgroundColor: '#C6C8CA',
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '900',
  },
  flowFooterRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  prevBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
});
