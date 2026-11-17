// Studio-interface: briefing, varianten, editor met inspectiepaneel, Mijn posts.
import { brand, color } from "../brand";
import {
  B, ROLES, allowedColors, defaultColor, enforce, fmt, layoutOf, makeVariants, newDoc, splitPasted, stepLabel, themeOf, wordCount,
  type PostDoc, type Role,
} from "./model";
import { check, fileSlug, fit, postHtml, renderPng, type Issue } from "./render";
import { deletePost, downloadFile, importFile, listPosts, savePost, storage } from "./store";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const ALIGN = ((brand as unknown as { align?: string[] }).align ?? ["left"]) as ("left" | "center" | "right")[];

type Sel = Role | "photo" | null;
const S = {
  doc: null as PostDoc | null,
  variants: [] as PostDoc[],
  sel: null as Sel,
  history: [] as string[],
  issues: [] as Issue[],
};

// ---------- Helpers ----------
/** Zet een post (op ware grootte) geschaald in een houder van de gegeven breedte. */
function mount(holder: HTMLElement, d: PostDoc, width: number, editable = false) {
  const f = fmt(d.format);
  const s = width / f.w;
  holder.style.width = width + "px";
  holder.style.height = f.h * s + "px";
  holder.innerHTML = postHtml(d, { editable });
  const post = holder.firstElementChild as HTMLElement;
  post.style.transform = `scale(${s})`;
  const ok = fit(post, d);
  return { post, ok, scale: s };
}

function toast(msg: string) {
  const t = document.querySelector<HTMLElement>(".toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(Number(t.dataset.timer));
  t.dataset.timer = String(setTimeout(() => t.classList.remove("show"), 2200));
}

let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    if (!S.doc) return;
    await savePost(S.doc);
    renderLibrary();
  }, 400);
}

function snapshot() {
  if (!S.doc) return;
  const snap = JSON.stringify(S.doc);
  if (S.history[S.history.length - 1] !== snap) S.history.push(snap);
  if (S.history.length > 60) S.history.shift();
}

// ---------- HTML ----------
export function studioHtml() {
  const formats = B.formats.map((f) => `<option value="${f.id}">${esc(f.label)}</option>`).join("");
  const types = B.postTypes.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join("");
  const field = (r: Role, multi = false) => {
    const st = B.styles[r];
    const opt = r === "head" ? "" : " <small>(optioneel)</small>";
    return `<label>${esc(st.label)}${opt}<span class="hint">${esc(st.use)}</span>
      ${multi ? `<textarea name="${r}" rows="3" maxlength="${st.maxChars}"></textarea>` : `<input name="${r}" maxlength="${st.maxChars}">`}</label>`;
  };
  return `<div class="studio-app">
    <div class="st-bar">
      <button type="button" class="btn small" data-act="brief">Ik heb een post nodig over…</button>
      <button type="button" class="btn small ghost" data-act="undo" disabled>Ongedaan maken</button>
      <span class="st-badge" hidden></span>
      <span class="st-spacer"></span>
      <button type="button" class="btn small" data-act="png" disabled>Download PNG</button>
    </div>

    <div class="st-empty">
      <p>Nog geen post open. Begin met <strong>Ik heb een post nodig over…</strong> of open er een uit <strong>Mijn posts</strong>.</p>
    </div>

    <div class="st-work" hidden>
      <div class="st-canvas-wrap">
        <div class="st-canvas"></div>
        <ul class="st-issues"></ul>
      </div>
      <aside class="st-inspector" aria-label="Aanpassen"></aside>
    </div>

    <div class="st-variants-wrap" hidden>
      <div class="st-head-row"><h3>Kies een variant</h3><button type="button" class="btn small ghost" data-act="shuffle">Kleuren schudden</button></div>
      <div class="st-variants"></div>
    </div>

    <div class="st-library">
      <div class="st-head-row">
        <h3>Mijn posts</h3>
        <div class="st-lib-actions">
          <button type="button" class="btn small ghost" data-act="export">Bewaar als bestand</button>
          <label class="btn small ghost">Open bestand<input type="file" accept=".json,application/json" data-act="import" hidden></label>
        </div>
      </div>
      <p class="st-storage"></p>
      <div class="st-posts"></div>
    </div>

    <dialog class="st-brief" aria-labelledby="brief-title">
      <form method="dialog" class="brief-form" autocomplete="off">
        <div class="brief-top"><h3 id="brief-title">Waar gaat de post over?</h3><button type="button" class="link" data-act="close">Sluiten</button></div>
        <p class="brief-intro">Geef de woorden, de studio legt ze op een paar manieren op. Alleen met de fonts, kleuren en logo's van ${esc(brand.name)}. Hij ordent wat jij schrijft, hij schrijft niet voor je. Kies er één en stem hem af.</p>
        <div class="brief-grid">
          <label>Soort post<select name="type">${types}</select></label>
          <label>Formaat<select name="format">${formats}</select></label>
        </div>
        <details class="paste">
          <summary>Heb je al een tekst? Plak hem hier</summary>
          <textarea name="paste" rows="4" placeholder="Bijvoorbeeld een stuk uit de nieuwsbrief of WhatsApp"></textarea>
          <button type="button" class="btn small ghost" data-act="split">Verdeel over de velden</button>
        </details>
        ${field("kicker")}${field("head")}${field("sub")}${field("details", true)}${field("cta")}
        <label>Jouw foto <small>(optioneel)</small><input type="file" name="photo" accept="image/*"></label>
        <p class="brief-warn" role="alert"></p>
        <div class="brief-actions">
          <button type="button" class="btn small dark" data-act="layout">Leg het op</button>
          <button type="button" class="btn small ghost" data-act="shuffle-brief">Kleuren schudden</button>
          <button type="button" class="btn small ghost" data-act="blank">Leeg beginnen</button>
        </div>
      </form>
    </dialog>
  </div>`;
}

