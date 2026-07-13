import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { registerAchievementListener } from '../utils/achievementAlert';

// Celebratory unlock popup, mounted once near the app root (separate from
// AppAlertHost's plain confirmation dialog). Queues multiple simultaneous
// unlocks and shows them one at a time.
export default function AchievementModal({ theme = 'light' }) {
  const isDark = theme === 'dark';
  const activeColors = Colors[theme];
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    registerAchievementListener((achievements) => {
      setQueue((prev) => [...prev, ...achievements]);
    });
    return () => registerAchievementListener(null);
  }, []);

  if (queue.length === 0) return null;
  const current = queue[0];
  const dismiss = () => setQueue((prev) => prev.slice(1));

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.75)' }]}>
        <View style={[styles.card, { backgroundColor: activeColors.bgCard }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={dismiss}
            activeOpacity={0.6}
          >
            <Text style={[styles.closeText, { color: activeColors.textMuted }]}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.eyebrow}>🎉 업적 달성!</Text>

          <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }]}>
            <Text style={styles.iconEmoji}>{current.emoji}</Text>
          </View>

          <Text style={[styles.label, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>{current.label}</Text>
          {current.description ? (
            <Text style={[styles.description, { color: activeColors.textMuted }]}>{current.description}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 240,
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  eyebrow: {
    color: '#FBC02D',
    fontSize: 11.5,
    fontWeight: '800',
    marginBottom: 12,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconEmoji: {
    fontSize: 32,
  },
  label: {
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
});
