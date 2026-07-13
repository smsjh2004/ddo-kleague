import React, { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Dimensions,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/Colors';
import { LEAGUE_TEAMS } from '../constants/TeamData';
import TeamBadge from '../components/TeamBadge';
import { showAlert } from '../utils/appAlert';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function ProfileEditScreen({
  theme = 'light',
  nickname,
  myTeam,
  avatarUrl,
  onBack,
  onSave,
}) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';

  const [localNickname, setLocalNickname] = useState(nickname || '');
  const [avatarUri, setAvatarUri] = useState(avatarUrl || '');
  const [tempSelectedTeam, setTempSelectedTeam] = useState(myTeam || '');
  const [activeDivision, setActiveDivision] = useState('k1');

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

  const handleTeamClick = (teamName) => {
    setTempSelectedTeam(tempSelectedTeam === teamName ? '' : teamName);
  };

  const handleSave = () => {
    if (!localNickname.trim()) {
      showAlert('입력 오류', '닉네임을 입력해 주세요!');
      return;
    }
    if (!tempSelectedTeam) {
      showAlert('선택 오류', '응원하는 마이팀을 선택해 주세요.');
      return;
    }
    onSave({
      nickname: localNickname.trim(),
      avatar: avatarUri,
      myTeam: tempSelectedTeam,
    });
  };

  const renderTeamCard = (teamName) => {
    const isSelected = tempSelectedTeam === teamName;

    return (
      <TouchableOpacity
        key={teamName}
        style={[
          styles.teamCard,
          { backgroundColor: activeColors.bgCard, borderColor: activeColors.borderColor },
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
        <TeamBadge teamName={teamName} size={22} />
        <Text style={[styles.teamNameText, { color: activeColors.textBody }]} numberOfLines={1}>
          {teamName}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>프로필 수정</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerBtn} activeOpacity={0.7}>
          <Text style={[styles.headerSaveText, { color: activeColors.brandRed }]}>저장</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
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
        <Text style={[styles.avatarHintText, { color: activeColors.textMuted }]}>탭해서 프로필 사진 변경</Text>

        <Text style={[styles.label, { color: activeColors.textBody }]}>닉네임 *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor, color: activeColors.textBody }]}
          placeholder="직관러 닉네임을 입력하세요"
          placeholderTextColor={activeColors.textMuted}
          value={localNickname}
          onChangeText={setLocalNickname}
          maxLength={12}
        />

        <Text style={[styles.label, { color: activeColors.textBody }]}>
          마이팀
        </Text>

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

        <View style={styles.grid}>
          {(activeDivision === 'k1' ? LEAGUE_TEAMS.K1 : LEAGUE_TEAMS.K2).map((name) => renderTeamCard(name))}
        </View>
      </ScrollView>
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
  headerSaveText: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarTouch: {
    width: 84,
    height: 84,
    alignSelf: 'center',
    position: 'relative',
    marginTop: 8,
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
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 24,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 3,
    marginBottom: 14,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  teamCard: {
    width: (width - 48) / 3,
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
});
