// Rendert een PostDoc naar HTML op ware grootte, past tekst in de typeschaal en controleert de merkregels.
import { toPng } from "html-to-image";
import { brand, color } from "../brand";
import { markSvg, postMarks } from "../logos";
import { B, ROLES, allowedColors, defaultColor, fmt, layoutOf, px, themeOf, wordCount, type PostDoc, type Role } from "./model";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function postHtml(d: PostDoc, opts: { editable?: boolean } = {}) {
  const f = fmt(d.format);
  const L = layoutOf(d);
  const t = themeOf(d);
  const s = f.markSize;
  const ms = s * ((postMarks().find((m) => m.id === d.mark) ?? postMarks()[0]).scale ?? 1);
  let photo = "";
  if (L.photo) {
    const p = L.photo;
    const box = `left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px`;
    photo = d.photo
      ? `<div class="p-photo" data-role="photo" style="${box}"><img src="${d.photo.src}" alt="" draggable="false" style="object-position:${d.photo.x}% ${d.photo.y}%;transform:scale(${d.photo.zoom});transform-origin:${d.photo.x}% ${d.photo.y}%"></div>`
      : `<div class="p-photo p-empty" data-role="photo" style="${box};color:${color(t.text).hex}"><span>Jouw foto</span></div>`;
  }
  const tb = L.text;
  const pos = tb.anchor === "bottom" ? `bottom:${f.h - tb.y - tb.h}px` : `top:${tb.y}px`;
  const els = ROLES.filter((r) => d.fields[r]?.trim())
    .map((r) => {
      const st = B.styles[r];
      const o = d.overrides[r] ?? {};
      const c = color(o.color ?? defaultColor(r, t)).hex;
      const size = px(d.format, o.size ?? st.sizes[0]);
      const family = st.font === "heading" ? "var(--font-heading)" : "var(--font-body)";
      return `<p class="p-el p-${r}" data-role="${r}" style="font-family:${family};font-weight:${st.weight};line-height:${st.lineHeight};font-size:${size}px;color:${c};text-align:${o.align ?? "left"};transform:translate(${o.dx ?? 0}px,${o.dy ?? 0}px)">${esc(d.fields[r])}</p>`;
    })
    .join("");
  return `<div class="post${opts.editable ? " editable" : ""}" style="width:${f.w}px;height:${f.h}px;background:${color(t.bg).hex}">
    ${photo}
    <div class="p-text" style="left:${tb.x}px;${pos};width:${tb.w}px">${els}</div>
    <div class="p-mark" style="left:${L.mark.cx - ms / 2}px;top:${L.mark.cy - ms / 2}px;width:${ms}px;height:${ms}px">${markSvg(d.mark, t.mark)}</div>
  </div>`;
}

/** Kiest per rol zonder vaste grootte de grootste stap die past. Geeft false als de tekst niet past. */
export function fit(post: HTMLElement, d: PostDoc): boolean {
  const L = layoutOf(d);
  const box = post.querySelector<HTMLElement>(".p-text")!;
  const el = (r: Role) => box.querySelector<HTMLElement>(`.p-${r}`);
  const autoSizes = (r: Role) => (d.overrides[r]?.size ? [d.overrides[r]!.size!] : B.styles[r].sizes);
  const fits = () =>
    box.scrollHeight <= L.text.h &&
    ROLES.every((r) => {
      const e = el(r);
      return !e || e.scrollWidth <= box.clientWidth + 1;
    }) &&
    headLines() <= 3.05;
  const headLines = () => {
    const h = el("head");
    return h ? h.offsetHeight / (parseFloat(h.style.fontSize) * B.styles.head.lineHeight) : 0;
  };
  for (const hs of autoSizes("head")) {
    for (const ss of autoSizes("sub")) {
      const h = el("head");
      const s = el("sub");
      if (h) h.style.fontSize = px(d.format, hs) + "px";
      if (s) s.style.fontSize = px(d.format, ss) + "px";
      if (fits()) return true;
    }
  }
  return false;
}

export type Issue = { role?: Role | "photo"; msg: string };

/** Alle merkregels die de post schendt. Leeg = on brand. Werkt op een gerenderde (en gefitte) post. */
export function check(post: HTMLElement, d: PostDoc, fitted: boolean): Issue[] {
  const issues: Issue[] = [];
  const f = fmt(d.format);
  const t = themeOf(d);
  if (!d.fields.head.trim()) issues.push({ role: "head", msg: "Vul een kop in." });
  for (const r of ROLES) {
    const st = B.styles[r];
    const n = wordCount(d.fields[r] ?? "");
    if (n > st.maxWords) issues.push({ role: r, msg: `${st.label} te lang: maximaal ${st.maxWords} woorden (nu ${n}).` });
    const c = d.overrides[r]?.color;
    if (c && !allowedColors(r, t).find((x) => x.id === c)?.ok) issues.push({ role: r, msg: `${st.label}: deze kleur mag niet op ${t.label.toLowerCase()}.` });
  }
  if (!fitted) issues.push({ msg: "De tekst past niet in deze layout. Maak hem korter of kies een andere variant." });

  // Positie: binnen de marge, en nooit over de foto.
  const scale = post.getBoundingClientRect().width / f.w || 1;
  const origin = post.getBoundingClientRect();
  const rel = (e: Element) => {
    const r = e.getBoundingClientRect();
    return { x: (r.left - origin.left) / scale, y: (r.top - origin.top) / scale, w: r.width / scale, h: r.height / scale };
  };
  const photoEl = post.querySelector(".p-photo");
  const ph = photoEl ? rel(photoEl) : null;
  post.querySelectorAll<HTMLElement>(".p-el").forEach((e) => {
    const r = e.dataset.role as Role;
    const b = rel(e);
    const m = f.margin - 1;
    if (b.x < m || b.y < m || b.x + b.w > f.w - m || b.y + b.h > f.h - m) issues.push({ role: r, msg: `${B.styles[r].label} komt buiten de marge.` });
    if (ph && b.x < ph.x + ph.w && b.x + b.w > ph.x && b.y < ph.y + ph.h && b.y + b.h > ph.y)
      issues.push({ role: r, msg: `${B.styles[r].label} staat op de foto. Tekst hoort op het vlak.` });
  });
  return issues;
}

/** Rendert buiten beeld op ware grootte en geeft een PNG data-URL plus eventuele merkfouten. */
export async function renderPng(d: PostDoc): Promise<{ png: string; issues: Issue[] }> {
  await document.fonts.ready;
  const f = fmt(d.format);
  const holder = document.createElement("div");
  holder.style.cssText = `position:fixed;left:0;top:0;width:${f.w}px;height:${f.h}px;opacity:0;pointer-events:none;z-index:-1`;
  holder.innerHTML = postHtml(d);
  document.body.append(holder);
  const post = holder.firstElementChild as HTMLElement;
  try {
    const img = post.querySelector("img");
    if (img && !img.complete) await img.decode().catch(() => undefined);
    const ok = fit(post, d);
    const issues = check(post, d, ok);
    const png = await toPng(post, { width: f.w, height: f.h, pixelRatio: 1, style: { opacity: "1" } });
    return { png, issues };
  } finally {
    holder.remove();
  }
}

export const fileSlug = (d: PostDoc) =>
  `${B.short.toLowerCase()}-${d.fields.head.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "post"}-${d.format}`;
