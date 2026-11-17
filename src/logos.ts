import { brand, color, recolor, svgFor, type Logo } from "./brand";

const innerSvg = (file: string) => svgFor({ file } as Logo);

/** Geeft de volledige SVG van een logo in de gevraagde kleur. Een logo met "inner" (bijv. een ring met beeldmerk) wordt samengesteld. */
export function logoSvg(logo: Logo, colorId: string): string {
  const hex = color(colorId).hex;
  const base = recolor(svgFor(logo), logo.sourceFill, hex);
  const l = logo as Logo & { inner?: string; innerFill?: string; innerScale?: number };
  if (!l.inner || !l.innerFill) return base;

  const inner = recolor(innerSvg(l.inner), l.innerFill, hex);
  const vb = /viewBox="([^"]+)"/.exec(base)?.[1].split(/\s+/).map(Number) ?? [0, 0, 314, 314];
  const ivb = /viewBox="([^"]+)"/.exec(inner)?.[1].split(/\s+/).map(Number) ?? [0, 0, 100, 100];
  const size = vb[2] * (l.innerScale ?? 0.6);
  const h = (size * ivb[3]) / ivb[2];
  const x = vb[0] + (vb[2] - size) / 2;
  const y = vb[1] + (vb[3] - h) / 2;
  const innerPlaced = inner.replace(/<svg[^>]*>/, `<svg x="${x}" y="${y}" width="${size}" height="${h}" viewBox="${ivb.join(" ")}">`);
  return base.replace(/<\/svg>\s*$/, innerPlaced + "</svg>");
}

export const fileName = (logo: Logo, colorId: string, ext: string) =>
  `${brand.short.toLowerCase()}-${logo.id}-${colorId}.${ext}`;

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function downloadSvg(logo: Logo, colorId: string) {
  download(new Blob([logoSvg(logo, colorId)], { type: "image/svg+xml" }), fileName(logo, colorId, "svg"));
}

/** PNG met transparante achtergrond, standaard 2000 px breed. */
export async function pngBlob(logo: Logo, colorId: string, width = 2000): Promise<Blob> {
  const svg = logoSvg(logo, colorId);
  const vb = /viewBox="([^"]+)"/.exec(svg)?.[1].split(/\s+/).map(Number) ?? [0, 0, 1, 1];
  const height = Math.round((width * vb[3]) / vb[2]);
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG mislukt"))), "image/png"));
}

export async function downloadPng(logo: Logo, colorId: string) {
  download(await pngBlob(logo, colorId), fileName(logo, colorId, "png"));
}
