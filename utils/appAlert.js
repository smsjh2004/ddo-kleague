// Drop-in replacement for RN's Alert.alert(title, message, buttons) that renders
// through our own themed in-app modal (AppAlertHost) instead of the native
// OS dialog / window.confirm, so it looks and behaves the same on web and native.
let listener = null;

export function registerAlertListener(fn) {
  listener = fn;
}

export function showAlert(title, message, buttons) {
  if (listener) {
    listener({ title, message, buttons });
  }
}
