// Content studio: vergrendelde post-generator. Alles komt uit brand.json (formats, themes, typeScale, postTypes).
import { toPng } from "html-to-image";
import { brand, color, type Logo } from "./brand";
import { logoSvg } from "./logos";

type Box = { x: number; y: number; w: number; h: number };
type Layout = { id: string; label: string; photo: Box | null; text: Box; stempel: { cx: number; cy: number } };
type Format = { id: string; label: string; w: number; h: number; margin: number; stempel: number; layouts: Layout[] };
type Theme = { id: string; label: string; bg: string; head: string; text: string; stempel: string };
type Fields = { kicker: string; head: string; sub: string; details: string };
type Scale = { kicker: number; headline: [number, number]; sub: [number, number]; body: number };

const b = brand as unknown as {
  formats: Format[];
  themes: Theme[];
  typeScale: Record<string, Scale>;
  postTypes: { id: string; label: string; fields: Fields }[];
  limits: { kicker: number; head: number; headWords: number; sub: number; details: number };
  logos: Logo[];
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const stempel = b.logos.find((l) => l.id === "stempel")!;

const state = {
  format: b.formats[0],
  type: b.postTypes[0].id,
  fields: { ...b.postTypes[0].fields } as Fields,
  photo: "" as string,
  pos: { x: 50, y: 50 },
  variants: [] as { layout: Layout; theme: Theme }[],
  selected: 0,
};

// ---------- Post renderen ----------
function postHtml(layout: Layout, theme: Theme, f: Fields) {
  const fmt = state.format;
  const s = fmt.stempel;
  const bg = color(theme.bg).hex;
  const photo = layout.photo
    ? state.photo
      ? `<img class="p-photo" src="${state.photo}" alt="" style="left:${layout.photo.x}px;top:${layout.photo.y}px;width:${layout.photo.w}px;height:${layout.photo.h}px;object-position:${state.pos.x}% ${state.pos.y}%">`
      : `<div class="p-photo p-empty" style="left:${layout.photo.x}px;top:${layout.photo.y}px;width:${layout.photo.w}px;height:${layout.photo.h}px;color:${color(theme.text).hex}"><span>Jouw foto</span></div>`
    : "";
  const t = layout.text;
  return `<div class="post" style="width:${fmt.w}px;height:${fmt.h}px;background:${bg}">
    ${photo}
    <div class="p-text" style="left:${t.x}px;top:${t.y}px;width:${t.w}px;max-height:${t.h}px">
      ${f.kicker ? `<p class="p-kicker" style="color:${color(theme.text).hex}">${esc(f.kicker)}</p>` : ""}
      <p class="p-head" style="color:${color(theme.head).hex}">${esc(f.head)}</p>
      ${f.sub ? `<p class="p-sub" style="color:${color(theme.text).hex}">${esc(f.sub)}</p>` : ""}
      ${f.details ? `<p class="p-details" style="color:${color(theme.text).hex}">${esc(f.details)}</p>` : ""}
    </div>
    <div class="p-stempel" style="left:${layout.stempel.cx - s / 2}px;top:${layout.stempel.cy - s / 2}px;width:${s}px;height:${s}px">${logoSvg(stempel, theme.stempel)}</div>
  </div>`;
}

/** Krimpt kop en subregel binnen de typeschaal tot de tekst in het tekstvak past. Geeft false als het niet lukt. */
function fit(post: HTMLElement, layout: Layout): boolean {
  const scale = b.typeScale[state.format.id];
  const box = post.querySelector<HTMLElement>(".p-text")!;
  const head = box.querySelector<HTMLElement>(".p-head")!;
  const sub = box.querySelector<HTMLElement>(".p-sub");
  const kicker = box.querySelector<HTMLElement>(".p-kicker");
  const details = box.querySelector<HTMLElement>(".p-details");
  if (kicker) kicker.style.fontSize = scale.kicker + "px";
  if (details) details.style.fontSize = scale.body + "px";
  const [hMin, hMax] = scale.headline;
  const [sMin, sMax] = scale.sub;
  for (let size = hMax; size >= hMin; size -= 2) {
    const k = (size - hMin) / (hMax - hMin || 1);
    head.style.fontSize = size + "px";
    if (sub) sub.style.fontSize = Math.round(sMin + k * (sMax - sMin)) + "px";
    const wordsFit = [head, sub].every((el) => !el || el.scrollWidth <= box.clientWidth + 1);
    const lines = Math.round(head.offsetHeight / (size * 1.0));
    if (wordsFit && box.scrollHeight <= layout.text.h && lines <= 3) return true;
  }
  return false;
}

// ---------- Varianten ----------
function shuffle<T>(arr: T[]) {
  return arr.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);
}

