/**
 * Billora logo mark: "Receipt B", green tile, gold ₹ coin.
 * Geometry is copied from the Billora – App UI design canvas (Mark.dc.html,
 * concept "receipt", tone "green", accent "gold") in a 100 × 100 box.
 *
 * Shared by:
 *  - scripts/generate-brand-assets.ts: app icons and the native splash image
 *  - src/components/AnimatedSplash.tsx: the animated splash screen
 *
 * Keep this file free of imports, so Node can run the generator script directly.
 */

export const MARK_COLORS = {
  base: '#0B5E45',
  hi: '#12825F',
  paper: '#FFFFFF',
  line: '#0B5E45',
  shadow: '#03291C',
  accent: '#F2B544',
  coinInk: '#0B3D2C',
  splashBackground: '#F5F6F3',
};

const C = MARK_COLORS;

/** Receipt-paper B with a torn bottom edge (two holes for the bowls). */
const B_PATH =
  'M24 18H58C70 18 78 26 78 36C78 42 75 46.5 70 49C77 51.5 82 58 82 66C82 76 74 84 62 84L57 89L52 84L47 89L42 84L37 89L32 84L28 89L24 84Z ' +
  'M48 29H57C61 29 64 32 64 35.5C64 39 61 42 57 42H48Z ' +
  'M48 55H60C64.5 55 67.5 58.5 67.5 62.5C67.5 66.5 64.5 70 60 70H48Z';

/** Printed lines on the receipt: x, y, width, height, radius (before the receipt's -3, -3.5 offset). */
export const RECEIPT_LINES: [number, number, number, number, number][] = [
  [29, 27, 14, 2.6, 1.3],
  [29, 33, 10, 2.6, 1.3],
  [29, 39, 13, 2.6, 1.3],
  [29, 56, 11, 2.6, 1.3],
  [29, 62, 14, 2.6, 1.3],
  [29, 71, 14, 4, 2],
];

/** The ₹ sign drawn as strokes, so it renders the same everywhere (no font needed). */
const RUPEE =
  `<g fill="none" stroke="${C.coinInk}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">` +
  '<path d="M68.2 17.4H75.8"/><path d="M68.2 20.4H75.8"/>' +
  '<path d="M68.4 17.4H70.8C73 17.4 74.3 18.8 74.3 20.5C74.3 22.2 73 23.6 70.8 23.6H68.8L73.8 27"/>' +
  '</g>';

export interface TileOptions {
  /** Rounded corners (rx 23). iOS icons must be square: iOS rounds them itself. */
  rounded?: boolean;
}

/** Green tile with its lighter diagonal highlight. */
export function tile({ rounded = true }: TileOptions = {}): string {
  const rx = rounded ? 23 : 0;
  return (
    `<defs><clipPath id="bl-tile"><rect width="100" height="100" rx="${rx}"/></clipPath></defs>` +
    `<g clip-path="url(#bl-tile)"><rect width="100" height="100" fill="${C.base}"/>` +
    `<path d="M0 0H100V34L0 86Z" fill="${C.hi}"/></g>`
  );
}

/** The thin "printer slot" the receipt comes out of (shown in the splash animation only). */
export function slot(opacity = 0.5): string {
  return `<rect x="17" y="86.5" width="68" height="3" rx="1.5" fill="${C.paper}" opacity="${opacity}"/>`;
}

/** The receipt B with its soft shadow, without the printed lines. */
export function receipt(): string {
  return (
    '<g transform="translate(-3 -3.5)">' +
    `<path transform="translate(2.5 3)" opacity="0.5" fill="${C.shadow}" fill-rule="evenodd" d="${B_PATH}"/>` +
    `<path fill="${C.paper}" fill-rule="evenodd" d="${B_PATH}"/>` +
    '</g>'
  );
}

/** One printed line (index into RECEIPT_LINES), already offset to sit on the receipt. */
export function receiptLine(i: number): string {
  const [x, y, w, h, r] = RECEIPT_LINES[i];
  return `<rect x="${x - 3}" y="${y - 3.5}" width="${w}" height="${h}" rx="${r}" fill="${C.line}"/>`;
}

export function receiptLines(): string {
  return RECEIPT_LINES.map((_, i) => receiptLine(i)).join('');
}

/** Gold ₹ coin, top right. */
export function coin(): string {
  return (
    `<circle cx="72" cy="22" r="12.5" fill="${C.accent}" stroke="${C.base}" stroke-width="2.5"/>` +
    `<circle cx="72" cy="22" r="8.5" fill="none" stroke="${C.coinInk}" stroke-width="1" opacity="0.35"/>` +
    RUPEE
  );
}

/** The finished still logo (the app icon). */
export function markContent(opts: TileOptions = {}): string {
  return tile(opts) + receipt() + receiptLines() + coin();
}

/** Wraps SVG elements drawn in the 100 × 100 box into a full SVG document. */
export function svgDoc(inner: string, size: number | string, viewBox = '0 0 100 100'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">${inner}</svg>`;
}
