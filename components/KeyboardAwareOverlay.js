import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

// Backdrop for the bottom-sheet modals, lifted clear of the keyboard.
//
// The sheets sit at the bottom of the screen, so an open keyboard covers
// exactly the fields being typed into. android:windowSoftInputMode used to
// resize the window for us, but from Android 15 apps are drawn edge to edge
// and that no longer happens - the inset has to be applied in JS.
export default function KeyboardAwareOverlay({ children, style }) {
  return (
    <KeyboardAvoidingView
      style={[styles.overlay, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
});
