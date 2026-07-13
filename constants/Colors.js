import { hexToHsl, hslToHex } from '../utils/colorUtils';

const DEFAULT_NAVY = '#001C48';
const DEFAULT_RED = '#EE3224';

export const Colors = {
  light: {
    primary: '#001C48', // Navy
    accent: '#EE3224',  // Red
    textMain: '#001C48',
    textBody: '#1E293B',
    textMuted: '#64748B',
    bgBody: '#F8FAFC',
    bgApp: '#FFFFFF',
    bgCard: '#FFFFFF',
    bgCardHover: '#F1F5F9',
    bgInput: '#FFFFFF',
    bgTag: '#E2E8F0',
    borderColor: '#E2E8F0',
    dividerColor: 'rgba(0, 0, 0, 0.06)',
    brandNavy: '#001C48',
    brandRed: '#EE3224',
    brandGrey: '#C6C8CA',
  },
  dark: {
    primary: '#FFFFFF', // High-contrast White
    accent: '#EE3224',  // Red Accent
    textMain: '#FFFFFF',
    textBody: '#E2E8F0',
    textMuted: '#94A3B8',
    bgBody: '#0F0F10',  // Near Black
    bgApp: '#18181C',   // Charcoal
    bgCard: '#18181C',
    bgCardHover: '#222227',
    bgInput: '#0F0F10',
    bgTag: '#2E2E35',
    borderColor: '#2E2E35',
    dividerColor: 'rgba(255, 255, 255, 0.08)',
    brandNavy: '#EE3224',
    brandRed: '#EE3224',
    brandGrey: '#C6C8CA',
  }
};

// Overrides the built-in navy/red brand duality with a single accent color
// across both themes (e.g. the user's supported team's color). Mutates the
// shared Colors object in place - every screen reads `Colors[theme]` fresh
// on each render, so this takes effect immediately without prop threading.
// Pass a falsy value to restore the original navy(light)/red(dark) defaults.
//
// The exact chosen color is never used as-is: light mode gets a lightness
// ceiling (stays dark enough to read on white surfaces) and dark mode gets a
// lightness floor (stays bright enough to read on near-black surfaces) - a
// very dark custom pick would otherwise turn text/labels invisible in dark
// mode, and a very light pick would wash out on light mode's white cards.
export function applyAccentColor(hex) {
  if (!hex) {
    Colors.light.brandNavy = DEFAULT_NAVY;
    Colors.light.brandRed = DEFAULT_RED;
    Colors.dark.brandNavy = DEFAULT_RED;
    Colors.dark.brandRed = DEFAULT_RED;
    return;
  }
  const { h, s, l } = hexToHsl(hex);
  const lightVariant = hslToHex(h, s, Math.min(l, 45));
  const darkVariant = hslToHex(h, s, Math.max(l, 55));
  Colors.light.brandNavy = lightVariant;
  Colors.light.brandRed = lightVariant;
  Colors.dark.brandNavy = darkVariant;
  Colors.dark.brandRed = darkVariant;
}
