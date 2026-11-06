import qrcode from 'qrcode-generator';

/** QR module matrix (true = dark), quiet zone not included. */
export function qrMatrix(payload: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(payload, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const rows: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    rows.push(row);
  }
  return rows;
}

/** Crisp SVG of the QR code, used on the A4 invoice and in previews. */
export function qrSvg(payload: string, sizeCss: string): string {
  const m = qrMatrix(payload);
  const n = m.length;
  const quiet = 2;
  let path = '';
  m.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }),
  );
  const total = n + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizeCss}" height="${sizeCss}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
