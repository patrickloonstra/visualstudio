// WCAG 2.x contrast. Gebruikt door de build (vite plugin) en `npm run check`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Color = { id: string; name: string; hex: string };
export type Pair = { bg: string; fg: string; use?: "text" | "large" };

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

/** Geeft een lijst fouten terug. Leeg = alles in orde. */
export function checkBrand(brandDir: string): { errors: string[]; report: string[] } {
  const brand = JSON.parse(readFileSync(resolve(brandDir, "brand.json"), "utf8"));
  const colors: Color[] = brand.colors ?? [];
  const pairs: Pair[] = brand.pairs ?? [];
  const byId = new Map(colors.map((c) => [c.id, c]));
  const errors: string[] = [];
  const report: string[] = [];

  for (const p of pairs) {
    const bg = byId.get(p.bg);
    const fg = byId.get(p.fg);
    if (!bg || !fg) {
      errors.push(`Kleurpaar ${p.bg}/${p.fg}: onbekende kleur-id`);
      continue;
    }
    const r = ratio(bg.hex, fg.hex);
    // "text" (standaard) = 4.5:1, "large" = alleen grote tekst/koppen, 3:1
    const min = p.use === "large" ? 3 : 4.5;
    const line = `${p.fg} op ${p.bg}: ${r.toFixed(2)}:1 (minimaal ${min}:1)`;
    if (r < min) errors.push(`Kleurpaar haalt WCAG AA niet: ${line}`);
    else report.push(line);
  }
  return { errors, report };
}
