// Studio-interface: briefing, varianten, editor met inspectiepaneel, Mijn posts.
import { brand, color } from "../brand";
import {
  B, ROLES, allowedColors, defaultColor, enforce, fmt, layoutOf, layoutsFor, makeVariants, newDoc, rollMark, splitPasted, stepLabel, themeOf, wordCount,
  type PostDoc, type Role,
} from "./model";
import { check, fileSlug, fit, postHtml, renderPng, type Issue } from "./render";
import { postMarks } from "../logos";
import { bankAvailable, bankDelete, bankList, bankUpload, bufferChannels, bufferSend, deletePost, downloadFile, importFile, initStorage, listPosts, login, logout, savePost, storage, type BankPhoto, type BufferChannel, type BufferTarget } from "./store";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const ALIGN = ((brand as unknown as { align?: string[] }).align ?? ["left"]) as ("left" | "center" | "right")[];

type Sel = Role | "photo" | "photo2" | null;
type PhotoKey = "photo" | "photo2";
const isPhoto = (x: unknown): x is PhotoKey => x === "photo" || x === "photo2";
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
    const sent = S.doc.photo?.src;
    const sent2 = S.doc.photo2?.src;
    try {
      const saved = await savePost(structuredClone(S.doc));
      // Op de server wordt een geüploade foto een link: die overnemen, dan gaat hij maar één keer mee.
      if (S.doc?.id === saved.id && S.doc.photo && saved.photo && S.doc.photo.src === sent) S.doc.photo.src = saved.photo.src;
      if (S.doc?.id === saved.id && S.doc.photo2 && saved.photo2 && S.doc.photo2.src === sent2) S.doc.photo2.src = saved.photo2.src;
      $(".st-saved").textContent = `Bewaard ${new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`;
    } catch (err) {
      toast(err instanceof Error ? `Niet opgeslagen: ${err.message}` : "Niet opgeslagen.");
      if (storage.mode === "server" && !storage.loggedIn) showLogin();
      return;
    }
    renderLibrary();
  }, 400);
}

function snapshot() {
  if (!S.doc) return;
  const snap = JSON.stringify(S.doc);
  if (S.history[S.history.length - 1] !== snap) S.history.push(snap);
  if (S.history.length > 60) S.history.shift();
}

// ---------- Datum en vaste woorden ----------
type Picker = { date?: boolean; presets?: string[] };
const pickers = () => (brand as unknown as { pickers?: Partial<Record<Role, Picker>> }).pickers ?? {};

/** "2026-06-21" -> "Zaterdag 21 juni" */
export function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return "";
  const s = d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Kalender en knoppen onder een veld. "where" = brief (formulier) of ins (editor). */
function pickerHtml(r: Role, where: "brief" | "ins") {
  const p = pickers()[r];
  if (!p) return "";
  return `<div class="pickers">
    ${p.date ? `<label class="pick-date" title="Kies een datum"><span>Datum kiezen</span><input type="date" data-pick-date="${r}" data-where="${where}"></label>` : ""}
    ${(p.presets ?? []).map((w) => `<button type="button" class="chip" data-preset="${esc(w)}" data-role="${r}" data-where="${where}">${esc(w)}</button>`).join("")}
  </div>`;
}

/** Zet een gekozen waarde in het juiste veld (formulier of open post). */
function applyPick(r: Role, where: string, value: string) {
  if (where === "brief") {
    const input = $<HTMLFormElement>(".brief-form").elements.namedItem(r) as HTMLInputElement;
    input.value = value;
    return;
  }
  if (!S.doc) return;
  update((x) => (x.fields[r] = value), { inspector: true });
}

