import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../config/theme';

const Ctx = createContext<(message: string) => void>(() => {});

/** Dark pill toast shown above the bottom actions (PRD 16.3). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (m: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(m);
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMessage(null));
      }, 2600);
    },
    [opacity],
  );

  return (
    <Ctx.Provider value={show}>
      {children}
      {message ? (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]} accessibilityLiveRegion="polite">
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 150,
    alignSelf: 'center',
    backgroundColor: colors.text,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxWidth: '90%',
  },
  text: { color: colors.white, fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center' },
});