function makeVariants(keepLayouts = false) {
  const all = state.format.layouts;
  const photoLayouts = all.filter((l) => l.photo);
  const layouts =
    keepLayouts && state.variants.length
      ? state.variants.map((v) => v.layout)
      : [...photoLayouts, ...shuffle(photoLayouts), ...all.filter((l) => !l.photo)].slice(0, 6);
  // Groen is de hoofdkleur (55%): ongeveer de helft van de varianten is groen.
  const groen = b.themes.find((t) => t.id === "groen") ?? b.themes[0];
  const others = b.themes.filter((t) => t !== groen);
  const seq = layouts.map((_, i) => (i % 2 === 0 ? groen : others[(i >> 1) % others.length]));
  for (let tries = 0; tries < 20; tries++) {
    const themes = shuffle(seq);
    const keys = layouts.map((l, i) => l.id + themes[i].id);
    if (new Set(keys).size === keys.length || tries === 19) {
      state.variants = layouts.map((layout, i) => ({ layout, theme: themes[i] }));
      break;
    }
  }
  state.selected = Math.max(0, Math.min(state.selected, state.variants.length - 1));
}

// ---------- UI ----------
function warnings(): string[] {
  const w: string[] = [];
  const words = state.fields.head.trim().split(/\s+/).filter(Boolean).length;
  if (!state.fields.head.trim()) w.push("Vul een kop in.");
  if (words > b.limits.headWords) w.push(`Kop te lang: maximaal ${b.limits.headWords} woorden (nu ${words}).`);
  return w;
}

export function studioHtml() {
  const L = b.limits;
  const f = state.fields;
  return `<div class="studio-app">
    <form class="st-form" autocomplete="off">
      <label>Soort post
        <select name="type">${b.postTypes.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join("")}</select>
      </label>
      <label>Formaat
        <select name="format">${b.formats.map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join("")}</select>
      </label>
      <label>Kleine regel boven <small>bijv. datum</small>
        <input name="kicker" maxlength="${L.kicker}" value="${esc(f.kicker)}">
      </label>
      <label>Kop <small>max ${L.headWords} woorden</small>
        <input name="head" maxlength="${L.head}" value="${esc(f.head)}" required>
      </label>
      <label>Subregel
        <input name="sub" maxlength="${L.sub}" value="${esc(f.sub)}">
      </label>
      <label>Details <small>tijd, plek, opgeven</small>
        <input name="details" maxlength="${L.details}" value="${esc(f.details)}">
      </label>
      <label class="file">Foto <small>optioneel</small>
        <input type="file" name="photo" accept="image/*">
      </label>
      <div class="st-pos" hidden>
        <label>Foto verschuiven ↔ <input type="range" name="px" min="0" max="100" value="50"></label>
        <label>Foto verschuiven ↕ <input type="range" name="py" min="0" max="100" value="50"></label>
      </div>
      <div class="st-warn" role="alert"></div>
      <div class="st-actions">
        <button type="button" class="btn small" data-act="make">Maak layouts</button>
        <button type="button" class="btn small ghost" data-act="shuffle">Andere kleuren</button>
      </div>
    </form>
    <div class="st-main">
      <div class="st-preview"><div class="st-scale"></div></div>
      <div class="st-dl">
        <button type="button" class="btn" data-act="png">Download PNG</button>
        <span class="st-meta"></span>
      </div>
      <div class="st-variants" aria-label="Varianten"></div>
    </div>
  </div>`;
}

function scaleTo(el: HTMLElement, width: number) {
  const fmt = state.format;
  const s = width / fmt.w;
  el.style.width = width + "px";
  el.style.height = fmt.h * s + "px";
  const post = el.firstElementChild as HTMLElement | null;
  if (post) post.style.transform = `scale(${s})`;
}

let root: HTMLElement;

