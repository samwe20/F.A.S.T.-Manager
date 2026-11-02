function parseHex(value: string): [number, number, number] | null {
  const hex = value.trim().replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: [number, number, number]): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrast(foreground: string, background: string): number {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return 1;
  const lighter = Math.max(luminance(fg), luminance(bg));
  const darker = Math.min(luminance(fg), luminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(from: [number, number, number], to: [number, number, number], amount: number): string {
  const mixed = from.map((part, index) => Math.round(part + (to[index] - part) * amount));
  return `#${mixed.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

/** Keep a type color recognizable, and darken or lighten it until it reads on the page. */
export function labelInk(color: string, paper = '#ffffff'): string {
  const source = parseHex(color);
  const ground = parseHex(paper);
  if (!source || !ground) return color;
  if (contrast(color, paper) >= 4.5) return `#${source.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
  const toward: [number, number, number] = luminance(ground) > 0.4 ? [20, 20, 22] : [255, 255, 255];
  let low = 0;
  let high = 1;
  let ink = mix(source, toward, 1);
  for (let step = 0; step < 14; step += 1) {
    const amount = (low + high) / 2;
    const next = mix(source, toward, amount);
    if (contrast(next, paper) >= 4.5) {
      ink = next;
      high = amount;
    } else {
      low = amount;
    }
  }
  return ink;
}
