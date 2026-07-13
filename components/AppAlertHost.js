import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { registerAlertListener } from '../utils/appAlert';

// Mounted once near the app root. Confirmations, validation errors, and other
// messages that used to go through Alert.alert/window.confirm all render here
// instead, so the look is consistent and themed on both web and native.
export default function AppAlertHost({ theme = 'light' }) {
  const [alertData, setAlertData] = useState(null);
  const activeColors = Colors[theme];
  const isDark = theme === 'dark';

  useEffect(() => {
    registerAlertListener((data) => setAlertData(data));
    return () => registerAlertListener(null);
  }, []);

  if (!alertData) return null;

  const buttons = alertData.buttons && alertData.buttons.length > 0
    ? alertData.buttons
    : [{ text: '확인' }];
  const isMultiButton = buttons.length > 1;

  const handlePress = (btn) => {
    setAlertData(null);
    if (btn.onPress) btn.onPress();
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => setAlertData(null)}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: activeColors.bgCard }]}>
          {alertData.title ? (
            <Text style={[styles.title, { color: isDark ? '#ffffff' : activeColors.brandNavy }]}>
              {alertData.title}
            </Text>
          ) : null}
          {alertData.message ? (
            <Text style={[styles.message, { color: activeColors.textBody }]}>
              {alertData.message}
            </Text>
          ) : null}

          <View style={[styles.btnRow, { borderTopColor: activeColors.borderColor }]}>
            {buttons.map((btn, idx) => {
              const isLast = idx === buttons.length - 1;
              const isPrimary = isMultiButton && isLast && btn.style !== 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.btn,
                    idx > 0 && { borderLeftWidth: 1, borderLeftColor: activeColors.borderColor },
                    isPrimary && !isDestructive && { backgroundColor: isDark ? activeColors.brandRed : activeColors.brandNavy },
                    isDestructive && { backgroundColor: 'rgba(238, 50, 36, 0.1)' },
                  ]}
                  onPress={() => handlePress(btn)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.btnText,
                      { color: activeColors.textBody },
                      isPrimary && !isDestructive && { color: '#ffffff', fontWeight: '900' },
                      isDestructive && { color: '#EE3224', fontWeight: '900' },
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 14,
    paddingTop: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  title: {
    fontSize: 15.5,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  btnRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginHorizontal: -20,
  },
  btn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
