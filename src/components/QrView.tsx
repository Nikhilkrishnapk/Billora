import React from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { qrSvg } from '../lib/qr';

/** Draws the payment QR from its text, so no image needs to be stored. */
export function QrView({ payload, size, dimmed }: { payload: string; size: number; dimmed?: boolean }) {
  if (!payload) return <View style={{ width: size, height: size }} />;
  return (
    <View style={{ opacity: dimmed ? 0.55 : 1 }} accessibilityLabel="Payment QR code">
      <SvgXml xml={qrSvg(payload, String(size))} width={size} height={size} />
    </View>
  );
}
