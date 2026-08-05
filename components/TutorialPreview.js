import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

// Miniature, non-interactive renditions of the real screens, drawn with the
// same colour tokens the app uses. Screenshots would go stale the moment a
// screen changes and would need a light and a dark copy of every image; these
// just follow the theme like everything else.

function Frame({ theme, children }) {
  const c = Colors[theme];
  return (
    <View style={[styles.frame, { backgroundColor: c.bgCard, borderColor: c.borderColor }]}>
      {children}
    </View>
  );
}

export function CalendarPreview({ theme = 'light' }) {
  const c = Colors[theme];
  const isDark = theme === 'dark';
  // A fixed sample month - real dates would make the drawing jump around.
  const days = Array.from({ length: 35 }, (_, i) => i - 3);
  const withMatch = [8, 15, 22, 27];
  const withLog = [15];
  const today = 22;

  return (
    <Frame theme={theme}>
      <View style={styles.calHeader}>
        <Ionicons name="chevron-back" size={11} color={c.textMuted} />
        <Text style={[styles.calMonth, { color: c.textBody }]}>8월</Text>
        <Ionicons name="chevron-forward" size={11} color={c.textMuted} />
      </View>

      <View style={styles.calRow}>
        {['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (
          <Text
            key={w}
            style={[
              styles.calWeekday,
              { color: i === 0 ? '#E30613' : i === 6 ? (isDark ? '#5B8DEF' : '#0047A0') : c.textMuted },
            ]}
          >
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.calGrid}>
        {days.map((d, i) => {
          const inMonth = d >= 1 && d <= 31;
          const isToday = d === today;
          return (
            <View key={i} style={styles.calCell}>
              <View style={[styles.calDay, isToday && { backgroundColor: c.brandRed }]}>
                <Text
                  style={[
                    styles.calDayText,
                    { color: isToday ? '#ffffff' : inMonth ? c.textBody : c.textMuted },
                    !inMonth && { opacity: 0.35 },
                  ]}
                >
                  {inMonth ? d : ''}
                </Text>
              </View>
              {inMonth && withLog.includes(d) ? (
                <Text style={styles.calCrown}>👑</Text>
              ) : inMonth && withMatch.includes(d) ? (
                <View style={[styles.calDot, { backgroundColor: c.brandRed }]} />
              ) : (
                <View style={styles.calDot} />
              )}
            </View>
          );
        })}
      </View>

      <View style={[styles.ddayRow, { backgroundColor: c.brandNavy }]}>
        <Text style={styles.ddayTeam}>전북 vs 서울</Text>
        <Text style={styles.ddayBadge}>D-3</Text>
      </View>
    </Frame>
  );
}

export function DiaryPreview({ theme = 'light' }) {
  const c = Colors[theme];
  return (
    <Frame theme={theme}>
      <View style={styles.scoreRow}>
        <Text style={[styles.scoreTeam, { color: c.textBody }]}>전북</Text>
        <Text style={[styles.scoreNum, { color: c.brandRed }]}>2 : 1</Text>
        <Text style={[styles.scoreTeam, { color: c.textBody }]}>서울</Text>
      </View>

      <View style={[styles.photoBox, { backgroundColor: c.bgTag, borderColor: c.borderColor }]}>
        <Ionicons name="image-outline" size={18} color={c.textMuted} />
        <Text style={[styles.photoText, { color: c.textMuted }]}>직관 사진</Text>
      </View>

      <View style={styles.starRow}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Ionicons
            key={i}
            name={i < 4 ? 'star' : 'star-outline'}
            size={13}
            color={i < 4 ? '#FBC02D' : c.textMuted}
          />
        ))}
      </View>

      <View style={styles.chipRow}>
        {[
          { emoji: '🎫', label: '티켓' },
          { emoji: '🍔', label: '식음료' },
          { emoji: '🚌', label: '교통' },
        ].map((chip) => (
          <View key={chip.label} style={[styles.chip, { backgroundColor: c.bgTag }]}>
            <Text style={[styles.chipText, { color: c.textBody }]}>
              {chip.emoji} {chip.label}
            </Text>
          </View>
        ))}
      </View>
    </Frame>
  );
}

export function MyPagePreview({ theme = 'light' }) {
  const c = Colors[theme];
  const stamped = [0, 1, 3, 4, 6];

  return (
    <Frame theme={theme}>
      <View style={styles.profileRow}>
        <View style={[styles.avatar, { backgroundColor: c.brandNavy }]}>
          <Ionicons name="person" size={13} color="#ffffff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.profileName, { color: c.textBody }]}>또직관러</Text>
          <View style={[styles.titlePill, { backgroundColor: c.bgTag }]}>
            <Text style={[styles.titlePillText, { color: c.brandRed }]}>😎 근본있는 직관러</Text>
          </View>
        </View>
      </View>

      <View style={styles.badgeRow}>
        {['🏆', '🔥', '✈️', '🔒'].map((e, i) => (
          <View
            key={i}
            style={[styles.badge, { backgroundColor: c.bgTag }, i === 3 && { opacity: 0.4 }]}
          >
            <Text style={styles.badgeEmoji}>{e}</Text>
          </View>
        ))}
      </View>

      <View style={styles.bingoGrid}>
        {Array.from({ length: 9 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.bingoCell,
              { borderColor: c.borderColor },
              stamped.includes(i) && { backgroundColor: c.brandRed, borderColor: c.brandRed },
            ]}
          >
            {stamped.includes(i) && <Ionicons name="checkmark" size={9} color="#ffffff" />}
          </View>
        ))}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 220,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 10,
  },

  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 6,
  },
  calMonth: { fontSize: 11, fontWeight: '900' },
  calRow: { flexDirection: 'row' },
  calWeekday: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '800',
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%', alignItems: 'center', paddingVertical: 1 },
  calDay: {
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayText: { fontSize: 8, fontWeight: '700' },
  calDot: { width: 3, height: 3, borderRadius: 2, marginTop: 1 },
  calCrown: { fontSize: 6, marginTop: 1 },
  ddayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 8,
  },
  ddayTeam: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
  ddayBadge: { color: '#FBC02D', fontSize: 10, fontWeight: '900' },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  scoreTeam: { fontSize: 10, fontWeight: '800' },
  scoreNum: { fontSize: 13, fontWeight: '900' },
  photoBox: {
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoText: { fontSize: 8, fontWeight: '700' },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 3, marginTop: 8 },
  chipRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8 },
  chip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  chipText: { fontSize: 8, fontWeight: '700' },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 10, fontWeight: '900' },
  titlePill: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 2,
  },
  titlePillText: { fontSize: 8, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  badge: {
    width: 40,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 14 },
  bingoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // 3 cells + 2 gaps - without a fixed width all nine fit on one row and
    // the grid never wraps.
    width: 18 * 3 + 3 * 2,
    alignSelf: 'center',
    gap: 3,
    marginTop: 10,
  },
  bingoCell: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