async function render() {
  await document.fonts.ready;
  const warn = warnings();
  root.querySelector(".st-warn")!.innerHTML = warn.map((w) => `<p>${esc(w)}</p>`).join("");

  // Varianten (miniaturen)
  const list = root.querySelector<HTMLElement>(".st-variants")!;
  list.innerHTML = state.variants
    .map(
      (v, i) => `<button type="button" class="st-var${i === state.selected ? " on" : ""}" data-i="${i}" aria-label="${esc(v.layout.label)}, ${esc(v.theme.label)}">
        <div class="st-thumb">${postHtml(v.layout, v.theme, state.fields)}</div>
        <span>${esc(v.layout.label)} · ${esc(v.theme.label)}</span>
      </button>`,
    )
    .join("");
  list.querySelectorAll<HTMLElement>(".st-thumb").forEach((t, i) => {
    scaleTo(t, t.parentElement!.clientWidth - 2 || 160);
    const ok = fit(t.firstElementChild as HTMLElement, state.variants[i].layout);
    t.parentElement!.classList.toggle("bad", !ok);
  });

  // Grote preview
  const v = state.variants[state.selected];
  const big = root.querySelector<HTMLElement>(".st-scale")!;
  big.innerHTML = postHtml(v.layout, v.theme, state.fields);
  scaleTo(big, Math.min(root.querySelector<HTMLElement>(".st-preview")!.clientWidth, 540));
  const ok = fit(big.firstElementChild as HTMLElement, v.layout);
  const meta = root.querySelector<HTMLElement>(".st-meta")!;
  meta.textContent = ok ? `${state.format.w} × ${state.format.h} px · ${v.layout.label} · ${v.theme.label}` : "Tekst past niet in deze layout. Maak de kop korter of kies een andere variant.";
  meta.classList.toggle("bad", !ok);
  root.querySelector<HTMLButtonElement>("[data-act=png]")!.disabled = !ok || warn.length > 0;
}

async function exportPng() {
  const v = state.variants[state.selected];
  // Render op ware grootte buiten beeld, zodat de export exact 1080 breed is.
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-99999px;top:0";
  holder.innerHTML = postHtml(v.layout, v.theme, state.fields);
  document.body.append(holder);
  const post = holder.firstElementChild as HTMLElement;
  fit(post, v.layout);
  try {
    const url = await toPng(post, { width: state.format.w, height: state.format.h, pixelRatio: 1, cacheBust: true });
    const a = document.createElement("a");
    const slug = state.fields.head.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.href = url;
    a.download = `${brand.short.toLowerCase()}-${slug || "post"}-${state.format.id}.png`;
    a.click();
  } finally {
    holder.remove();
  }
}

export function mountStudio(el: HTMLElement) {
  root = el;
  makeVariants();
  const form = el.querySelector<HTMLFormElement>(".st-form")!;

  form.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name in state.fields) (state.fields as Record<string, string>)[t.name] = t.value;
    if (t.name === "px") state.pos.x = Number(t.value);
    if (t.name === "py") state.pos.y = Number(t.value);
    if (t.name === "type") {
      state.type = t.value;
      state.fields = { ...b.postTypes.find((p) => p.id === t.value)!.fields };
      (["kicker", "head", "sub", "details"] as const).forEach((k) => ((form.elements.namedItem(k) as HTMLInputElement).value = state.fields[k]));
    }
    if (t.name !== "photo") render();
  });

  form.querySelector<HTMLInputElement>("[name=photo]")!.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.photo = String(reader.result);
      form.querySelector<HTMLElement>(".st-pos")!.hidden = false;
      // Met foto: kies een variant die de foto ook laat zien.
      if (!state.variants[state.selected].layout.photo) state.selected = state.variants.findIndex((v) => v.layout.photo);
      render();
    };
    reader.readAsDataURL(file);
  });

  el.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-act], .st-var");
    if (!btn) return;
    if (btn.classList.contains("st-var")) state.selected = Number(btn.dataset.i);
    else if (btn.dataset.act === "make") {
      makeVariants();
      state.selected = 0;
    } else if (btn.dataset.act === "shuffle") makeVariants(true);
    else if (btn.dataset.act === "png") return void exportPng();
    render();
  });

  window.addEventListener("resize", () => render());
  render();
}