// ---------- HTML ----------
export function studioHtml() {
  const formats = B.formats.map((f) => `<option value="${f.id}">${esc(f.label)}</option>`).join("");
  const types = B.postTypes.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join("");
  const field = (r: Role, multi = false) => {
    const st = B.styles[r];
    const opt = r === "head" ? "" : " <small>(optioneel)</small>";
    return `<label>${esc(st.label)}${opt}<span class="hint">${esc(st.use)}</span>
      ${multi ? `<textarea name="${r}" rows="3" maxlength="${st.maxChars}"></textarea>` : `<input name="${r}" maxlength="${st.maxChars}">`}</label>${pickerHtml(r, "brief")}`;
  };
  return `<div class="studio-app">
    <div class="st-bar">
      <button type="button" class="btn small" data-act="brief">Nieuwe post</button>
      <button type="button" class="btn small ghost" data-act="rebrief" hidden>Tekst en foto aanpassen</button>
      <button type="button" class="btn small ghost" data-act="undo" disabled>Ongedaan maken</button>
      <span class="st-badge" hidden></span>
      <span class="st-saved" aria-live="polite"></span>
      <span class="st-spacer"></span>
      <button type="button" class="btn small" data-act="png" disabled>Download PNG</button>
    </div>

    <div class="st-empty">
      <p>Nog geen post open. Klik op <strong>Nieuwe post</strong>, of kies <strong>Bewerken</strong> bij een post in <strong>Mijn posts</strong>.</p>
    </div>

    <div class="st-work" hidden>
      <div class="st-canvas-wrap">
        <div class="st-canvas"></div>
        <ul class="st-issues"></ul>
        <div class="st-dl-row">
          <button type="button" class="btn st-dl-big" data-act="png" disabled>Download PNG</button>
          <button type="button" class="btn st-buffer" data-act="buffer" hidden>Naar Buffer</button>
        </div>
      </div>
      <aside class="st-inspector" aria-label="Aanpassen"></aside>
    </div>

    <div class="st-variants-wrap" hidden>
      <div class="st-head-row"><h3>Kies een variant</h3><button type="button" class="btn small ghost" data-act="shuffle">Kleuren schudden</button></div>
      <div class="st-variants"></div>
    </div>

    <form class="st-login" hidden autocomplete="on">
      <h3>Inloggen</h3>
      <p>De studio bewaart posts en foto's op de server. Vul de toegangscode in die je van ${esc(brand.name)} of Patrick hebt gekregen.</p>
      <label>Toegangscode<input type="password" name="code" autocomplete="current-password" required></label>
      <p class="st-login-err" role="alert"></p>
      <button type="submit" class="btn small">Inloggen</button>
    </form>

    <div class="st-library">
      <div class="st-head-row">
        <h3>Mijn posts</h3>
        <div class="st-lib-actions">
          <button type="button" class="link" data-act="export" title="Alle posts met foto's in één bestand, om te bewaren of op een andere computer te openen. Dit is geen afbeelding.">Back-up van alle posts (.json)</button>
          <label class="link" title="Een eerder gemaakte back-up (.json) weer openen">Back-up terugzetten<input type="file" accept=".json,application/json" data-act="import" hidden></label>
          <button type="button" class="link" data-act="logout" hidden>Uitloggen</button>
        </div>
      </div>
      <p class="st-storage"></p>
      <div class="st-posts"></div>
    </div>

    <dialog class="buffer-dlg" aria-labelledby="buffer-title">
      <div class="buffer-in">
        <div class="brief-top"><h3 id="buffer-title">Naar Buffer</h3><button type="button" class="link" data-act="buffer-close">Sluiten</button></div>
        <p class="brief-intro">De post gaat als <strong>concept</strong> naar Buffer. Daar keur je hem goed en plan je hem in. Er gaat niets vanzelf online.</p>
        <div class="buffer-previews"></div>
        <label class="buffer-caption">Tekst bij de post<textarea rows="5" maxlength="2200" data-buffer-caption></textarea></label>
        <fieldset class="buffer-targets"><legend>Waarheen?</legend><div data-buffer-targets></div></fieldset>
        <p class="buffer-msg" role="status"></p>
        <div class="brief-actions"><button type="button" class="btn small dark" data-act="buffer-send">Als concept naar Buffer</button></div>
      </div>
    </dialog>

    <dialog class="bank-pick" aria-labelledby="bank-pick-title">
      <div class="bank-pick-in">
        <div class="brief-top"><h3 id="bank-pick-title">Kies een foto</h3><button type="button" class="link" data-act="bank-pick-close">Sluiten</button></div>
        <div class="bank-grid" data-pick-grid></div>
      </div>
    </dialog>

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
        <label>Tekst bij de post <small>(optioneel, voor Instagram/Facebook)</small><span class="hint">De tekst onder de afbeelding, met hashtags</span>
          <textarea name="caption" rows="3" maxlength="2200"></textarea></label>
        <div class="brief-grid">
          <div class="brief-photo"><label>Foto 1 <small>(groot, optioneel)</small><input type="file" name="photo" accept="image/*"></label>
            <button type="button" class="link bank-only" data-act="bank-brief" data-key="photo">Uit fotobank</button> <span class="picked" data-picked="photo"></span></div>
          <div class="brief-photo"><label>Foto 2 <small>(klein, optioneel)</small><input type="file" name="photo2" accept="image/*"></label>
            <button type="button" class="link bank-only" data-act="bank-brief" data-key="photo2">Uit fotobank</button> <span class="picked" data-picked="photo2"></span></div>
        </div>
        <p class="brief-warn" role="alert"></p>
        <div class="brief-actions">
          <button type="button" class="btn small dark" data-act="layout">Leg het op</button>
          <button type="button" class="btn small ghost" data-act="shuffle-brief">Kleuren schudden</button>
          <button type="button" class="btn small ghost" data-act="blank">Velden leegmaken</button>
        </div>
      </form>
    </dialog>
  </div>`;
}

