import React from 'react';
import { SvgXml } from 'react-native-svg';
import { markContent, svgDoc } from '../brand/mark';

const XML = svgDoc(markContent({ rounded: true }), 100);

/** The Billora logo (same artwork as the app icon). */
export function BrandMark({ size = 48 }: { size?: number }) {
  return <SvgXml xml={XML} width={size} height={size} accessibilityLabel="Billora logo" />;
}
