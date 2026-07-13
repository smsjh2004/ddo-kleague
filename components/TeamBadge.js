import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TEAM_COLORS } from '../constants/TeamData';

export default function TeamBadge({ teamName, size = 20 }) {
  const getColors = () => {
    const key = Object.keys(TEAM_COLORS).find((k) => TEAM_COLORS[k].name === teamName);
    return key ? TEAM_COLORS[key].colors : ['#cccccc', '#777777'];
  };

  const colors = getColors();
  const radius = size / 2;

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  };

  return (
    <View style={containerStyle}>
      {colors.length === 1 ? (
        <View style={[styles.badgeHalf, { backgroundColor: colors[0], width: '100%' }]} />
      ) : colors.length === 2 ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={[styles.badgeHalf, { backgroundColor: colors[0] }]} />
          <View style={[styles.badgeHalf, { backgroundColor: colors[1] }]} />
        </View>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={[styles.badgeHalf, { backgroundColor: colors[0] }]} />
          <View style={[styles.badgeHalf, { backgroundColor: colors[1] }]} />
          <View style={[styles.badgeHalf, { backgroundColor: colors[2] }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badgeHalf: {
    flex: 1,
    height: '100%',
  },
});