// ---------- Briefing ----------
let briefPhoto: PostDoc["photo"] = null;
let briefPhoto2: PostDoc["photo"] = null;

function fillBrief(d: PostDoc | null) {
  const form = $<HTMLFormElement>(".brief-form");
  const src = d ?? newDoc();
  (form.elements.namedItem("type") as HTMLSelectElement).value = src.type;
  (form.elements.namedItem("format") as HTMLSelectElement).value = src.format;
  ROLES.forEach((r) => ((form.elements.namedItem(r) as HTMLInputElement).value = d ? src.fields[r] : ""));
  (form.elements.namedItem("caption") as HTMLTextAreaElement).value = d?.caption ?? "";
  ROLES.forEach((r) => ((form.elements.namedItem(r) as HTMLInputElement).placeholder = newDoc(src.type).fields[r] || ""));
  briefPhoto = d?.photo ?? null;
  briefPhoto2 = d?.photo2 ?? null;
  document.querySelectorAll<HTMLElement>("[data-picked]").forEach((e) => (e.textContent = ""));
  document.querySelectorAll<HTMLElement>(".bank-only").forEach((e) => (e.hidden = !bankAvailable()));
  $(".brief-warn").textContent = "";
}

/** "new": altijd een nieuwe post (de open post blijft bewaard). "edit": de open post aanpassen. */
let briefMode: "new" | "edit" = "new";

export function openBriefing(mode: "new" | "edit" = "new") {
  briefMode = mode === "edit" && S.doc ? "edit" : "new";
  document.querySelector("#studio")?.scrollIntoView({ behavior: "smooth" });
  fillBrief(briefMode === "edit" ? S.doc : null);
  $("#brief-title").textContent = briefMode === "edit" ? "Post aanpassen" : "Waar gaat de post over?";
  $<HTMLDialogElement>(".st-brief").showModal();
}

function readBrief(): PostDoc {
  const form = $<HTMLFormElement>(".brief-form");
  const v = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;
  const d = newDoc(v("type"));
  d.format = v("format");
  ROLES.forEach((r) => (d.fields[r] = enforce(r, v(r).trim())));
  d.photo = briefPhoto ? { ...briefPhoto } : null;
  // Alleen foto 2 gekozen? Dan wordt die de grote foto.
  if (!d.photo && briefPhoto2) d.photo = { ...briefPhoto2 };
  else d.photo2 = briefPhoto2 ? { ...briefPhoto2 } : null;
  d.caption = v("caption").trim();
  if (briefMode === "edit" && S.doc) {
    // Aanpassen: dezelfde post bijwerken. Nieuw: nieuw id, de vorige post blijft staan.
    d.id = S.doc.id;
    d.created = S.doc.created;
    d.mark = S.doc.mark;
  }
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
  toast(briefMode === "edit" ? "Post aangepast. Hij staat in Mijn posts." : "Nieuwe post bewaard in Mijn posts.");
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
  document.querySelectorAll<HTMLButtonElement>("[data-act=png]").forEach((b) => (b.disabled = S.issues.length > 0));
  $<HTMLButtonElement>("[data-act=undo]").disabled = S.history.length < 2;
}

