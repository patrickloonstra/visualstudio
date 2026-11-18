// Pagina: eerst de studio ("Maak een post"), met een link naar een korte stijlgids.
// Alles komt uit brand.json. Geen merknamen of kleuren in deze code.
import { brand, color, photoUrls, rgb, type Logo } from "./brand";
import { download, downloadPng, downloadSvg, fileName, logoSvg, pngBlob } from "./logos";
import { ratio } from "./wcag";
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
/** Beste leesbare tekstkleur op een kleurvlak (alleen voor labels in de gids). */
const labelOn = (hex: string) =>
  brand.colors.map((c) => ({ c, r: ratio(c.hex, hex) })).sort((a, b) => b.r - a.r)[0].c.hex;

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


// ---------- Navigatie ----------
function nav() {
  const l = logos[0];
  return `<nav class="nav" aria-label="Hoofdmenu">
    <a class="nav-brand" href="#studio">${l ? logoSvg(l, logoOn(l, X.ui.primary)) : ""}<span>${esc(brand.name)}</span></a>
    <ul><li><a href="#studio" data-view="studio">Maak een post</a></li><li><a href="#fotobank" data-view="fotobank">Fotobank</a></li><li><a href="#stijlgids" data-view="stijlgids">Stijlgids</a></li></ul>
  </nav>`;
}

// ---------- Stijlgids (kort) ----------
function guideView() {
  const roleName: Record<string, string> = { achtergrond: "Hoofdkleur", accent: "Accent", rust: "Rust", tekst: "Tekst" };
  const colors = brand.colors
    .map((c) => {
      const on = brand.pairs.filter((p) => p.bg === c.id).map((p) => color(p.fg).name.toLowerCase() + (p.use === "large" ? " (alleen koppen)" : ""));
      return `<li class="cg-color">
        <span class="cg-chip" style="background:${c.hex};color:${labelOn(c.hex)}">Aa</span>
        <span class="cg-name"><strong>${esc(c.name)}</strong><small>${esc(roleName[c.role] ?? c.role)}${on.length ? ` · tekst erop: ${esc(on.join(", "))}` : ""}</small></span>
        <button class="cg-hex" data-copy="${c.hex.toUpperCase()}" title="Kopieer">${c.hex.toUpperCase()}</button>
      </li>`;
    })
    .join("");
  const dos = brand.dosDonts.filter((d) => d.do).map((d) => `<li class="ok">${esc(d.text)}</li>`).join("");
  const donts = brand.dosDonts.filter((d) => !d.do).map((d) => `<li class="no">${esc(d.text)}</li>`).join("");
  const fonts = [...new Set([brand.fonts.heading.family, brand.fonts.body.family])].join(" en ");
  return `<section id="stijlgids" class="view section" hidden>
    <div class="wrap narrow">
      <h1 class="view-title">Stijlgids</h1>
      <p class="intro">Maak je iets buiten de studio, zoals een flyer in Word of een post in Canva? Gebruik dan deze bestanden en kleuren.</p>

      <h2 class="g-h">Logo's</h2>
      <div class="logo-grid">${brand.logos.map(logoCard).join("")}</div>
      <p class="g-note"><strong>PNG</strong> voor social media, Word en Canva. <strong>SVG</strong> voor drukwerk en de website. <strong>Nooit</strong> een screenshot of een logo van Google.</p>

      <h2 class="g-h">Kleuren</h2>
      <ul class="cg-colors">${colors}</ul>
      <p class="g-note">Klik op een kleurcode om hem te kopiëren. Lettertype: ${esc(fonts)}.</p>

      <h2 class="g-h">Regels</h2>
      <ul class="g-rules">${dos}${donts}${(X.photoRules ?? []).map((r) => `<li class="ok">${esc(r)}</li>`).join("")}</ul>

      ${brand.voice.rules.length ? `<h2 class="g-h">Zo schrijven we</h2><ul class="g-rules">${brand.voice.rules.map((r) => `<li class="ok">${esc(r)}</li>`).join("")}</ul>` : ""}

      <p class="g-all"><button type="button" class="btn small" data-act="zip">Download alle logo's en kleuren (zip)</button></p>
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
export function guideHtml(studio: string, bank = "") {
  return (
    nav() +
    "<main>" +
    `<section id="studio" class="view section studio"><div class="wrap"><h1 class="view-title">Maak een post</h1><p class="intro">Vul je tekst in, kies een foto en een variant, en download. Kleuren, letters en logo kloppen altijd.</p><div id="studio-app">${studio}</div></div></section>` +
    `<section id="fotobank" class="view section" hidden><div class="wrap"><h1 class="view-title">Fotobank</h1><p class="intro">Eén voorraad foto's voor iedereen. Kies ze bij een post met <strong>Uit fotobank</strong>.</p>${bank}</div></section>` +
    guideView() +
    "</main>" +
    `<footer class="foot"><div class="wrap foot-row"><span class="foot-maker">© ${new Date(typeof __BUILD__ === "object" ? __BUILD__.time : Date.now()).getFullYear()} Patrick Loonstra · gemaakt door <a href="https://patrickloonstra.nl" target="_blank" rel="noopener">patrickloonstra.nl</a></span><span class="foot-version">${versionLine()}</span></div></footer><div class="toast" role="status" aria-live="polite"></div>`
  );
}

/** "Gepubliceerd 18 nov 2026 om 15:42 · versie 38c15d9": zo zie je welke versie er staat. */
function versionLine() {
  const b = typeof __BUILD__ === "object" ? __BUILD__ : null;
  if (!b) return "";
  const when = new Date(b.time).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const commit = b.commit ? ` · versie ${esc(b.commit)}${b.dirty ? " + wijzigingen" : ""}` : "";
  return `Gepubliceerd ${esc(when)}${commit}`;
}

/** Twee weergaven in één bestand: #stijlgids toont de gids, al het andere de studio. */
/** Drie weergaven in één bestand: #stijlgids, #fotobank, en anders de studio. */
function route() {
  const view = location.hash === "#stijlgids" ? "stijlgids" : location.hash === "#fotobank" ? "fotobank" : "studio";
  for (const id of ["studio", "fotobank", "stijlgids"]) document.querySelector<HTMLElement>(`#${id}`)!.hidden = id !== view;
  document.querySelectorAll<HTMLElement>("[data-view]").forEach((a) => a.classList.toggle("on", a.dataset.view === view));
  if (view !== "studio") window.scrollTo(0, 0);
  window.dispatchEvent(new CustomEvent("merkstudio:view", { detail: view }));
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
  document.querySelector<HTMLButtonElement>("[data-act=zip]")?.addEventListener("click", (e) => downloadAll(e.currentTarget as HTMLButtonElement));
  window.addEventListener("hashchange", route);
  route();
}

export const ui = () => X.ui;
