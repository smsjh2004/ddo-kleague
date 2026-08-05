import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/Colors';
import { showAlert } from '../utils/appAlert';
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES = [
  { key: 'jersey', label: '유니폼', emoji: '👕' },
  { key: 'muffler', label: '머플러', emoji: '🧣' },
  { key: 'etc', label: '기타', emoji: '🎽' },
];

export default function GoodsModal({
  visible,
  onClose,
  theme = 'light',
  editingGoods,
  onSave,
}) {
  const activeColors = Colors[theme];
  const [name, setName] = useState('');
  const [category, setCategory] = useState('jersey');
  const [photoUri, setPhotoUri] = useState(null);

  useEffect(() => {
    if (!visible) return;
    if (editingGoods) {
      setName(editingGoods.name || '');
      setCategory(editingGoods.category || 'jersey');
      setPhotoUri(editingGoods.photo_url || null);
    } else {
      setName('');
      setCategory('jersey');
      setPhotoUri(null);
    }
  }, [visible, editingGoods]);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
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
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Goods Image Picker Error:', e);
      showAlert('오류', '이미지를 불러오는 도중 오류가 발생했습니다.');
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      showAlert('알림', '굿즈 이름을 입력해주세요.');
      return;
    }
    const goodsItem = {
      id: editingGoods ? editingGoods.id : 'goods-' + Date.now(),
      name: name.trim(),
      category,
      photoUrl: photoUri,
    };
    onSave(goodsItem);
  };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: activeColors.bgApp }]}>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: activeColors.brandNavy }]}>
              {editingGoods ? '굿즈 수정' : '굿즈 등록'}
            </Text>

            <TouchableOpacity onPress={pickPhoto} style={styles.photoTouch} activeOpacity={0.8}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder, { backgroundColor: activeColors.bgTag, borderColor: activeColors.borderColor }]}>
                  <Ionicons name="camera-outline" size={24} color={activeColors.textMuted} />
                </View>
              )}
            </TouchableOpacity>

            <Text style={[styles.label, { color: activeColors.textBody }]}>굿즈 이름 *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: activeColors.bgInput, borderColor: activeColors.borderColor, color: activeColors.textBody }]}
              placeholder="예: 24시즌 원정 유니폼"
              placeholderTextColor={activeColors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { color: activeColors.textBody }]}>종류</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => {
                const isActive = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[
                      styles.categoryChip,
                      { borderColor: activeColors.borderColor, backgroundColor: activeColors.bgTag },
                      isActive && { borderColor: activeColors.brandRed, backgroundColor: 'rgba(238,50,36,0.08)' },
                    ]}
                    onPress={() => setCategory(c.key)}
                  >
                    <Text style={{ color: isActive ? activeColors.brandRed : activeColors.textBody, fontSize: 12, fontWeight: '800' }}>
                      {c.emoji} {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: activeColors.bgTag }]} onPress={onClose}>
                <Text style={[styles.cancelBtnText, { color: activeColors.textBody }]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: activeColors.brandNavy }]} onPress={handleSave}>
                <Text style={styles.saveBtnText}>저장</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 35,
    maxHeight: '85%',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    alignSelf: 'center',
    marginBottom: 16,
  },
  photoTouch: {
    alignSelf: 'center',
    marginBottom: 18,
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 12,
  },
  photoPlaceholder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  saveBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
