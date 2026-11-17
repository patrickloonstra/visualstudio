// Brandguide: alle secties worden opgebouwd uit brand.json. Geen merknamen of kleuren in deze code.
import { brand, color, photoUrls, rgb, type Logo } from "./brand";
import { download, downloadPng, downloadSvg, fileName, logoSvg, pngBlob } from "./logos";
import { B, newDoc, px, type PostDoc } from "./studio/model";
import { fit, postHtml } from "./studio/render";
import { openBriefing } from "./studio/ui";
import { contrastClass, ratio } from "./wcag";
import { makeZip } from "./zip";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

type Ext = {
  ui: Record<"primary" | "onPrimary" | "surface" | "paper" | "line" | "ink" | "highlight", string>;
  copy: Record<string, string>;
  clearSpace?: { draft?: boolean; ratio: number; label: string; minPrint?: string };
  typeRules?: { draft?: boolean; columns: { title: string; items: string[] }[] };
  photoRules?: string[];
};
const X = brand as unknown as Ext & typeof brand;
type LogoK = Logo & { kind?: "logo" | "mark" };
const logos = (brand.logos as LogoK[]).filter((l) => (l.kind ?? "logo") === "logo");
const marks = (brand.logos as LogoK[]).filter((l) => l.kind === "mark");

/** Achtergrond voor een logokleur: eerst een rustige kleur, dan de hoofdkleur, dan een accent. */
function bgFor(fg: string) {
  const options = brand.pairs.filter((p) => p.fg === fg).map((p) => color(p.bg));
  const rank = (c: { role: string }) => (c.role === "rust" ? 0 : c.role === "achtergrond" ? 1 : 2);
  return options.sort((a, b) => rank(a) - rank(b))[0]?.id ?? X.ui.paper;
}
/** Logokleur die op een achtergrond mag. */
const logoOn = (l: Logo, bg: string) => l.colorways.find((c) => brand.pairs.some((p) => p.bg === bg && p.fg === c)) ?? l.colorways[0];
const draft = (on?: boolean) => (on ? `<span class="draft">Voorstel, nog vaststellen</span>` : "");

export const sections = [
  ["start", "Start"],
  ["logo", "Logo"],
  ...(marks.length ? [["beeldmerken", "Beeldmerken"]] : []),
  ["kleur", "Kleur"],
  ["type", "Type"],
  ["fotos", "Foto's"],
  ["stem", "Stem"],
  ["in-gebruik", "In gebruik"],
  ["studio", "Studio"],
] as [string, string][];

const head = (n: number, id: string, title: string, intro?: string) =>
  `<p class="kicker">${String(n).padStart(2, "0")}</p><h2>${esc(title)}</h2>${intro ? `<p class="intro">${esc(intro)}</p>` : ""}`;

// ---------- Navigatie en start ----------
export function nav() {
  const l = logos[0];
  return `<nav class="nav" aria-label="Hoofdmenu">
    <a class="nav-brand" href="#start">${l ? logoSvg(l, logoOn(l, X.ui.primary)) : ""}<span>${esc(brand.name)}</span></a>
    <ul>${sections.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join("")}</ul>
  </nav>`;
}

export function hero() {
  const m = marks[0] ?? logos[0];
  return `<header id="start" class="hero">
    <div class="wrap hero-grid">
      <div>
        <p class="kicker">Merkgids</p>
        <h1>${esc(brand.name)}</h1>
        <p class="lead">${esc(X.copy?.heroLead ?? "")}</p>
        <p class="hero-links"><a class="btn" href="#logo">Logo downloaden</a><a class="btn ghost" href="#maak">Zelf een post maken</a></p>
      </div>
      <div class="hero-mark" aria-hidden="true">${m ? logoSvg(m, logoOn(m, X.ui.primary)) : ""}</div>
    </div>
  </header>`;
}

