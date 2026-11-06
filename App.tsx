import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { ToastProvider, useToast } from './src/context/ToastContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AnimatedSplash } from './src/components/AnimatedSplash';

/**
 * "Signed in" toast. Fires only on a real sign-in (signed out → signed in), not when the app
 * opens already signed in. Covers both typing the OTP and Android's automatic SMS sign-in.
 * Waits until the profile has loaded so it can greet returning users by name.
 */
function useSignInToast() {
  const { status, profile } = useApp();
  const toast = useToast();
  const wasSignedOut = useRef(false);
  useEffect(() => {
    if (status === 'signedOut') {
      wasSignedOut.current = true;
      return;
    }
    if (status === 'loading' || !wasSignedOut.current) return;
    wasSignedOut.current = false;
    if (status === 'ready') {
      const name = profile?.ownerName?.split(' ')[0];
      toast(name ? `Signed in successfully. Welcome back, ${name}!` : 'Signed in successfully');
    } else {
      toast("Signed in successfully. Let's set up your shop.");
    }
  }, [status, profile, toast]);
}

/** Shows the app with the animated splash on top until sign-in state and profile have loaded. */
function AppWithSplash() {
  const { status } = useApp();
  useSignInToast();
  const [splashDone, setSplashDone] = useState(false);
  const onDone = useCallback(() => setSplashDone(true), []);
  return (
    <View style={{ flex: 1 }}>
      <RootNavigator />
      {splashDone ? null : <AnimatedSplash ready={status !== 'loading'} onDone={onDone} />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppProvider>
        <ToastProvider>
          <AppWithSplash />
        </ToastProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
