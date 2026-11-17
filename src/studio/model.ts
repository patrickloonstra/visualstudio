// Datamodel van de studio. Eén PostDoc bevat alles wat iemand invult, zodat het opgeslagen en later aangepast kan worden.
import { brand, color } from "../brand";
import { contrastClass } from "../wcag";

export type Box = { x: number; y: number; w: number; h: number; anchor?: "top" | "bottom" };
export type Layout = { id: string; label: string; photo: Box | null; text: Box; mark: { cx: number; cy: number } };
export type Format = { id: string; label: string; w: number; h: number; margin: number; markSize: number; layouts: Layout[] };
export type Theme = { id: string; label: string; bg: string; head: string; text: string; mark: string; primary?: boolean };
export type Role = "kicker" | "head" | "sub" | "details" | "cta";
export type Style = {
  label: string; use: string; font: "heading" | "body"; weight: number; lineHeight: number;
  sizes: string[]; maxWords: number; maxChars: number; noAllCaps?: boolean; rules: string[];
};
export type Fields = Record<Role, string>;
export type ElementOverride = { dx?: number; dy?: number; size?: string; color?: string; align?: "left" | "center" | "right" };

export type PostDoc = {
  id: string;
  version: 1;
  brand: string;
  created: string;
  updated: string;
  type: string;
  format: string;
  layout: string;
  theme: string;
  fields: Fields;
  /** data-URL (studio) of pad naast post.json (script). */
  photo: { src: string; x: number; y: number; zoom: number } | null;
  overrides: Partial<Record<Role | "block", ElementOverride>>;
};

export const ROLES: Role[] = ["kicker", "head", "sub", "details", "cta"];

type BrandExt = {
  short: string;
  formats: Format[];
  themes: Theme[];
  typeScale: Record<string, Record<string, number>>;
  typeSteps: [string, string][];
  styles: Record<Role, Style>;
  postTypes: { id: string; label: string; fields: Fields }[];
};
export const B = brand as unknown as BrandExt & typeof brand;

export const fmt = (id: string) => B.formats.find((f) => f.id === id) ?? B.formats[0];
export const layoutOf = (d: PostDoc) => fmt(d.format).layouts.find((l) => l.id === d.layout) ?? fmt(d.format).layouts[0];
export const themeOf = (d: PostDoc) => B.themes.find((t) => t.id === d.theme) ?? B.themes[0];
export const stepLabel = (id: string) => B.typeSteps.find(([s]) => s === id)?.[1] ?? id;
export const px = (format: string, step: string) => B.typeScale[format]?.[step] ?? B.typeScale[B.formats[0].id][step];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newDoc(type = B.postTypes[0].id, fields?: Partial<Fields>): PostDoc {
  const pt = B.postTypes.find((p) => p.id === type) ?? B.postTypes[0];
  const now = new Date().toISOString();
  const f = B.formats[0];
  return {
    id: uid(), version: 1, brand: B.short.toLowerCase(), created: now, updated: now,
    type: pt.id, format: f.id, layout: f.layouts[0].id,
    theme: (B.themes.find((t) => t.primary) ?? B.themes[0]).id,
    fields: { ...({ kicker: "", head: "", sub: "", details: "", cta: "" } as Fields), ...pt.fields, ...fields },
    photo: null, overrides: {},
  };
}

/** Standaard kleur van een rol in een thema. */
export const defaultColor = (role: Role, theme: Theme) => (role === "head" ? theme.head : theme.text);

/** Kleuren die op deze achtergrond voor deze rol mogen (alleen toegestane paren uit brand.json). */
export function allowedColors(role: Role, theme: Theme) {
  return brand.colors.map((c) => {
    const pair = brand.pairs.find((p) => p.bg === theme.bg && p.fg === c.id);
    const ok = !!pair && (pair.use !== "large" || role === "head");
    return { id: c.id, name: c.name, hex: c.hex, ok, cls: contrastClass(c.hex, color(theme.bg).hex), isBg: c.id === theme.bg };
  });
}

/** Past tekst automatisch aan de merkregels aan (bijv. geen hoofdletters in de kop). */
export function enforce(role: Role, text: string) {
  const st = B.styles[role];
  if (st?.noAllCaps && /[A-Z]/.test(text) && text === text.toUpperCase() && /[A-Z]{2}/.test(text)) {
    const lower = text.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return text;
}

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

// ---------- Varianten ----------
function shuffle<T>(arr: T[]) {
  return arr.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);
}

/** Kandidaat-varianten: elke passende layout in elk thema, primaire kleur vooraan. De studio toont de eerste zes die passen. */
export function makeVariants(base: PostDoc, keepLayouts?: string[]): PostDoc[] {
  const f = fmt(base.format);
  const pool = f.layouts.filter((l) => (base.photo ? !!l.photo : !l.photo)).map((l) => l.id);
  const primary = B.themes.find((t) => t.primary) ?? B.themes[0];
  const others = shuffle(B.themes.filter((t) => t !== primary));
  const make = (layout: string, theme: string) => ({ ...structuredClone(base), layout, theme, overrides: {} });
  if (keepLayouts) {
    // Kleuren schudden: zelfde layouts, andere toegestane thema's. Primair blijft ongeveer de helft.
    const seq = keepLayouts.map((_, i) => (i % 2 === 0 ? primary : others[(i >> 1) % others.length]));
    const themes = shuffle(seq);
    return keepLayouts.map((l, i) => make(l, themes[i].id));
  }
  // Ronde 1: elke layout in de primaire kleur, ronde 2+: elke layout in een andere kleur.
  const rounds = [primary, ...others];
  const out: PostDoc[] = [];
  rounds.forEach((t, r) => shuffle(pool).forEach((l) => out.push(make(l, r === 0 ? t.id : rounds[1 + ((r - 1 + pool.indexOf(l)) % others.length)].id))));
  // Volgorde mengen zodat de eerste zes afwisselen tussen primair en de rest.
  const prim = out.filter((d) => d.theme === primary.id);
  const rest = out.filter((d) => d.theme !== primary.id);
  const mixed: PostDoc[] = [];
  while (prim.length || rest.length) {
    if (prim.length) mixed.push(prim.shift()!);
    if (rest.length) mixed.push(rest.shift()!);
  }
  const seen = new Set<string>();
  return mixed.filter((d) => !seen.has(d.layout + d.theme) && seen.add(d.layout + d.theme));
}

// ---------- Tekst plakken ----------
/** Verdeelt geplakte tekst over de velden. De studio schrijft niets zelf, hij ordent alleen. */
export function splitPasted(text: string): Partial<Fields> {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out: Partial<Fields> = {};
  const rest: string[] = [];
  const isDate = (l: string) => /\b(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|\d{1,2}[-/]\d{1,2})\b/i.test(l) && wordCount(l) <= 6;
  const isCta = (l: string) => /(@|https?:\/\/|www\.|opgeven|aanmelden|meld je|geef je op|mail ons|app ons)/i.test(l) && wordCount(l) <= 10;
  for (const l of lines) {
    if (!out.kicker && isDate(l)) out.kicker = l;
    else if (!out.cta && isCta(l)) out.cta = l;
    else if (!out.head && wordCount(l) <= 8) out.head = l.replace(/[.!]+$/, (m) => (m.includes("!") ? "!" : ""));
    else if (out.head && !out.sub && wordCount(l) <= 14) out.sub = l;
    else rest.push(l);
  }
  if (!out.head && rest.length) out.head = rest.shift()!;
  if (rest.length) out.details = rest.join(" ");
  return out;
}
