export function canvasToPdfCoords(
  elem: { x: number; y: number; width: number; height: number },
  canvasSize: { width: number; height: number },
  pdfSize: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const scaleX = pdfSize.width / canvasSize.width;
  const scaleY = pdfSize.height / canvasSize.height;

  const pdfWidth = elem.width * scaleX;
  const pdfHeight = elem.height * scaleY;
  const pdfX = elem.x * scaleX;
  // Browser top-left (0,0) to PDF bottom-left (0,0)
  const pdfY = pdfSize.height - ((elem.y + elem.height) * scaleY);

  return {
    x: Math.round(pdfX * 100) / 100,
    y: Math.round(pdfY * 100) / 100,
    width: Math.round(pdfWidth * 100) / 100,
    height: Math.round(pdfHeight * 100) / 100,
  };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: Math.round(r * 1000) / 1000,
    g: Math.round(g * 1000) / 1000,
    b: Math.round(b * 1000) / 1000,
  };
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
