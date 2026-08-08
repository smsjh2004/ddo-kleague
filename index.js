import React from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import App from './App';

// Android 15+ draws apps edge to edge whether they ask to or not, so every
// screen's SafeAreaView needs real inset values - without this provider they
// all read zero and content slides under the status bar.
function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

registerRootComponent(Root);
