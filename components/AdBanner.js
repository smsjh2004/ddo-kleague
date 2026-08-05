import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, AD_UNIT_IDS } from '../utils/ads';

// One shared banner slot, dropped into each main tab (경기일정/나의직관/
// 나의지출/마이페이지). Renders nothing on web (see utils/ads.web.js) or
// while the user has an active ad-free window.
export default function AdBanner({ hidden = false }) {
  if (hidden) return null;
  return (
    <View style={styles.wrap}>
      <BannerAd unitId={AD_UNIT_IDS.banner} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
  },
});
