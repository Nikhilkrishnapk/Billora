import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../config/theme';

export function PrintingOverlay({ visible }: { visible: boolean }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.box} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.text}>Printing…</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.dim, alignItems: 'center', justifyContent: 'center' },
  box: { backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 24, paddingHorizontal: 40, alignItems: 'center', gap: 12 },
  text: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
});