// ---------- Briefing ----------
let briefPhoto: PostDoc["photo"] = null;

function fillBrief(d: PostDoc | null) {
  const form = $<HTMLFormElement>(".brief-form");
  const src = d ?? newDoc();
  (form.elements.namedItem("type") as HTMLSelectElement).value = src.type;
  (form.elements.namedItem("format") as HTMLSelectElement).value = src.format;
  ROLES.forEach((r) => ((form.elements.namedItem(r) as HTMLInputElement).value = d ? src.fields[r] : ""));
  ROLES.forEach((r) => ((form.elements.namedItem(r) as HTMLInputElement).placeholder = newDoc(src.type).fields[r] || ""));
  briefPhoto = d?.photo ?? null;
  $(".brief-warn").textContent = "";
}

export function openBriefing() {
  document.querySelector("#studio")?.scrollIntoView({ behavior: "smooth" });
  fillBrief(S.doc);
  $<HTMLDialogElement>(".st-brief").showModal();
}

function readBrief(): PostDoc {
  const form = $<HTMLFormElement>(".brief-form");
  const v = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;
  const d = newDoc(v("type"));
  d.format = v("format");
  ROLES.forEach((r) => (d.fields[r] = enforce(r, v(r).trim())));
  d.photo = briefPhoto ? { ...briefPhoto } : null;
  if (S.doc) d.id = S.doc.id; // briefing opnieuw = dezelfde post bijwerken
  return d;
}

function layOut() {
  const d = readBrief();
  if (!d.fields.head) {
    $(".brief-warn").textContent = "Vul in elk geval de grote regel in.";
    return;
  }
  S.variants = makeVariants(d);
  $<HTMLDialogElement>(".st-brief").close();
  renderVariants();
}

