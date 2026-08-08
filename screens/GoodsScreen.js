import React, { useState } from 'react';
import { Text, View, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { calculateOutcome } from '../utils/achievements';
import { Ionicons } from '@expo/vector-icons';
import GoodsModal from './GoodsModal';
import GoodsDetailScreen from './GoodsDetailScreen';

export default function GoodsScreen({
  theme = 'light',
  goods = [],
  goodsLogLinks = [],
  logs = [],
  myTeam,
  onBack,
  onSaveGoods,
  onDeleteGoods,
}) {
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';

  const [goodsModalVisible, setGoodsModalVisible] = useState(false);
  const [editingGoods, setEditingGoods] = useState(null);
  const [viewingGoodsId, setViewingGoodsId] = useState(null);

  const getGoodsStats = (goodsId) => {
    const linkedLogIds = goodsLogLinks.filter((l) => l.goods_id === goodsId).map((l) => l.diary_log_id);
    const linkedLogs = logs.filter((l) => linkedLogIds.includes(l.id));
    const wins = linkedLogs.filter((l) => calculateOutcome(l, myTeam) === '승').length;
    const winRate = linkedLogs.length > 0 ? Math.round((wins / linkedLogs.length) * 100) : null;
    return { total: linkedLogs.length, winRate };
  };

  const openNew = () => {
    setEditingGoods(null);
    setGoodsModalVisible(true);
  };

  const openEdit = (item) => {
    setEditingGoods(item);
    setGoodsModalVisible(true);
  };

  const viewingGoods = goods.find((g) => g.id === viewingGoodsId) || null;

  // GoodsModal is rendered unconditionally below so it can still open as an
  // overlay while GoodsDetailScreen is showing (editing from the detail
  // screen's "..." menu needs the modal available in both branches).
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: activeColors.bgBody }}>
      {viewingGoods ? (
        <GoodsDetailScreen
          theme={theme}
          goodsItem={viewingGoods}
          logs={logs}
          myTeam={myTeam}
          goodsLogLinks={goodsLogLinks}
          onBack={() => setViewingGoodsId(null)}
          onEdit={() => openEdit(viewingGoods)}
          onDelete={(goodsId) => {
            onDeleteGoods(goodsId);
            setViewingGoodsId(null);
          }}
        />
      ) : (
        <>
          <View style={[styles.header, { backgroundColor: activeColors.bgApp, borderBottomColor: activeColors.borderColor }]}>
            <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={activeColors.textBody} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>굿즈 보관함</Text>
            <TouchableOpacity onPress={openNew} style={styles.headerBtn} activeOpacity={0.7}>
              <Ionicons name="add" size={24} color={activeColors.textBody} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <Text style={[styles.hint, { color: activeColors.textMuted }]}>
              내가 소유한 굿즈를 등록하고, 착용 시 승률 데이터를 확인하세요.
            </Text>

            {goods.length === 0 ? (
              <View style={[styles.emptyBox, { borderColor: activeColors.borderColor }]}>
                <Ionicons name="shirt-outline" size={32} color={activeColors.textMuted} />
                <Text style={[styles.emptyText, { color: activeColors.textMuted }]}>아직 등록된 굿즈가 없습니다.</Text>
                <TouchableOpacity style={[styles.emptyAddBtn, { backgroundColor: activeColors.brandNavy }]} onPress={openNew}>
                  <Text style={styles.emptyAddBtnText}>+ 굿즈 등록하기</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.grid}>
                {goods.map((item) => {
                  const stats = getGoodsStats(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.gridItem}
                      onPress={() => setViewingGoodsId(item.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.photoWrap}>
                        {item.photo_url ? (
                          <Image source={{ uri: item.photo_url }} style={styles.photo} />
                        ) : (
                          <View style={[styles.photo, styles.photoPlaceholder, { backgroundColor: activeColors.bgTag }]}>
                            <Ionicons name="shirt-outline" size={28} color={activeColors.textMuted} />
                          </View>
                        )}
                        {stats.winRate !== null && (
                          <View style={[styles.winRateBadge, { backgroundColor: activeColors.brandRed }]}>
                            <Text style={styles.winRateBadgeText}>{stats.winRate}%</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.itemName, { color: activeColors.textBody }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.itemSub, { color: activeColors.textMuted }]}>
                        {stats.total > 0 ? `${stats.total}경기 착용` : '착용 기록 없음'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </>
      )}

      <GoodsModal
        visible={goodsModalVisible}
        onClose={() => setGoodsModalVisible(false)}
        theme={theme}
        editingGoods={editingGoods}
        onSave={(goodsItem) => {
          // Match-linking now happens from the diary write flow, not here -
          // pass an empty link list on create and leave existing links
          // untouched on edit (onSaveGoods only replaces links when asked to).
          onSaveGoods(goodsItem, editingGoods ? undefined : []);
          setGoodsModalVisible(false);
        }}
      />
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
  hint: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  emptyAddBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  emptyAddBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '900',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 20,
  },
  photoWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  winRateBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  winRateBadgeText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '900',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 10.5,
    fontWeight: '600',
  },
});
