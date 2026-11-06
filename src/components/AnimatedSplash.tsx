/**
 * Animated splash screen (Billora – App UI design, "Billora logo": the animation is for the splash).
 *
 * The native splash (react-native-bootsplash) shows the empty green tile with its printer slot,
 * at the same size and position. This component takes over seamlessly and plays the design's
 * animation once: the receipt B prints out of the slot, its lines appear one by one, and the
 * ₹ coin drops in. When the app is ready it fades away.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import BootSplash from 'react-native-bootsplash';
import { APP_NAME } from '../config/app';
import { fonts } from '../config/theme';
import { MARK_COLORS, RECEIPT_LINES, coin, receipt, receiptLine, slot, svgDoc, tile } from '../brand/mark';

/** Must match --logo-width in `npx react-native-bootsplash generate` (see README). */
const SIZE = 120;
const DURATION = 1300;

const xml = {
  base: svgDoc(tile() + slot(), SIZE),
  receipt: svgDoc(receipt(), SIZE),
  lines: RECEIPT_LINES.map((_, i) => svgDoc(receiptLine(i), SIZE)),
  coin: svgDoc(coin(), SIZE),
};

export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const [played, setPlayed] = useState(false);
  const started = useRef(false);

  const start = async () => {
    if (started.current) return;
    started.current = true;
    await BootSplash.hide({ fade: false });
    const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
    if (reduceMotion) {
      progress.setValue(1);
      setPlayed(true);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => setPlayed(true));
  };

  // Fade out once the animation has played and the app knows where to go (sign-in, setup or Home).
  useEffect(() => {
    if (!played || !ready) return;
    const t = setTimeout(
      () => Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }).start(onDone),
      250,
    );
    return () => clearTimeout(t);
  }, [played, ready, fade, onDone]);

  const u = SIZE / 100; // one unit of the design's 100 × 100 box
  const printY = progress.interpolate({
    inputRange: [0, 0.38],
    outputRange: [72 * u, 0],
    extrapolate: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const lineOpacity = (i: number) => {
    const s = 0.4 + i * 0.05;
    return progress.interpolate({ inputRange: [s, s + 0.05], outputRange: [0, 1], extrapolate: 'clamp' });
  };
  const coinY = progress.interpolate({
    inputRange: [0, 0.66, 0.8, 0.88, 1],
    outputRange: [-48 * u, -48 * u, 3 * u, 0, 0],
    extrapolate: 'clamp',
  });
  const nameOpacity = progress.interpolate({ inputRange: [0.6, 0.9], outputRange: [0, 1], extrapolate: 'clamp' });
  const nameY = progress.interpolate({ inputRange: [0.6, 0.9], outputRange: [8, 0], extrapolate: 'clamp' });

  return (
    <Animated.View
      style={[styles.root, { opacity: fade }]}
      onLayout={start}
      accessible
      accessibilityLabel={`${APP_NAME} is loading`}>
      <View style={styles.tile}>
        <SvgXml xml={xml.base} width={SIZE} height={SIZE} />
        {/* The receipt is clipped at the printer slot (y = 88). */}
        <View style={[styles.layer, { height: 88 * u, overflow: 'hidden' }]}>
          <Animated.View style={[styles.full, { transform: [{ translateY: printY }] }]}>
            <SvgXml xml={xml.receipt} width={SIZE} height={SIZE} />
            {xml.lines.map((l, i) => (
              <Animated.View key={i} style={[styles.layer, { opacity: lineOpacity(i) }]}>
                <SvgXml xml={l} width={SIZE} height={SIZE} />
              </Animated.View>
            ))}
          </Animated.View>
        </View>
        {/* The coin drops in from the top edge of the logo. */}
        <View style={[styles.layer, styles.full, { overflow: 'hidden' }]}>
          <Animated.View style={[styles.full, { transform: [{ translateY: coinY }] }]}>
            <SvgXml xml={xml.coin} width={SIZE} height={SIZE} />
          </Animated.View>
        </View>
      </View>
      <Animated.Text style={[styles.name, { opacity: nameOpacity, transform: [{ translateY: nameY }] }]}>
        {APP_NAME}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: MARK_COLORS.splashBackground,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  tile: { width: SIZE, height: SIZE },
  layer: { position: 'absolute', left: 0, top: 0, width: SIZE },
  full: { width: SIZE, height: SIZE },
  // Positioned below the centred tile so the tile stays exactly where the native splash drew it.
  name: {
    position: 'absolute',
    top: '50%',
    marginTop: SIZE / 2 + 20,
    fontFamily: fonts.bold,
    fontSize: 32,
    letterSpacing: -0.8,
    color: '#14211B',
  },
});