function renderEditor() {
  const has = !!S.doc;
  $(".st-work").hidden = !has;
  $(".st-empty").hidden = has;
  $("[data-act=rebrief]").hidden = !has;
  if (!has) $(".st-saved").textContent = "";
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
  const pool = layoutsFor(d);
  void f;
  return `<h4>Post</h4>
    <p class="ins-tip">Klik op een tekst of de foto om hem aan te passen.</p>
    <div class="ins-block"><span class="ins-label">Layout</span>
      <div class="pills">${pool.map((l) => `<button type="button" class="pill${l.id === d.layout ? " on" : ""}" data-layout="${l.id}">${esc(l.label)}</button>`).join("")}</div>
    </div>
    <div class="ins-block"><span class="ins-label">Kleur</span>
      <div class="pills">${B.themes.map((t) => `<button type="button" class="pill theme${t.id === d.theme ? " on" : ""}" data-theme="${t.id}"><i style="background:${color(t.bg).hex}"></i>${esc(t.label)}</button>`).join("")}</div>
    </div>
    ${postMarks().length < 2 ? "" : `<div class="ins-block"><span class="ins-label">Merkteken</span>
      <div class="pills">${postMarks().map((m) => `<button type="button" class="pill${(d.mark ?? postMarks()[0].id) === m.id ? " on" : ""}" data-mark="${m.id}">${esc(m.label)}</button>`).join("")}</div>
    </div>`}
    ${(brand as unknown as { markVariation?: unknown }).markVariation ? `<div class="ins-block"><span class="ins-label">Stempel</span>
      <div><button type="button" class="btn small ghost" data-act="remark">Stempel anders</button></div>
      <p class="ins-note">Kiest een nieuwe stand: meer of minder over de foto, recht of gedraaid.</p>
    </div>` : ""}
    <div class="ins-block"><span class="ins-label">Foto's</span>
      <label class="btn small ghost">${d.photo ? "Andere foto 1" : "Foto toevoegen"}<input type="file" accept="image/*" data-act="photo" hidden></label>
      ${d.photo ? `<label class="btn small ghost">${d.photo2 ? "Andere foto 2" : "Tweede foto toevoegen"}<input type="file" accept="image/*" data-act="photo2" hidden></label>` : ""}
      ${bankAvailable() ? `<button type="button" class="link" data-act="bank-ins" data-key="photo">${d.photo ? "Foto 1 uit fotobank" : "Foto uit fotobank"}</button>` : ""}
      ${bankAvailable() && d.photo ? `<button type="button" class="link" data-act="bank-ins" data-key="photo2">Foto 2 uit fotobank</button>` : ""}
      ${d.photo2 ? `<button type="button" class="link" data-act="nophoto2">Foto 2 weghalen</button>` : ""}
      ${d.photo ? `<button type="button" class="link" data-act="nophoto">Alle foto's weghalen</button>` : ""}
    </div>
    <div class="ins-block"><button type="button" class="link" data-act="reset">Alles terug naar standaard</button></div>`;
}

function inspectorPhoto(d: PostDoc, key: PhotoKey) {
  const ph = d[key];
  if (!ph) return inspectorPost(d);
  return `<h4>${layoutOf(d).photo2 ? (key === "photo" ? "Foto 1" : "Foto 2") : "Foto"}</h4>
    <p class="ins-tip">Sleep in de foto om hem te verschuiven binnen zijn kader.</p>
    <label class="ins-block"><span class="ins-label">Inzoomen</span><input type="range" min="1" max="2.5" step="0.05" value="${ph.zoom}" data-act="zoom"></label>
    <div class="ins-block"><label class="btn small ghost">Andere foto<input type="file" accept="image/*" data-act="${key}" hidden></label>
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
    ${pickerHtml(r, "ins")}
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
  ins.innerHTML = isPhoto(S.sel) ? inspectorPhoto(d, S.sel) : S.sel ? inspectorText(d, S.sel) : inspectorPost(d);
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
    if (!role || (isPhoto(role) && !S.doc[role])) return;
    const o = isPhoto(role) ? {} : S.doc.overrides[role] ?? {};
    const ph = isPhoto(role) ? S.doc[role] : null;
    drag = { role, x: e.clientX, y: e.clientY, start: { dx: o.dx ?? 0, dy: o.dy ?? 0, px: ph?.x ?? 50, py: ph?.y ?? 50 }, moved: false };
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
    if (isPhoto(drag.role) && d[drag.role]) {
      const ph = d[drag.role]!;
      const L = layoutOf(d)[drag.role]!;
      ph.x = Math.max(0, Math.min(100, drag.start.px - (dx / L.w) * 100));
      ph.y = Math.max(0, Math.min(100, drag.start.py - (dy / L.h) * 100));
      const img = view.post.querySelector<HTMLImageElement>(`[data-role="${drag.role}"] img`)!;
      img.style.objectPosition = `${ph.x}% ${ph.y}%`;
      img.style.transformOrigin = `${ph.x}% ${ph.y}%`;
    } else if (drag.role && !isPhoto(drag.role)) {
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
  let posts: PostDoc[] = [];
  try {
    posts = await listPosts();
  } catch (err) {
    toast(err instanceof Error ? err.message : "Posts ophalen mislukt.");
  }
  const n = `${posts.length} ${posts.length === 1 ? "post" : "posts"}`;
  $(".st-storage").textContent =
    storage.mode === "server"
      ? `${n} opgeslagen op de server. ${storage.open ? "Iedereen met dit adres" : "Iedereen met de toegangscode"} ziet en bewerkt dezelfde posts.`
      : storage.persistent
        ? `${n} bewaard in deze browser. Wil je verder op een andere computer? Maak een back-up van alle posts.`
        : "Let op: deze browser bewaart niets (privévenster?). Maak een back-up van alle posts voordat je de pagina sluit.";
  $("[data-act=logout]").hidden = storage.mode !== "server" || storage.open;
  const list = $(".st-posts");
  list.innerHTML = posts.length
    ? posts
        .map(
          (p) => `<article class="st-post${S.doc?.id === p.id ? " on" : ""}" data-id="${p.id}">
            <button type="button" class="st-thumb-btn" data-open="${p.id}" aria-label="Open ${esc(p.fields.head)}"><div class="st-thumb"></div></button>
            <p class="t">${esc(p.fields.head || "Zonder kop")}</p>
            <p class="m">${new Date(p.updated).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })}</p>
            <div class="a"><button type="button" class="link" data-open="${p.id}">Bewerken</button><button type="button" class="link" data-copy="${p.id}">Kopie maken</button><button type="button" class="link danger" data-del="${p.id}">Verwijderen</button></div>
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
function readPhoto(file: Blob): Promise<string> {
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

// ---------- PNG opslaan ----------
/**
 * Slaat de post op als echt PNG-bestand. Een losse data:-link wordt door sommige browsers
 * (Safari) niet als PNG bewaard; een Blob met type image/png wel. Op een telefoon opent het
 * deelmenu, zodat je hem direct in Foto's bewaart of naar Instagram/WhatsApp stuurt.
 */
async function savePng(dataUrl: string, name: string) {
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  const file = new File([bytes], name, { type: "image/png" });
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // gebruiker sloot het deelmenu
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.type = "image/png";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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
    if (act === "buffer" && d) return openBuffer(d);
    if (act === "buffer-close") return $<HTMLDialogElement>(".buffer-dlg").close();
    if (act === "buffer-send" && d) return sendBuffer(d, el as HTMLButtonElement);
    if (act === "bank-brief" || act === "bank-ins") {
      const key = el.dataset.key as PhotoKey;
      const picked = await pickFromBank();
      if (!picked) return;
      const ph = { src: picked.src, x: 50, y: 50, zoom: 1 };
      if (act === "bank-brief") {
        if (key === "photo") briefPhoto = ph;
        else briefPhoto2 = ph;
        $(`[data-picked="${key}"]`).textContent = `Gekozen: ${picked.name}`;
        return;
      }
      return update((x) => {
        x[key] = ph;
        if (!layoutsFor(x).some((l) => l.id === x.layout)) x.layout = layoutsFor(x)[0].id;
      }, { inspector: true });
    }
    if (el.dataset.preset) return applyPick(el.dataset.role as Role, el.dataset.where!, el.dataset.preset);
    if (act === "brief") return openBriefing("new");
    if (act === "rebrief") return openBriefing("edit");
    if (act === "close") return dialog.close();
    if (act === "layout") return layOut();
    if (act === "blank") {
      // Alleen de velden leegmaken. Bewaarde posts blijven staan.
      briefPhoto = null;
      briefPhoto2 = null;
      fillBrief(null);
      $<HTMLInputElement>(".brief-form input[name=photo]").value = "";
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
      const btn = el as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = "Bezig…";
      try {
        const { png, issues } = await renderPng(d);
        if (issues.length) return toast("Eerst de punten onder de post oplossen.");
        if (!png.startsWith("data:image/png")) throw new Error("geen PNG");
        await savePng(png, fileSlug(d) + ".png");
        toast("PNG gedownload.");
      } catch (err) {
        toast(`Downloaden mislukt: ${err instanceof Error ? err.message : "onbekende fout"}. Probeer het nog eens.`);
      } finally {
        btn.textContent = "Download PNG";
        btn.disabled = S.issues.length > 0;
      }
      return;
    }
    if (act === "export") return downloadFile(await listPosts());
    if (act === "logout") {
      await logout();
      S.doc = null;
      renderEditor();
      return showLogin();
    }
    if (el.dataset.open) return openPost(cache.find((p) => p.id === el.dataset.open)!);
    if (el.dataset.copy) {
      const p = structuredClone(cache.find((x) => x.id === el.dataset.copy)!);
      p.id = newDoc().id;
      p.created = new Date().toISOString();
      const saved = await savePost(p);
      toast("Kopie gemaakt. Je bewerkt nu de kopie, het origineel blijft staan.");
      return openPost(saved);
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
    if (act === "remark") return update((x) => Object.assign(x, rollMark()), { inspector: true });
    if (el.dataset.mark) return update((x) => (x.mark = el.dataset.mark), { inspector: true });
    if (el.dataset.layout) return update((x) => ((x.layout = el.dataset.layout!), (x.overrides = {})), { inspector: true });
    if (el.dataset.theme) return update((x) => ((x.theme = el.dataset.theme!), ROLES.forEach((r) => delete x.overrides[r]?.color)), { inspector: true });
    if (act === "reset") return update((x) => (x.overrides = {}), { inspector: true });
    if (act === "nophoto") return update((x) => ((x.photo = null), (x.photo2 = null), (x.layout = layoutsFor(x)[0].id), (x.overrides = {})), { inspector: true });
    if (act === "nophoto2") return update((x) => ((x.photo2 = null), (x.layout = layoutsFor(x)[0].id), (x.overrides = {})), { inspector: true });
    if (act === "photoreset") return update((x) => { const k = isPhoto(S.sel) ? S.sel : "photo"; if (x[k]) Object.assign(x[k]!, { x: 50, y: 50, zoom: 1 }); }, { inspector: true });
    const r = S.sel as Role;
    if (!r || isPhoto(r)) return;
    if (el.dataset.size !== undefined) return update((x) => ((x.overrides[r] ??= {}).size = el.dataset.size || undefined), { inspector: true });
    if (el.dataset.color) return update((x) => ((x.overrides[r] ??= {}).color = el.dataset.color), { inspector: true });
    if (el.dataset.align) return update((x) => ((x.overrides[r] ??= {}).align = el.dataset.align as "left"), { inspector: true });
    if (act === "place") return update((x) => x.overrides[r] && (delete x.overrides[r]!.dx, delete x.overrides[r]!.dy), { inspector: true });
  });

  root.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (!S.doc) return;
    if (t.dataset.act === "text" && S.sel && !isPhoto(S.sel)) {
      const r = S.sel;
      const fixed = enforce(r, t.value);
      if (fixed !== t.value) t.value = fixed;
      update((x) => (x.fields[r] = fixed), { history: false });
      const n = wordCount(fixed);
      const cnt = $(".rules-card .count");
      cnt.textContent = `${n} van ${B.styles[r].maxWords} woorden`;
      cnt.classList.toggle("over", n > B.styles[r].maxWords);
    }
    if (t.dataset.act === "zoom") {
      const k: PhotoKey = isPhoto(S.sel) ? S.sel : "photo";
      update((x) => x[k] && (x[k]!.zoom = Number(t.value)), { history: false });
    }
  });
  // Klik op "Datum kiezen" opent direct de kalender.
  root.addEventListener("click", (e) => {
    const lab = (e.target as HTMLElement).closest<HTMLElement>(".pick-date");
    const input = lab?.querySelector<HTMLInputElement>("input[type=date]");
    if (!input) return;
    try {
      input.showPicker();
      e.preventDefault();
    } catch {
      /* oudere browser: het veld zelf werkt ook */
    }
  });

  root.addEventListener("change", async (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.pickDate && t.value) {
      applyPick(t.dataset.pickDate as Role, t.dataset.where!, formatDate(t.value));
      t.value = "";
      return;
    }
    if (t.dataset.act === "text" || t.dataset.act === "zoom") snapshot();
    if (isPhoto(t.dataset.act) && t.files?.[0]) {
      const key = t.dataset.act;
      const src = await readPhoto(t.files[0]);
      update((x) => {
        x[key] = { src, x: 50, y: 50, zoom: 1 };
        // Past de layout niet meer bij het aantal foto's? Dan de eerste die wel past.
        if (!layoutsFor(x).some((l) => l.id === x.layout)) x.layout = layoutsFor(x)[0].id;
      }, { inspector: true });
    }
    if (t.closest(".brief-form") && t.files?.[0] && (t.name === "photo" || t.name === "photo2")) {
      const ph = { src: await readPhoto(t.files[0]), x: 50, y: 50, zoom: 1 };
      if (t.name === "photo") briefPhoto = ph;
      else briefPhoto2 = ph;
    }
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

  $<HTMLFormElement>(".st-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>(".st-login input[name=code]");
    try {
      await login(input.value);
      input.value = "";
      $(".st-login").hidden = true;
      setLocked(false);
      await start();
    } catch (err) {
      $(".st-login-err").textContent = err instanceof Error ? err.message : "Inloggen mislukt.";
    }
  });

  initStorage().then(() => (storage.mode === "server" && (!storage.loggedIn || storage.problem) ? showLogin() : start()));
}

async function start() {
  await renderLibrary();
  loadBufferChannels();
  if (location.hash === "#fotobank") renderBank();
  // Laatst bewerkte post weer openen.
  if (cache[0] && !S.doc) openPostQuiet(cache[0]);
}

/** In de serverstand zonder login: alleen het inlogscherm, de rest dicht. */
function setLocked(locked: boolean) {
  [".st-bar", ".st-empty", ".st-library"].forEach((sel) => ($(sel).hidden = locked));
  if (locked) {
    $(".st-work").hidden = true;
    $(".st-variants-wrap").hidden = true;
  }
}

function showLogin() {
  setLocked(true);
  $(".st-login").hidden = false;
  if (storage.problem) {
    $(".st-login-err").textContent = storage.problem + " Opslaan kan pas als dat geregeld is (zie docs/online-zetten.md).";
    $<HTMLButtonElement>(".st-login button").disabled = true;
    return;
  }
  $<HTMLInputElement>(".st-login input[name=code]").focus({ preventScroll: true });
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


// ---------- Fotobank ----------
let bankCache: BankPhoto[] = [];

export function bankHtml() {
  return `<div class="bank-app">
    <div class="bank-top">
      <label class="btn small">Foto's toevoegen<input type="file" accept="image/*" multiple data-act="bank-add" hidden></label>
      <span class="bank-status" aria-live="polite"></span>
    </div>
    <p class="bank-off" hidden>De fotobank werkt als de tool online staat. In een los bestand kun je foto's alleen per post kiezen.</p>
    <div class="bank-grid" data-bank-grid></div>
  </div>`;
}

const bankTile = (p: BankPhoto, pick = false) =>
  `<figure class="bank-tile" data-bank-id="${p.id}">
    <button type="button" class="bank-img" ${pick ? `data-pick="${p.id}"` : `data-view-bank="${p.id}"`} title="${esc(p.name)}"><img src="${p.src}" alt="${esc(p.name)}" loading="lazy"></button>
    <figcaption><span>${esc(p.name || "Foto")}</span>${pick ? "" : `<button type="button" class="link danger" data-bank-del="${p.id}">Verwijderen</button>`}</figcaption>
  </figure>`;

export async function renderBank() {
  const root = document.querySelector<HTMLElement>(".bank-app");
  if (!root) return;
  const on = bankAvailable();
  root.querySelector<HTMLElement>(".bank-off")!.hidden = on;
  root.querySelector<HTMLElement>(".bank-top")!.hidden = !on;
  try {
    bankCache = await bankList();
  } catch (err) {
    toast(err instanceof Error ? err.message : "Fotobank ophalen mislukt.");
  }
  root.querySelector<HTMLElement>("[data-bank-grid]")!.innerHTML = bankCache.length
    ? bankCache.map((p) => bankTile(p)).join("")
    : on ? `<p class="st-none">Nog geen foto's. Voeg de beste foto's van opkomsten en kampen toe, dan kan iedereen ze gebruiken.</p>` : "";
}

/** Opent de kiezer en geeft de gekozen foto als data-URL terug (gekopieerd, dus de post blijft heel als de foto later uit de fotobank gaat). */
function pickFromBank(): Promise<{ src: string; name: string } | null> {
  return new Promise(async (resolve) => {
    const dlg = $<HTMLDialogElement>(".bank-pick");
    const grid = dlg.querySelector<HTMLElement>("[data-pick-grid]")!;
    try {
      bankCache = await bankList();
    } catch {
      /* lege lijst */
    }
    grid.innerHTML = bankCache.length ? bankCache.map((p) => bankTile(p, true)).join("") : `<p class="st-none">De fotobank is nog leeg. Voeg foto's toe via Fotobank bovenin.</p>`;
    const done = (v: { src: string; name: string } | null) => {
      dlg.removeEventListener("click", onClick);
      dlg.close();
      resolve(v);
    };
    const onClick = async (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-act=bank-pick-close]") || t === dlg) return done(null);
      const id = t.closest<HTMLElement>("[data-pick]")?.dataset.pick;
      const p = bankCache.find((x) => x.id === id);
      if (!p) return;
      const blob = await (await fetch(new URL(p.src, location.href), { credentials: "same-origin" })).blob();
      done({ src: await readPhoto(blob), name: p.name || "foto" });
    };
    dlg.addEventListener("click", onClick);
    dlg.showModal();
  });
}