// ---------- Logo ----------
function logoCard(logo: Logo) {
  const first = logo.colorways[0];
  return `<article class="logo-card" data-logo="${logo.id}" data-color="${first}">
    <div class="logo-stage" style="background:${color(bgFor(first)).hex}">${logoSvg(logo, first)}</div>
    <div class="logo-body">
      <h3>${esc(logo.label)}</h3>
      ${(logo as { note?: string }).note ? `<p>${esc((logo as { note?: string }).note!)}</p>` : ""}
      <div class="swatches" role="radiogroup" aria-label="Kleurvariant ${esc(logo.label)}">
        ${logo.colorways.map((c, i) => `<button role="radio" aria-checked="${i === 0}" data-colorway="${c}" title="${esc(color(c).name)}" style="background:${color(c).hex}"><span>${esc(color(c).name)}</span></button>`).join("")}
      </div>
      <p class="colorway-label">Variant: <strong>${esc(color(first).name)}</strong> · op ${esc(color(bgFor(first)).name.toLowerCase())}</p>
      <div class="dl">
        <button class="btn small" data-dl="png">Download PNG</button>
        <button class="btn small ghost" data-dl="svg">Download origineel (SVG)</button>
      </div>
    </div>
  </article>`;
}

function misuse() {
  const l = logos[0];
  if (!l) return "";
  const base = logoOn(l, X.ui.paper);
  // De kleur waarop het logo het slechtst leesbaar is: berekend, niet ingevuld.
  const worst = brand.colors
    .filter((c) => c.id !== base)
    .map((c) => ({ c, r: ratio(c.hex, color(base).hex) }))
    .sort((a, b) => a.r - b.r)[0]?.c;
  const busy = brand.colors.slice(0, 4).map((c, i) => `${c.hex} ${i * 25}% ${(i + 1) * 25}%`).join(",");
  // Een kleur die bewust níét in het merk zit, om fout gebruik te laten zien.
  const offBrand = "#C2185B";
  const items: [string, string, string, string?][] = [
    ["Uitgerekt of platgedrukt", "transform:scaleX(1.5)", ""],
    ["Gedraaid of gekanteld", "transform:rotate(-18deg)", ""],
    ["In een andere kleur", "", "", "recolor"],
    ["Met schaduw, gloed of rand", "filter:drop-shadow(8px 10px 6px rgb(0 0 0 / .55))", ""],
    ["Op een drukke achtergrond", "", `background:repeating-conic-gradient(${busy})`],
    ["Op een kleur waarin het wegvalt", "", worst ? `background:${worst.hex}` : ""],
  ];
  return `<h3 class="sub">Liever niet</h3>
    <div class="misuse">${items
      .map(([t, logoStyle, bg, mode]) => `<figure class="mis"><div class="mis-stage" style="${bg}"><div style="${logoStyle}">${mode ? logoSvg(l, base).replace(new RegExp(color(base).hex, "gi"), offBrand) : logoSvg(l, base)}</div><span class="x" aria-hidden="true">✕</span></div><figcaption>${esc(t)}</figcaption></figure>`)
      .join("")}</div>
    <ul class="extra-donts">${brand.dosDonts.filter((d) => !d.do).map((d) => `<li>${esc(d.text)}</li>`).join("")}</ul>`;
}

function clearSpace() {
  const l = logos[0];
  const cs = X.clearSpace;
  if (!l || !cs) return "";
  // Padding in % van de zone-breedte, zodat de vrije ruimte precies ratio × logobreedte is.
  const pad = ((cs.ratio / (1 + 2 * cs.ratio)) * 100).toFixed(1);
  return `<div class="clear">
    <div class="clear-art"><div class="clear-zone" style="padding:${pad}%"><div class="clear-logo">${logoSvg(l, logoOn(l, X.ui.paper))}</div></div></div>
    <div class="clear-text">
      ${draft(cs.draft)}
      <h3>Geef het ruimte</h3>
      <p>Houd rondom het logo een vrije ruimte van ${esc(cs.label)}. In die zone staat niets: geen tekst, geen foto's, geen paginarand.</p>
      <h3>Niet te klein</h3>
      <p>Op een scherm minimaal ${l.minWidth} px breed${cs.minPrint ? `, in print minimaal ${esc(cs.minPrint)}` : ""}. Past het niet? Kies dan een andere plek of een groter formaat.</p>
    </div>
  </div>`;
}