// ---------- Varianten ----------
function renderVariants() {
  const wrap = $(".st-variants-wrap");
  wrap.hidden = S.variants.length === 0;
  // Meet alle kandidaten buiten beeld en houd de eerste zes die passen.
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;left:-99999px;top:0";
  document.body.append(probe);
  const fitting: PostDoc[] = [];
  const failing: PostDoc[] = [];
  for (const v of S.variants) {
    if (fitting.length >= 6) break;
    const holder = document.createElement("div");
    probe.append(holder);
    (mount(holder, v, 200).ok ? fitting : failing).push(v);
  }
  probe.remove();
  S.variants = [...fitting, ...failing].slice(0, 6);
  const list = $(".st-variants");
  list.innerHTML = S.variants
    .map((v, i) => `<button type="button" class="st-var" data-i="${i}"><div class="st-thumb"></div><span>${esc(layoutOf(v).label)} · ${esc(themeOf(v).label)}</span></button>`)
    .join("");
  requestAnimationFrame(() =>
    list.querySelectorAll<HTMLElement>(".st-var").forEach((b, i) => {
      const { ok } = mount($(".st-thumb", b), S.variants[i], b.clientWidth || 160);
      b.classList.toggle("bad", !ok);
    }),
  );
  wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function pickVariant(i: number) {
  S.doc = structuredClone(S.variants[i]);
  S.history = [];
  S.sel = null;
  S.variants = [];
  $(".st-variants-wrap").hidden = true;
  snapshot();
  persist();
  renderEditor();
}

// ---------- Editor ----------
let view: { post: HTMLElement; scale: number } | null = null;

function renderCanvas() {
  const d = S.doc!;
  const canvas = $(".st-canvas");
  const width = Math.min(canvas.parentElement!.clientWidth, 560);
  const { post, ok, scale } = mount(canvas, d, width, true);
  view = { post, scale };
  S.issues = check(post, d, ok);
  if (S.sel) post.querySelector(`[data-role="${S.sel}"]`)?.classList.add("sel");
  const badge = $(".st-badge");
  badge.hidden = false;
  badge.className = "st-badge " + (S.issues.length ? "off" : "on");
  badge.textContent = S.issues.length ? `Niet on brand (${S.issues.length})` : "On brand ✓";
  $(".st-issues").innerHTML = S.issues.map((x) => `<li>${esc(x.msg)}</li>`).join("");
  $<HTMLButtonElement>("[data-act=png]").disabled = S.issues.length > 0;
  $<HTMLButtonElement>("[data-act=undo]").disabled = S.history.length < 2;
}

function renderEditor() {
  const has = !!S.doc;
  $(".st-work").hidden = !has;
  $(".st-empty").hidden = has;
  if (!has) return;
  renderCanvas();
  renderInspector();
}

function update(mut: (d: PostDoc) => void, opts: { history?: boolean; inspector?: boolean } = {}) {
  if (!S.doc) return;
  mut(S.doc);
  if (opts.history !== false) snapshot();
  renderCanvas();
  if (opts.inspector) renderInspector();
  persist();
}

function inspectorPost(d: PostDoc) {
  const f = fmt(d.format);
  const pool = f.layouts.filter((l) => (d.photo ? !!l.photo : !l.photo));
  return `<h4>Post</h4>
    <p class="ins-tip">Klik op een tekst of de foto om hem aan te passen.</p>
    <div class="ins-block"><span class="ins-label">Layout</span>
      <div class="pills">${pool.map((l) => `<button type="button" class="pill${l.id === d.layout ? " on" : ""}" data-layout="${l.id}">${esc(l.label)}</button>`).join("")}</div>
    </div>
    <div class="ins-block"><span class="ins-label">Kleur</span>
      <div class="pills">${B.themes.map((t) => `<button type="button" class="pill theme${t.id === d.theme ? " on" : ""}" data-theme="${t.id}"><i style="background:${color(t.bg).hex}"></i>${esc(t.label)}</button>`).join("")}</div>
    </div>
    <div class="ins-block"><span class="ins-label">Foto</span>
      <label class="btn small ghost">${d.photo ? "Andere foto" : "Foto toevoegen"}<input type="file" accept="image/*" data-act="photo" hidden></label>
      ${d.photo ? `<button type="button" class="link" data-act="nophoto">Foto weghalen</button>` : ""}
    </div>
    <div class="ins-block"><button type="button" class="link" data-act="reset">Alles terug naar standaard</button></div>`;
}

function inspectorPhoto(d: PostDoc) {
  if (!d.photo) return inspectorPost(d);
  return `<h4>Foto</h4>
    <p class="ins-tip">Sleep in de foto om hem te verschuiven binnen zijn kader.</p>
    <label class="ins-block"><span class="ins-label">Inzoomen</span><input type="range" min="1" max="2.5" step="0.05" value="${d.photo.zoom}" data-act="zoom"></label>
    <div class="ins-block"><label class="btn small ghost">Andere foto<input type="file" accept="image/*" data-act="photo" hidden></label>
      <button type="button" class="link" data-act="photoreset">Midden</button></div>
    <div class="ins-block"><button type="button" class="link" data-act="deselect">Terug naar post</button></div>`;
}

function inspectorText(d: PostDoc, r: Role) {
  const st = B.styles[r];
  const t = themeOf(d);
  const o = d.overrides[r] ?? {};
  const n = wordCount(d.fields[r]);
  const cur = o.color ?? defaultColor(r, t);
  const colors = allowedColors(r, t);
  return `<h4>${esc(st.label)}</h4>
    <label class="ins-block"><span class="ins-label">Woorden</span>
      <textarea rows="${r === "details" ? 4 : 2}" data-act="text" maxlength="${st.maxChars}">${esc(d.fields[r])}</textarea></label>
    <div class="ins-block"><span class="ins-label">Stijl</span>
      <div class="styles">${ROLES.filter((x) => d.fields[x]?.trim() || x === r)
        .map((x) => {
          const s = B.styles[x];
          return `<button type="button" class="style-opt${x === r ? " on" : ""}" data-select="${x}" style="font-family:${s.font === "heading" ? "var(--font-heading)" : "var(--font-body)"};font-weight:${s.weight}">${esc(s.label)}<small>${esc(s.use)}</small></button>`;
        })
        .join("")}</div>
      <div class="rules-card"><ul>${st.rules.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <p class="count${n > st.maxWords ? " over" : ""}">${n} van ${st.maxWords} woorden</p></div>
    </div>
    <div class="ins-block"><span class="ins-label">Grootte</span>
      <div class="pills"><button type="button" class="pill${!o.size ? " on" : ""}" data-size="">Auto</button>${B.typeSteps
        .map(([id, label]) => `<button type="button" class="pill${o.size === id ? " on" : ""}" data-size="${id}" ${st.sizes.includes(id) ? "" : "disabled"}>${label}</button>`)
        .join("")}</div></div>
    <div class="ins-block"><span class="ins-label">Kleur op ${esc(color(t.bg).name.toLowerCase())}</span>
      <div class="dots">${colors
        .map((c) => `<button type="button" class="dot${c.id === cur ? " on" : ""}" data-color="${c.id}" style="background:${c.hex}" ${c.ok ? "" : "disabled"} title="${esc(c.name)}${c.ok ? "" : " (mag niet op deze achtergrond)"}"><span>${esc(c.name)}</span></button>`)
        .join("")}</div></div>
    <div class="ins-block"><span class="ins-label">Uitlijning</span>
      <div class="pills">${(["left", "center", "right"] as const)
        .map((a) => `<button type="button" class="pill${(o.align ?? "left") === a ? " on" : ""}" data-align="${a}" ${ALIGN.includes(a) ? "" : "disabled"}>${{ left: "Links", center: "Midden", right: "Rechts" }[a]}</button>`)
        .join("")}</div>
      ${ALIGN.length === 1 ? `<p class="ins-note">${esc(brand.name)} lijnt tekst altijd links uit.</p>` : ""}</div>
    <div class="ins-block"><button type="button" class="link" data-act="place">Terug naar vaste plek</button> · <button type="button" class="link" data-act="deselect">Terug naar post</button></div>`;
}

function renderInspector() {
  const d = S.doc!;
  const ins = $(".st-inspector");
  ins.innerHTML = S.sel === "photo" ? inspectorPhoto(d) : S.sel ? inspectorText(d, S.sel) : inspectorPost(d);
}

function select(sel: Sel) {
  S.sel = sel;
  renderCanvas();
  renderInspector();
}

// ---------- Slepen op het canvas ----------
function wireCanvas() {
  const canvas = $(".st-canvas");
  let drag: { role: Sel; x: number; y: number; start: { dx: number; dy: number; px: number; py: number }; moved: boolean } | null = null;

  canvas.addEventListener("pointerdown", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-role]");
    const role = (target?.dataset.role ?? null) as Sel;
    if (!S.doc || !view) return;
    if (role !== S.sel) select(role);
    if (!role || (role === "photo" && !S.doc.photo)) return;
    const o = role === "photo" ? {} : S.doc.overrides[role] ?? {};
    drag = { role, x: e.clientX, y: e.clientY, start: { dx: o.dx ?? 0, dy: o.dy ?? 0, px: S.doc.photo?.x ?? 50, py: S.doc.photo?.y ?? 50 }, moved: false };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drag || !S.doc || !view) return;
    const dx = (e.clientX - drag.x) / view.scale;
    const dy = (e.clientY - drag.y) / view.scale;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    if (!drag.moved) return;
    const d = S.doc;
    if (drag.role === "photo" && d.photo) {
      const L = layoutOf(d).photo!;
      d.photo.x = Math.max(0, Math.min(100, drag.start.px - (dx / L.w) * 100));
      d.photo.y = Math.max(0, Math.min(100, drag.start.py - (dy / L.h) * 100));
      const img = view.post.querySelector<HTMLImageElement>(".p-photo img")!;
      img.style.objectPosition = `${d.photo.x}% ${d.photo.y}%`;
      img.style.transformOrigin = `${d.photo.x}% ${d.photo.y}%`;
    } else if (drag.role && drag.role !== "photo") {
      const o = (d.overrides[drag.role] ??= {});
      o.dx = Math.round(drag.start.dx + dx);
      o.dy = Math.round(drag.start.dy + dy);
      view.post.querySelector<HTMLElement>(`[data-role="${drag.role}"]`)!.style.transform = `translate(${o.dx}px,${o.dy}px)`;
    }
  });

  const end = () => {
    if (drag?.moved) update(() => undefined);
    drag = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}