export function mountBank(root: HTMLElement) {
  root.addEventListener("change", async (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.act !== "bank-add" || !t.files?.length) return;
    const files = [...t.files];
    const status = root.querySelector<HTMLElement>(".bank-status")!;
    let n = 0;
    for (const f of files) {
      status.textContent = `Bezig: ${++n} van ${files.length}…`;
      try {
        await bankUpload(await readPhoto(f), f.name.replace(/\.[^.]+$/, ""));
      } catch (err) {
        toast(`${f.name}: ${err instanceof Error ? err.message : "uploaden mislukt"}`);
      }
    }
    status.textContent = `${files.length} ${files.length === 1 ? "foto" : "foto's"} toegevoegd.`;
    t.value = "";
    renderBank();
  });
  root.addEventListener("click", async (e) => {
    const del = (e.target as HTMLElement).closest<HTMLElement>("[data-bank-del]")?.dataset.bankDel;
    if (!del) return;
    if (!confirm("Deze foto uit de fotobank verwijderen? Posts die hem al gebruiken blijven heel.")) return;
    await bankDelete(del);
    renderBank();
  });
}


// ---------- Buffer ----------
let bufferList: BufferChannel[] = [];
/** Formaat per soort: feed-post in 4:5, story in 9:16 (ids uit brand.json > formats). */
const FORMAT_FOR = { post: "ig45", story: "ig916" } as const;