function logoSection(n: number) {
  const dos = brand.dosDonts.filter((d) => d.do);
  return `<section id="logo" class="section">
    <div class="wrap">
      ${head(n, "logo", "Logo", "Kies een kleurvariant die past bij de achtergrond. Je downloadt precies wat je ziet.")}
      <div class="logo-grid">${logos.map(logoCard).join("")}</div>
      <div class="which">
        <h3>Welk bestand gebruik ik?</h3>
        <dl>
          <div><dt>PNG</dt><dd>Voor Canva, social posts, presentaties, Word en e-mailhandtekeningen. Transparante achtergrond.</dd></div>
          <div><dt>SVG</dt><dd>Voor websites, drukkers en borduurwerk. Blijft scherp op elk formaat. Stuur dit naar leveranciers.</dd></div>
          <div class="never"><dt>Nooit</dt><dd>Een screenshot, het logo van de website trekken of uit een oud document kopiëren. Altijd vers downloaden van deze pagina.</dd></div>
        </dl>
      </div>
      ${clearSpace()}
      ${dos.length ? `<div class="dos"><h3>Wel doen</h3><ul>${dos.map((d) => `<li>${esc(d.text)}</li>`).join("")}</ul></div>` : ""}
      ${misuse()}
    </div>
  </section>`;
}

function marksSection(n: number) {
  if (!marks.length) return "";
  return `<section id="beeldmerken" class="section alt">
    <div class="wrap">
      ${head(n, "beeldmerken", "Beeldmerken", "Losse merkelementen, met dezelfde downloads als het logo.")}
      <div class="logo-grid">${marks.map(logoCard).join("")}</div>
    </div>
  </section>`;
}

// ---------- Kleur ----------
/** Beste leesbare tekstkleur op een kleurvlak (alleen voor labels in de gids). */
const labelOn = (hex: string) =>
  brand.colors.map((c) => ({ c, r: ratio(c.hex, hex) })).sort((a, b) => b.r - a.r)[0].c.hex;

function colorSection(n: number) {
  const roleName: Record<string, string> = { achtergrond: "Achtergrond", accent: "Accent", rust: "Rust", tekst: "Tekst" };
  const cards = brand.colors
    .map((c) => {
      const [r, g, b] = rgb(c.hex);
      const values = [["HEX", c.hex.toUpperCase()], ["RGB", `${r}, ${g}, ${b}`], ["CMYK", c.cmyk ?? ""]];
      return `<article class="color-card">
        <div class="chip" style="background:${c.hex};color:${labelOn(c.hex)}"><span class="role-pill">${esc(roleName[c.role] ?? c.role)}</span><span>${esc(c.name)}</span></div>
        <div class="color-body">
          <p class="role">${esc(c.roleLabel)}</p>
          <ul class="values">${values
            .map(([k, v]) =>
              v
                ? `<li><button class="copy" data-copy="${esc(v)}"><span class="k">${k}</span><span class="v">${esc(v)}</span><span class="c">Kopieer</span></button></li>`
                : `<li class="na"><span class="k">${k}</span><span class="v">Opvragen bij drukker</span></li>`,
            )
            .join("")}</ul>
        </div>
      </article>`;
    })
    .join("");

  const shown = brand.colors.filter((c) => c.ratio > 0);
  const bar = shown
    .map((c) => `<div style="flex:${c.ratio};background:${c.hex};color:${labelOn(c.hex)}" title="${esc(c.name)} ${Math.round(c.ratio * 100)}%"><span>${c.ratio >= 0.1 ? esc(c.name) + " " : ""}${Math.round(c.ratio * 100)}%</span></div>`)
    .join("");

  const bgs = [...new Set(brand.pairs.map((p) => p.bg))];
  const pairings = bgs
    .map((bg) => {
      const c = color(bg);
      const ok = brand.pairs.filter((p) => p.bg === bg);
      const never = brand.colors.filter((x) => x.id !== bg && !ok.some((p) => p.fg === x.id));
      return `<article class="pairing" style="background:${c.hex};color:${labelOn(c.hex)}">
        <div class="pairing-top"><span>Op ${esc(c.name.toLowerCase())}</span><span>${c.hex.toUpperCase()}</span></div>
        ${ok
          .map((p) => {
            const fg = color(p.fg);
            const large = p.use === "large";
            return `<div class="pair-row" style="color:${fg.hex}"><strong class="${large ? "big" : ""}">Aa</strong><span><b>${esc(fg.name)}</b><br><small>${large ? "Alleen koppen en grafische elementen" : "Elke tekst, elk formaat"} · ${ratio(fg.hex, c.hex).toFixed(1)}:1</small></span></div>`;
          })
          .join("")}
        ${never.length ? `<div class="never-row"><span>Nooit op ${esc(c.name.toLowerCase())}</span><span class="never-dots">${never.map((x) => `<i style="background:${x.hex}" title="${esc(x.name)}: ${ratio(x.hex, c.hex).toFixed(1)}:1${contrastClass(x.hex, c.hex) === "never" ? ", te weinig contrast" : ", niet in de merkregels"}"></i>`).join("")}</span></div>` : ""}
      </article>`;
    })
    .join("");

  return `<section id="kleur" class="section alt">
    <div class="wrap">
      ${head(n, "kleur", "Kleur", X.copy?.colorIntro)}
      <div class="color-grid">${cards}</div>
      <h3 class="sub">Hoeveel van elke kleur</h3>
      <p class="intro small">Een grof recept: veel van de hoofdkleur, een beetje accent, rust waar het nodig is.</p>
      <div class="ratio-bar" role="img" aria-label="Verhouding kleuren">${bar}</div>
      <h3 class="sub">Combinaties die werken</h3>
      <p class="intro small">Alleen deze combinaties zijn goed leesbaar (WCAG AA). De studio kan geen andere maken.</p>
      <div class="pairings">${pairings}</div>
    </div>
  </section>`;
}