// ---------- Mijn posts ----------
async function renderLibrary() {
  const posts = await listPosts();
  $(".st-storage").textContent = storage.persistent
    ? `${posts.length} ${posts.length === 1 ? "post" : "posts"} bewaard in deze browser. Wil je verder op een andere computer? Kies Bewaar als bestand.`
    : "Let op: deze browser bewaart niets (privévenster?). Kies Bewaar als bestand voordat je de pagina sluit.";
  const list = $(".st-posts");
  list.innerHTML = posts.length
    ? posts
        .map(
          (p) => `<article class="st-post${S.doc?.id === p.id ? " on" : ""}" data-id="${p.id}">
            <button type="button" class="st-thumb-btn" data-open="${p.id}" aria-label="Open ${esc(p.fields.head)}"><div class="st-thumb"></div></button>
            <p class="t">${esc(p.fields.head || "Zonder kop")}</p>
            <p class="m">${new Date(p.updated).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })}</p>
            <div class="a"><button type="button" class="link" data-open="${p.id}">Openen</button><button type="button" class="link" data-copy="${p.id}">Kopie</button><button type="button" class="link danger" data-del="${p.id}">Verwijder</button></div>
          </article>`,
        )
        .join("")
    : `<p class="st-none">Nog geen posts bewaard.</p>`;
  requestAnimationFrame(() =>
    list.querySelectorAll<HTMLElement>(".st-post").forEach((el) => {
      const p = posts.find((x) => x.id === el.dataset.id)!;
      mount($(".st-thumb", el), p, el.clientWidth || 150);
    }),
  );
  cache = posts;
}
let cache: PostDoc[] = [];

