/**
 * Animated "verified" tick for the bill-saved screen:
 *  1. green disc springs in
 *  2. the check mark draws itself
 *  3. small dots burst outward once
 *  4. a soft ring keeps pulsing behind the disc
 * Honours the system "reduce motion" setting (shows the finished tick, no movement).
 */
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../config/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DISC = 112;
const CHECK_LENGTH = 40; // a little longer than the path, so it starts fully hidden
const DOTS = 10;
const DOT_COLORS = [colors.primary, colors.scanLine, '#F2B33D', colors.statusOk];

export function SuccessCheck({ size = DISC }: { size?: number }) {
  const disc = useRef(new Animated.Value(0)).current;
  const draw = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduce => {
        if (cancelled) return;
        if (reduce) {
          disc.setValue(1);
          draw.setValue(1);
          burst.setValue(1);
          return;
        }
        Animated.sequence([
          Animated.spring(disc, { toValue: 1, damping: 10, stiffness: 180, mass: 0.8, useNativeDriver: true }),
          Animated.parallel([
            // strokeDashoffset is an SVG prop, so this one can't use the native driver.
            Animated.timing(draw, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
            Animated.timing(burst, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]),
        ]).start(() => {
          if (cancelled) return;
          loop = Animated.loop(
            Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          );
          loop.start();
        });
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [disc, draw, burst, pulse]);

  const box = size * 2.2;
  const discStyle = {
    transform: [{ scale: disc.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
    opacity: disc.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
  };
  const ringStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
  };

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="image" accessibilityLabel="Success">
      <Animated.View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryTint }, ringStyle]} />

      {Array.from({ length: DOTS }, (_, i) => {
        const angle = (i / DOTS) * Math.PI * 2 - Math.PI / 2;
        const dist = size * (0.78 + (i % 2) * 0.18);
        const dot = 6 + (i % 3) * 2;
        return (
          <Animated.View
            key={i}
            style={[
              styles.circle,
              {
                width: dot,
                height: dot,
                borderRadius: dot / 2,
                backgroundColor: DOT_COLORS[i % DOT_COLORS.length],
                opacity: burst.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * dist] }) },
                  { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * dist] }) },
                  { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                ],
              },
            ]}
          />
        );
      })}

      <Animated.View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }, discStyle]}>
        <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 52 52">
          <AnimatedPath
            d="M13 27.5 L22 36 L39 17"
            stroke={colors.white}
            strokeWidth={5.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={CHECK_LENGTH}
            strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [CHECK_LENGTH, 0] })}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute' },
  disc: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
});