async function loadBufferChannels() {
  try {
    const r = await bufferChannels();
    bufferList = r.channels;
    document.querySelectorAll<HTMLElement>("[data-act=buffer]").forEach((b) => (b.hidden = !r.configured));
  } catch {
    /* geen Buffer: knop blijft verborgen */
  }
}

/** Rendert de post in een ander formaat (zelfde layout en kleuren). */
async function renderAs(d: PostDoc, format: string) {
  const copy: PostDoc = { ...structuredClone(d), format };
  if (!fmt(format).layouts.some((l) => l.id === copy.layout)) copy.layout = layoutsFor(copy)[0].id;
  return renderPng(copy);
}

async function openBuffer(d: PostDoc) {
  const dlg = $<HTMLDialogElement>(".buffer-dlg");
  const msg = dlg.querySelector<HTMLElement>(".buffer-msg")!;
  msg.textContent = "";
  dlg.querySelector<HTMLTextAreaElement>("[data-buffer-caption]")!.value = d.caption ?? [d.fields.head, d.fields.sub, d.fields.details, d.fields.cta].filter(Boolean).join("\n");
  const prev = dlg.querySelector<HTMLElement>(".buffer-previews")!;
  prev.innerHTML = `<p class="ins-note">Afbeeldingen maken…</p>`;
  const targets = dlg.querySelector<HTMLElement>("[data-buffer-targets]")!;
  targets.innerHTML = bufferList.length
    ? bufferList
        .flatMap((c) =>
          (["post", "story"] as const).map((kind) => {
            const label = `${c.service === "instagram" ? "Instagram" : "Facebook"} ${kind === "post" ? "post (4:5)" : "story (9:16)"} · ${esc(c.displayName || c.name)}`;
            const on = kind === "post" || c.service === "instagram";
            return `<label class="buffer-target"><input type="checkbox" data-channel="${c.id}" data-service="${c.service}" data-type="${esc(c.type)}" data-kind="${kind}" ${on ? "checked" : ""}> ${label}</label>`;
          }),
        )
        .join("")
    : `<p class="ins-note">Er zijn nog geen Instagram- of Facebook-kanalen gekoppeld in Buffer.</p>`;
  dlg.showModal();

  // Voorbeelden van beide formaten, met eventuele merkfouten.
  const out: string[] = [];
  bufferImages = {};
  for (const [kind, format] of Object.entries(FORMAT_FOR)) {
    const { png, issues } = await renderAs(d, format);
    bufferImages[format] = issues.length ? "" : png;
    out.push(`<figure class="buffer-prev"><img src="${png}" alt=""><figcaption>${kind === "post" ? "Post 4:5" : "Story 9:16"}${issues.length ? `<br><span class="bad">Niet on brand: ${esc(issues[0].msg)}</span>` : ""}</figcaption></figure>`);
    if (issues.length) targets.querySelectorAll<HTMLInputElement>(`[data-kind="${kind}"]`).forEach((i) => ((i.checked = false), (i.disabled = true)));
  }
  prev.innerHTML = out.join("");
}
let bufferImages: Record<string, string> = {};

