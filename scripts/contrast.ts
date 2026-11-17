// WCAG 2.x contrast. Gebruikt door de build (vite plugin) en `npm run check`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ratio } from "../src/wcag";
export { ratio };

export type Color = { id: string; name: string; hex: string };
export type Pair = { bg: string; fg: string; use?: "text" | "large" };

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
  // Thema's in de studio mogen alleen toegestane paren gebruiken.
  for (const t of brand.themes ?? []) {
    const head = pairs.find((p) => p.bg === t.bg && p.fg === t.head);
    const text = pairs.find((p) => p.bg === t.bg && p.fg === t.text && p.use !== "large");
    if (!head) errors.push(`Thema ${t.id}: kop ${t.head} op ${t.bg} is geen toegestaan paar`);
    if (!text) errors.push(`Thema ${t.id}: tekst ${t.text} op ${t.bg} is geen toegestaan paar voor kleine tekst`);
    const st = byId.get(t.stempel);
    const bg = byId.get(t.bg);
    if (st && bg && ratio(st.hex, bg.hex) < 3) errors.push(`Thema ${t.id}: stempel haalt 3:1 niet op ${t.bg}`);
    if (head && text) report.push(`thema ${t.id}: kop ${t.head}, tekst ${t.text} op ${t.bg}`);
  }
  return { errors, report };
}