function openPost(d: PostDoc) {
  S.doc = structuredClone(d);
  S.history = [];
  S.sel = null;
  snapshot();
  renderEditor();
  renderLibrary();
  $(".st-work").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Foto inlezen ----------
function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Verkleinen naar max 2000 px: genoeg voor 1080 breed, en houdt de opslag klein.
      const max = 2000;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ---------- Koppelen ----------
export function mountStudio(root: HTMLElement) {
  wireCanvas();
  const dialog = $<HTMLDialogElement>(".st-brief");

  root.addEventListener("click", async (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("button, [data-i]");
    if (!el || (el as HTMLButtonElement).disabled) return;
    const act = el.dataset.act;
    const d = S.doc;
    if (act === "brief") return openBriefing();
    if (act === "close") return dialog.close();
    if (act === "layout") return layOut();
    if (act === "blank") {
      S.doc = null;
      briefPhoto = null;
      fillBrief(null);
      renderEditor();
      return;
    }
    if (act === "split") {
      const form = $<HTMLFormElement>(".brief-form");
      const parts = splitPasted((form.elements.namedItem("paste") as HTMLTextAreaElement).value);
      ROLES.forEach((r) => ((form.elements.namedItem(r) as HTMLInputElement).value = enforce(r, parts[r] ?? "")));
      return;
    }
    if (act === "shuffle-brief" || act === "shuffle") {
      if (act === "shuffle-brief") return layOut();
      if (S.variants.length) {
        S.variants = makeVariants(S.variants[0], S.variants.map((v) => v.layout));
        renderVariants();
      }
      return;
    }
    if (el.classList.contains("st-var")) return pickVariant(Number(el.dataset.i));
    if (act === "undo" && S.history.length > 1) {
      S.history.pop();
      S.doc = JSON.parse(S.history[S.history.length - 1]);
      renderCanvas();
      renderInspector();
      persist();
      return;
    }
    if (act === "png" && d) {
      const { png, issues } = await renderPng(d);
      if (issues.length) return toast("Eerst de punten onder de post oplossen.");
      const a = document.createElement("a");
      a.href = png;
      a.download = fileSlug(d) + ".png";
      a.click();
      return;
    }
    if (act === "export") return downloadFile(await listPosts());
    if (el.dataset.open) return openPost(cache.find((p) => p.id === el.dataset.open)!);
    if (el.dataset.copy) {
      const p = structuredClone(cache.find((x) => x.id === el.dataset.copy)!);
      p.id = newDoc().id;
      p.created = new Date().toISOString();
      await savePost(p);
      return openPost(p);
    }
    if (el.dataset.del) {
      if (!confirm("Deze post verwijderen? Dit kan niet ongedaan worden.")) return;
      await deletePost(el.dataset.del);
      if (S.doc?.id === el.dataset.del) {
        S.doc = null;
        renderEditor();
      }
      return renderLibrary();
    }
    if (!d) return;
    // Inspectie-acties
    if (el.dataset.select) return select(el.dataset.select as Role);
    if (act === "deselect") return select(null);
    if (el.dataset.layout) return update((x) => ((x.layout = el.dataset.layout!), (x.overrides = {})), { inspector: true });
    if (el.dataset.theme) return update((x) => ((x.theme = el.dataset.theme!), ROLES.forEach((r) => delete x.overrides[r]?.color)), { inspector: true });
    if (act === "reset") return update((x) => (x.overrides = {}), { inspector: true });
    if (act === "nophoto") return update((x) => ((x.photo = null), (x.layout = fmt(x.format).layouts.find((l) => !l.photo)!.id), (x.overrides = {})), { inspector: true });
    if (act === "photoreset") return update((x) => x.photo && Object.assign(x.photo, { x: 50, y: 50, zoom: 1 }), { inspector: true });
    const r = S.sel as Role;
    if (!r || r === ("photo" as Role)) return;
    if (el.dataset.size !== undefined) return update((x) => ((x.overrides[r] ??= {}).size = el.dataset.size || undefined), { inspector: true });
    if (el.dataset.color) return update((x) => ((x.overrides[r] ??= {}).color = el.dataset.color), { inspector: true });
    if (el.dataset.align) return update((x) => ((x.overrides[r] ??= {}).align = el.dataset.align as "left"), { inspector: true });
    if (act === "place") return update((x) => x.overrides[r] && (delete x.overrides[r]!.dx, delete x.overrides[r]!.dy), { inspector: true });
  });

  root.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (!S.doc) return;
    if (t.dataset.act === "text" && S.sel && S.sel !== "photo") {
      const r = S.sel;
      const fixed = enforce(r, t.value);
      if (fixed !== t.value) t.value = fixed;
      update((x) => (x.fields[r] = fixed), { history: false });
      const n = wordCount(fixed);
      const cnt = $(".rules-card .count");
      cnt.textContent = `${n} van ${B.styles[r].maxWords} woorden`;
      cnt.classList.toggle("over", n > B.styles[r].maxWords);
    }
    if (t.dataset.act === "zoom") update((x) => x.photo && (x.photo.zoom = Number(t.value)), { history: false });
  });
  root.addEventListener("change", async (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.act === "text" || t.dataset.act === "zoom") snapshot();
    if (t.dataset.act === "photo" && t.files?.[0]) {
      const src = await readPhoto(t.files[0]);
      update((x) => {
        x.photo = { src, x: 50, y: 50, zoom: 1 };
        if (!layoutOf(x).photo) x.layout = fmt(x.format).layouts.find((l) => l.photo)!.id;
      }, { inspector: true });
    }
    if (t.name === "photo" && t.closest(".brief-form") && t.files?.[0]) briefPhoto = { src: await readPhoto(t.files[0]), x: 50, y: 50, zoom: 1 };
    if (t.dataset.act === "import" && t.files?.[0]) {
      try {
        const n = await importFile(t.files[0]);
        toast(`${n} ${n === 1 ? "post" : "posts"} geopend`);
        renderLibrary();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Dit bestand kan ik niet lezen.");
      }
      t.value = "";
    }
    if (t.closest(".brief-form") && t.name === "type") fillBriefPlaceholders(t.value);
  });

  let rt = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => S.doc && renderCanvas(), 150);
  });

  renderLibrary().then(async () => {
    // Laatst bewerkte post weer openen.
    if (cache[0]) openPostQuiet(cache[0]);
  });
}

function openPostQuiet(d: PostDoc) {
  S.doc = structuredClone(d);
  S.history = [];
  snapshot();
  renderEditor();
}

function fillBriefPlaceholders(type: string) {
  const form = $<HTMLFormElement>(".brief-form");
  const ex = newDoc(type).fields;
  ROLES.forEach((r) => ((form.elements.namedItem(r) as HTMLInputElement).placeholder = ex[r] || ""));
}