async function sendBuffer(d: PostDoc, btn: HTMLButtonElement) {
  const dlg = $<HTMLDialogElement>(".buffer-dlg");
  const msg = dlg.querySelector<HTMLElement>(".buffer-msg")!;
  const caption = dlg.querySelector<HTMLTextAreaElement>("[data-buffer-caption]")!.value.trim();
  const picked = [...dlg.querySelectorAll<HTMLInputElement>("[data-channel]:checked")];
  if (!picked.length) return void (msg.textContent = "Kies minstens één kanaal.");
  const targets: BufferTarget[] = picked.map((i) => ({
    channelId: i.dataset.channel!,
    service: i.dataset.service!,
    kind: i.dataset.kind as "post" | "story",
    format: FORMAT_FOR[i.dataset.kind as "post" | "story"],
    // Een persoonlijk Instagram-profiel kan alleen via een herinnering op je telefoon.
    notification: i.dataset.service === "instagram" && i.dataset.type === "profile",
  }));
  const images: Record<string, string> = {};
  for (const t of targets) if (bufferImages[t.format]) images[t.format] = bufferImages[t.format];
  btn.disabled = true;
  msg.textContent = "Bezig met versturen…";
  try {
    if (caption !== (d.caption ?? "")) update((x) => (x.caption = caption), { history: false });
    const results = await bufferSend(caption, images, targets);
    const ok = results.filter((r) => r.ok).length;
    msg.innerHTML = ok === results.length
      ? `${ok} ${ok === 1 ? "concept staat" : "concepten staan"} in Buffer. Keur ${ok === 1 ? "hem" : "ze"} daar goed en plan ${ok === 1 ? "hem" : "ze"} in.`
      : `${ok} van ${results.length} gelukt.<br>${results.filter((r) => !r.ok).map((r) => esc(r.error ?? "")).join("<br>")}`;
  } catch (err) {
    msg.textContent = `Versturen mislukt: ${err instanceof Error ? err.message : "onbekende fout"}`;
  } finally {
    btn.disabled = false;
  }
}
