// react-native-google-mobile-ads has no web build (native module only), so
// this stub keeps `expo start --web` working. Real behavior only exists on
// iOS/Android via ads.js (Metro picks this file automatically for web).
export const AD_UNIT_IDS = { banner: '', interstitial: '', rewarded: '' };

export function initAds() {
  return Promise.resolve();
}

export function showInterstitialAd() {
  return Promise.resolve();
}

export function showRewardedAd() {
  return Promise.resolve(false);
}

export function BannerAd() {
  return null;
}

export const BannerAdSize = {};
