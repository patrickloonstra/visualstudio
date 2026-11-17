// Merkcontrole: structuur van brand.json, bestanden en WCAG-contrast. Gebruikt door de build (vite plugin) en `npm run check`.
import { existsSync, readFileSync } from "node:fs";
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

  // ---------- Structuur ----------
  const required = ["name", "short", "colors", "pairs", "fonts", "logos", "ui", "themes", "formats", "typeScale", "typeSteps", "styles", "postTypes"];
  for (const k of required) if (brand[k] === undefined) errors.push(`brand.json mist "${k}" (zie brands/_template/brand.json)`);
  const known = (id: string, where: string) => {
    if (!byId.has(id)) errors.push(`${where}: kleur "${id}" bestaat niet in colors`);
  };
  for (const l of brand.logos ?? []) {
    for (const f of [l.file, l.inner].filter(Boolean)) if (!existsSync(resolve(brandDir, "assets", f))) errors.push(`Logo ${l.id}: bestand assets/${f} ontbreekt`);
    (l.colorways ?? []).forEach((c: string) => known(c, `Logo ${l.id}`));
  }
  for (const k of ["heading", "body"]) {
    const f = brand.fonts?.[k];
    if (f?.file && !existsSync(resolve(brandDir, "assets", f.file))) errors.push(`Font ${k}: bestand assets/${f.file} ontbreekt`);
  }
  for (const t of brand.themes ?? []) ["bg", "head", "text", "mark"].forEach((x) => known(t[x], `Thema ${t.id}.${x}`));
  if (brand.themes && !brand.themes.some((t: { primary?: boolean }) => t.primary)) errors.push(`themes: zet bij één thema "primary": true`);
  if (brand.postMark && !(brand.logos ?? []).some((l: { id: string }) => l.id === brand.postMark)) errors.push(`postMark "${brand.postMark}" is geen logo-id`);
  const steps = new Set((brand.typeSteps ?? []).map((s: [string, string]) => s[0]));
  for (const [role, st] of Object.entries<{ sizes: string[] }>(brand.styles ?? {}))
    st.sizes.forEach((sz) => !steps.has(sz) && errors.push(`Stijl ${role}: grootte "${sz}" staat niet in typeSteps`));
  for (const f of brand.formats ?? []) {
    if (!brand.typeScale?.[f.id]) errors.push(`Formaat ${f.id}: geen typeScale.${f.id}`);
    else steps.forEach((sz) => brand.typeScale[f.id][sz as string] === undefined && errors.push(`typeScale.${f.id} mist "${sz}"`));
    if (!f.layouts?.some((l: { photo: unknown }) => l.photo)) errors.push(`Formaat ${f.id}: minstens één layout met foto nodig`);
    if (!f.layouts?.some((l: { photo: unknown }) => !l.photo)) errors.push(`Formaat ${f.id}: minstens één layout zonder foto nodig`);
  }

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
    const st = byId.get(t.mark);
    const bg = byId.get(t.bg);
    if (st && bg && ratio(st.hex, bg.hex) < 3) errors.push(`Thema ${t.id}: merkteken haalt 3:1 niet op ${t.bg}`);
    if (head && text) report.push(`thema ${t.id}: kop ${t.head}, tekst ${t.text} op ${t.bg}`);
  }
  // De pagina zelf gebruikt ook alleen toegestane paren.
  const ui = brand.ui ?? {};
  for (const [bg, fg] of [["primary", "onPrimary"], ["paper", "ink"], ["surface", "ink"], ["highlight", "ink"]]) {
    if (!ui[bg] || !ui[fg]) {
      errors.push(`ui.${bg} of ui.${fg} ontbreekt in brand.json`);
      continue;
    }
    if (!pairs.find((p) => p.bg === ui[bg] && p.fg === ui[fg] && p.use !== "large")) errors.push(`ui: ${ui[fg]} op ${ui[bg]} is geen toegestaan paar`);
  }
  return { errors, report };
}
