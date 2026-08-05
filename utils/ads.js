import mobileAds, {
  BannerAd,
  BannerAdSize,
  TestIds,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from 'react-native-google-mobile-ads';

let initPromise = null;

// Call once (App.js does this on launch) - safe to call again, resolves the
// same promise instead of re-initializing the SDK.
export function initAds() {
  if (!initPromise) initPromise = mobileAds().initialize();
  return initPromise;
}

// __DEV__ always serves Google's official test ad units so development
// builds never request/click real ads. Replace the production ids below
// with the real ones from the AdMob console before release.
export const AD_UNIT_IDS = {
  banner: __DEV__ ? TestIds.BANNER : 'ca-app-pub-2308444497321939/1115878330',
  interstitial: __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-2308444497321939/1913688751',
  rewarded: __DEV__ ? TestIds.REWARDED : 'ca-app-pub-2308444497321939/7820621553',
};

export { BannerAd, BannerAdSize };

// Loads and shows an interstitial, resolving once it's closed. Resolves
// immediately (instead of rejecting) on a load error so a failed ad fetch
// never blocks the flow the interstitial was inserted into (e.g. saving a
// profile edit).
export function showInterstitialAd() {
  return new Promise((resolve) => {
    const ad = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      unsubLoaded();
      unsubClosed();
      unsubError();
      resolve();
    };
    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => ad.show());
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, finish);
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, finish);
    ad.load();
  });
}

// Loads and shows a rewarded ad. Resolves true only if the user actually
// earned the reward (watched to completion) - false if they close early,
// skip, or the ad fails to load.
export function showRewardedAd() {
  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(AD_UNIT_IDS.rewarded);
    let earned = false;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      unsubLoaded();
      unsubEarned();
      unsubClosed();
      unsubError();
      resolve(earned);
    };
    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => ad.show());
    const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, finish);
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, finish);
    ad.load();
  });
}
