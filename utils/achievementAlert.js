// Separate event channel from utils/appAlert.js - achievement unlocks get
// their own celebratory modal (AchievementModal) instead of the plain
// title/message confirmation dialog used everywhere else.
let listener = null;

export function registerAchievementListener(fn) {
  listener = fn;
}

export function showAchievementUnlock(achievements) {
  if (listener && achievements && achievements.length > 0) {
    listener(achievements);
  }
}
