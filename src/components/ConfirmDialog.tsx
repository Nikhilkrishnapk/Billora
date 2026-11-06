/**
 * Custom confirmation dialog (replaces the plain system Alert for important actions).
 * Backdrop fades in, the card springs up, the icon pops in. Tap outside or press Back to
 * cancel. If onConfirm returns a promise, the confirm button shows a spinner until it
 * settles and the dialog can't be dismissed meanwhile.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space, type } from '../config/theme';

type Tone = 'danger' | 'primary';

const TONES: Record<Tone, { iconBg: string; iconColor: string; confirmBg: string; confirmPressed: string }> = {
  danger: { iconBg: colors.errorBg, iconColor: colors.destructive, confirmBg: colors.destructive, confirmPressed: '#7E1A1A' },
  primary: { iconBg: colors.primaryTint, iconColor: colors.primary, confirmBg: colors.primary, confirmPressed: colors.primaryDark },
};

export function ConfirmDialog({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  renderIcon,
  children,
  tone = 'primary',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message?: string;
  /** Icon drawn inside the coloured circle; receives the tone's icon colour. */
  renderIcon?: (color: string) => React.ReactNode;
  /** Optional extra content between the message and the buttons. */
  children?: React.ReactNode;
  tone?: Tone;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const t = TONES[tone];
  const [mounted, setMounted] = useState(visible);
  const [busy, setBusy] = useState(false);
  const backdrop = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const icon = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setBusy(false);
      backdrop.setValue(0);
      card.setValue(0);
      icon.setValue(0);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(card, { toValue: 1, damping: 16, stiffness: 220, mass: 0.9, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(90),
          Animated.spring(icon, { toValue: 1, damping: 9, stiffness: 260, useNativeDriver: true }),
        ]),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(card, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = () => {
    if (!busy) onClose();
  };

  const confirm = async () => {
    if (busy) return;
    const result = onConfirm();
    if (result && typeof (result as Promise<void>).then === 'function') {
      setBusy(true);
      try {
        await result;
      } finally {
        setBusy(false);
      }
    }
  };

  if (!mounted) return null;

  const cardStyle = {
    opacity: card.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
      { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
    ],
  };
  const iconStyle = { transform: [{ scale: icon.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], opacity: icon };

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel={cancelLabel} />
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle]} accessibilityViewIsModal accessibilityRole="alert">
          {renderIcon ? (
            <Animated.View style={[styles.iconRing, { backgroundColor: t.iconBg }, iconStyle]}>{renderIcon(t.iconColor)}</Animated.View>
          ) : null}
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {children ? <View style={{ alignSelf: 'stretch', marginTop: space.lg }}>{children}</View> : null}

          <View style={styles.actions}>
            <Pressable
              onPress={dismiss}
              disabled={busy}
              style={({ pressed }) => [styles.btn, styles.cancel, pressed && { backgroundColor: colors.divider }, busy && { opacity: 0.5 }]}
              accessibilityRole="button">
              <Text style={[styles.btnText, { color: colors.text }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              disabled={busy}
              style={({ pressed }) => [styles.btn, { backgroundColor: pressed || busy ? t.confirmPressed : t.confirmBg }]}
              accessibilityRole="button"
              accessibilityState={{ busy }}>
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={[styles.btnText, { color: colors.white }]}>{confirmLabel}</Text>}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  backdrop: { backgroundColor: colors.dim },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  iconRing: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, textAlign: 'center' },
  message: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginTop: space.sm, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl, alignSelf: 'stretch' },
  btn: { flex: 1, height: 50, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: colors.background },
  btnText: { fontFamily: fonts.bold, fontSize: 15.5 },
});
