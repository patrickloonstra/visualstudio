// WCAG 2.x contrast. Gedeeld door build-check, brandguide en studio.
function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function ratio(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** "text" = elke tekst (4.5:1), "large" = alleen grote koppen en grafische elementen (3:1), "never" = te weinig. */
export function contrastClass(a: string, b: string): "text" | "large" | "never" {
  const r = ratio(a, b);
  return r >= 4.5 ? "text" : r >= 3 ? "large" : "never";
}
