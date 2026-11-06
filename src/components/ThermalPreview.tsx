import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { fonts } from '../config/theme';
import { PAPER, type ThermalLine } from '../lib/thermal';
import { qrSvg } from '../lib/qr';
import type { PaperWidth } from '../types';

/** On-screen rendering of exactly the lines that are sent to the printer. */
export function ThermalPreview({ lines, paperWidth }: { lines: ThermalLine[]; paperWidth: PaperWidth }) {
  const { width } = useWindowDimensions();
  const spec = PAPER[paperWidth];
  const paper = Math.min(width - 48, paperWidth === 58 ? 300 : 360);
  const inner = paper - 24;
  // Monospace glyph advance ≈ 0.6 em
  const fontSize = Math.floor((inner / spec.cols / 0.6) * 10) / 10;
  return (
    <View style={[styles.paper, { width: paper }]} accessibilityLabel="Thermal bill preview">
      {lines.map((l, i) => {
        if (l.kind === 'feed') return <View key={i} style={{ height: fontSize * 1.3 * Math.min(l.lines, 2) }} />;
        if (l.kind === 'qr') {
          const size = (inner * l.widthDots) / spec.dots;
          return (
            <View key={i} style={{ alignItems: 'center', marginVertical: 4 }}>
              <SvgXml xml={qrSvg(l.payload, String(size))} width={size} height={size} />
            </View>
          );
        }
        return (
          <Text
            key={i}
            style={[
              styles.line,
              { fontSize, textAlign: l.align, lineHeight: fontSize * (l.large ? 2.1 : 1.35) },
              l.bold && { fontFamily: fonts.monoBold },
              l.large && { transform: [{ scaleY: 1.6 }] },
            ]}>
            {l.text}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  line: { fontFamily: fonts.mono, color: '#000' },
});
