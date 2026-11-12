import { Platform } from 'react-native';

// Style fragments repeated near-identically across several screens' own
// StyleSheet.create() - spread into a screen's sectionLabel style alongside
// its own margins, which differ slightly per screen.
export const sectionLabelBase = {
  fontSize: 11.5,
  fontWeight: '800',
};
// Shared by the app shell and portal-based sheets, which render outside it.
export const webContentWidth = Platform.select({
  web: { width: '100%', maxWidth: 480, marginHorizontal: 'auto' },
  default: {},
});