// ---------- Type ----------
function typeSection(n: number) {
  const fams = new Map<string, { file: string; roles: string[] }>();
  (["heading", "body"] as const).forEach((k) => {
    const f = brand.fonts[k];
    const e = fams.get(f.family) ?? { file: f.file, roles: [] };
    e.roles.push(f.use);
    fams.set(f.family, e);
  });
  const fmt0 = B.formats[0];
  const scale = B.typeSteps
    .map(([id, label]) => `<li><span class="ts-label">${label}<small>${px(fmt0.id, id)} px</small></span><span class="ts-sample" style="font-size:${Math.round(px(fmt0.id, id) * 0.5)}px;font-weight:${["display", "h1", "h2", "h3"].includes(id) ? 700 : 400}">${esc(B.postTypes[0]?.fields.head || brand.name)}</span></li>`)
    .join("");
  const styles = Object.values(B.styles)
    .map((s) => `<article class="style-card"><p class="sc-name" style="font-family:${s.font === "heading" ? "var(--font-heading)" : "var(--font-body)"};font-weight:${s.weight}">${esc(s.label)}</p><p class="sc-use">${esc(s.use)} · ${s.sizes.map((x) => B.typeSteps.find(([i]) => i === x)?.[1]).join(", ")}</p><ul>${s.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></article>`)
    .join("");
  const rules = X.typeRules
    ? `<h3 class="sub">Regels</h3>${draft(X.typeRules.draft)}<div class="type-rules">${X.typeRules.columns.map((c) => `<div><h4>${esc(c.title)}</h4><ul>${c.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}</div>`
    : "";
  return `<section id="type" class="section">
    <div class="wrap">
      ${head(n, "type", "Typografie")}
      ${[...fams]
        .map(([family, f]) => `<div class="type-grid">
          <div class="specimen"><p class="aa">Aa</p><p class="family">${esc(family)}</p><p class="glyphs">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789 &amp;!?€</p></div>
          <div class="font-info"><h3>${esc(family)}</h3><ul>${f.roles.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
            <ul class="weights">${[900, 700, 500, 400].map((w) => `<li><span class="w" style="font-weight:${w}">${esc(brand.short)}</span><span class="meta">${w}</span></li>`).join("")}</ul></div>
        </div>`)
        .join("")}
      <h3 class="sub">Typeschaal</h3>
      <p class="intro small">Vaste groottes voor ${esc(fmt0.label)} (${fmt0.w} × ${fmt0.h}). In de studio kies je een stap, nooit een losse puntgrootte. Voorbeelden op halve grootte.</p>
      <ul class="type-scale">${scale}</ul>
      <h3 class="sub">Stijlen in de studio</h3>
      <div class="style-cards">${styles}</div>
      ${rules}
    </div>
  </section>`;
}

// ---------- Foto's, stem ----------
function photoSection(n: number) {
  const tiles = photoUrls.length
    ? photoUrls.map((u) => `<figure class="photo"><img src="${u}" alt=""></figure>`).join("")
    : Array.from({ length: 4 }, (_, i) => `<figure class="photo placeholder"><span>Foto ${i + 1}<br><small>volgt</small></span></figure>`).join("");
  return `<section id="fotos" class="section alt">
    <div class="wrap">
      ${head(n, "fotos", "Foto's", X.copy?.photoIntro)}
      <div class="photo-grid">${tiles}</div>
      ${X.photoRules?.length ? `<ul class="rules">${X.photoRules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
    </div>
  </section>`;
}

function voiceSection(n: number) {
  const v = brand.voice;
  return `<section id="stem" class="section">
    <div class="wrap">
      ${head(n, "stem", "Stem")}
      ${draft(v.draft)}
      <p class="intro">${esc(X.copy?.voiceIntro ?? "")}</p>
      <ol class="voice-rules">${v.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>
      <div class="examples">${v.examples
        .map((e) => `<div class="example"><p class="good"><span>Zo</span>${esc(e.goed)}</p>${e.liever ? `<p class="bad"><span>Liever niet</span>${esc(e.liever)}</p>` : ""}</div>`)
        .join("")}</div>
    </div>
  </section>`;
}

// ---------- In gebruik ----------
function inUseDocs(): PostDoc[] {
  const f = B.formats[0];
  const noPhoto = f.layouts.filter((l) => !l.photo);
  const themes = [...B.themes].sort((a, b) => Number(!!b.primary) - Number(!!a.primary));
  return B.postTypes.slice(0, 3).map((t, i) => {
    const d = newDoc(t.id);
    d.layout = noPhoto[i % noPhoto.length]?.id ?? f.layouts[0].id;
    d.theme = themes[i % themes.length].id;
    if (photoUrls[i]) {
      d.photo = { src: photoUrls[i], x: 50, y: 50, zoom: 1 };
      d.layout = f.layouts.filter((l) => l.photo)[i % 3]?.id ?? d.layout;
    }
    return d;
  });
}

function inUseSection(n: number) {
  return `<section id="in-gebruik" class="section alt">
    <div class="wrap">
      ${head(n, "in-gebruik", "In gebruik", X.copy?.inUseIntro)}
      <div class="in-use">${inUseDocs().map((_, i) => `<figure class="iu" data-i="${i}"><div class="iu-post"></div><figcaption>${esc(B.postTypes[i].label)}</figcaption></figure>`).join("")}</div>
    </div>
  </section>`;
}

function renderInUse() {
  const docs = inUseDocs();
  document.querySelectorAll<HTMLElement>(".iu").forEach((fig) => {
    const d = docs[Number(fig.dataset.i)];
    const holder = fig.querySelector<HTMLElement>(".iu-post")!;
    const f = B.formats.find((x) => x.id === d.format)!;
    const w = fig.clientWidth;
    holder.style.height = (f.h * w) / f.w + "px";
    holder.innerHTML = postHtml(d);
    const post = holder.firstElementChild as HTMLElement;
    post.style.transform = `scale(${w / f.w})`;
    fit(post, d);
  });
}

// ---------- Maak iets, neem alles mee ----------
function makeSection() {
  return `<section id="maak" class="section band">
    <div class="wrap">
      <h2>Maak iets</h2>
      <p class="intro">${esc(X.copy?.makeIntro ?? "")}</p>
      <p class="hero-links"><button type="button" class="btn" data-act="open-brief">Ik heb een post nodig over…</button><a class="btn ghost" href="#studio">Open de studio</a></p>
    </div>
  </section>`;
}

export function takeAllSection() {
  return `<section id="alles" class="section band">
    <div class="wrap">
      <h2>Neem alles mee</h2>
      <p class="intro">Eén zip met elk logo en beeldmerk in elke kleurvariant, als PNG en als origineel SVG. Plus alle kleurcodes in een tekstbestand.</p>
      <p class="hero-links"><button type="button" class="btn" data-act="zip">Download alles</button></p>
    </div>
  </section>`;
}

async function downloadAll(btn: HTMLButtonElement) {
  btn.disabled = true;
  btn.textContent = "Bezig met inpakken…";
  try {
    const files: { name: string; data: Blob | string }[] = [];
    for (const l of brand.logos) {
      for (const c of l.colorways) {
        files.push({ name: `logos/${fileName(l, c, "svg")}`, data: logoSvg(l, c) });
        files.push({ name: `logos/${fileName(l, c, "png")}`, data: await pngBlob(l, c) });
      }
    }
    const lines = brand.colors.map((c) => {
      const [r, g, b] = rgb(c.hex);
      return `${c.name}\n  Rol: ${c.roleLabel}\n  HEX: ${c.hex.toUpperCase()}\n  RGB: ${r}, ${g}, ${b}\n  CMYK: ${c.cmyk ?? "opvragen bij drukker"}\n`;
    });
    const pairs = brand.pairs.map((p) => `  ${color(p.fg).name} op ${color(p.bg).name}${p.use === "large" ? " (alleen koppen)" : ""}`);
    files.push({ name: "kleuren.txt", data: `${brand.name}: kleuren\n\n${lines.join("\n")}\nToegestane combinaties\n${pairs.join("\n")}\n` });
    download(await makeZip(files), `${brand.short.toLowerCase()}-merkbestanden.zip`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Download alles";
  }
}

// ---------- Alles samen ----------
export function guideHtml(studio: string) {
  let n = 0;
  return (
    nav() +
    hero() +
    "<main>" +
    logoSection(++n) +
    (marks.length ? marksSection(++n) : "") +
    colorSection(++n) +
    typeSection(++n) +
    photoSection(++n) +
    voiceSection(++n) +
    inUseSection(++n) +
    makeSection() +
    `<section id="studio" class="section studio"><div class="wrap">${head(++n, "studio", "Studio", "Maak zelf een post. Kleuren, letters en plek liggen vast, zodat het altijd klopt.")}<div id="studio-app">${studio}</div></div></section>` +
    takeAllSection() +
    "</main>" +
    `<footer class="foot"><div class="wrap">${esc(brand.name)} · Merkgids · Studio 2.0</div></footer><div class="toast" role="status" aria-live="polite"></div>`
  );
}

function toast(msg: string) {
  const t = document.querySelector<HTMLElement>(".toast")!;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(Number(t.dataset.timer));
  t.dataset.timer = String(setTimeout(() => t.classList.remove("show"), 1600));
}

export function wireGuide() {
  document.querySelectorAll<HTMLElement>(".logo-card").forEach((card) => {
    const logo = brand.logos.find((l) => l.id === card.dataset.logo)!;
    card.querySelectorAll<HTMLButtonElement>("[data-colorway]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const c = btn.dataset.colorway!;
        card.dataset.color = c;
        card.querySelectorAll("[data-colorway]").forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
        const stage = card.querySelector<HTMLElement>(".logo-stage")!;
        stage.style.background = color(bgFor(c)).hex;
        stage.innerHTML = logoSvg(logo, c);
        card.querySelector(".colorway-label")!.innerHTML = `Variant: <strong>${esc(color(c).name)}</strong> · op ${esc(color(bgFor(c)).name.toLowerCase())}`;
      }),
    );
    card.querySelector("[data-dl=png]")!.addEventListener("click", () => downloadPng(logo, card.dataset.color!));
    card.querySelector("[data-dl=svg]")!.addEventListener("click", () => downloadSvg(logo, card.dataset.color!));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy!);
        toast(`${b.dataset.copy} gekopieerd`);
      } catch {
        toast("Kopiëren lukt niet in deze browser");
      }
    }),
  );
  document.querySelector("[data-act=open-brief]")?.addEventListener("click", () => openBriefing());
  document.querySelector<HTMLButtonElement>("[data-act=zip]")?.addEventListener("click", (e) => downloadAll(e.currentTarget as HTMLButtonElement));
  document.fonts.ready.then(renderInUse);
  let t = 0;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = window.setTimeout(renderInUse, 150);
  });
}

export const ui = () => X.ui;
