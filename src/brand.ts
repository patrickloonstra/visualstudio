// Laadt brand.json en de assets van het actieve merk (alias @brand, gekozen via BRAND).
import raw from "@brand/brand.json";

export type Color = { id: string; name: string; hex: string; role: string; roleLabel: string; ratio: number; cmyk?: string };
export type Pair = { bg: string; fg: string; use?: "text" | "large" };
export type Logo = { id: string; label: string; file: string; sourceFill: string; colorways: string[]; minWidth: number; note?: string };
export type Font = { family: string; file: string; italic?: string; weights: [number, number]; use: string };
export type Brand = {
  name: string;
  short: string;
  colors: Color[];
  pairs: Pair[];
  fonts: { heading: Font; body: Font };
  logos: Logo[];
  voice: { draft?: boolean; rules: string[]; examples: { goed: string; liever?: string }[] };
  dosDonts: { do: boolean; text: string }[];
};

export const brand = raw as unknown as Brand;

const svgs = import.meta.glob("@brand/assets/logos/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const fonts = import.meta.glob("@brand/assets/fonts/*.woff2", { query: "?url", import: "default", eager: true }) as Record<string, string>;
const photos = import.meta.glob("@brand/assets/photos/*.{jpg,jpeg,png,webp}", { query: "?url", import: "default", eager: true }) as Record<string, string>;

const byFile = <T,>(map: Record<string, T>, file: string) =>
  Object.entries(map).find(([k]) => k.endsWith("/" + file))?.[1];

export const svgFor = (logo: Logo) => byFile(svgs, logo.file) ?? "";
export const fontUrl = (file: string) => byFile(fonts, file) ?? "";
export const photoUrls = Object.values(photos);

export const color = (id: string) => {
  const c = brand.colors.find((c) => c.id === id);
  if (!c) throw new Error(`Onbekende kleur: ${id}`);
  return c;
};

export function recolor(svg: string, from: string, to: string) {
  // Multiply-blend uit het bronbestand weghalen: over een foto wordt de kleur anders donkerder dan het merkkleur.
  return svg.replace(new RegExp(from, "gi"), to).replace(/\s*style="mix-blend-mode:multiply"/g, "");
}

export function rgb(hex: string) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
