import "./style.css";
import { brand, bgFor, color, fontUrl, photoUrls, rgb, type Logo } from "./brand";
import { downloadPng, downloadSvg, logoSvg } from "./logos";
import { mountStudio, studioHtml } from "./studio";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// ---------- Tokens uit brand.json naar CSS ----------
function applyTokens() {
  const root = document.documentElement.style;
  brand.colors.forEach((c) => root.setProperty(`--c-${c.id}`, c.hex));
  const { heading } = brand.fonts;
  const faces = [
    { url: fontUrl(heading.file), style: "normal" },
    { url: heading.italic ? fontUrl(heading.italic) : "", style: "italic" },
  ].filter((f) => f.url);
  const css = faces
    .map((f) => `@font-face{font-family:"${heading.family}";src:url(${f.url}) format("woff2");font-weight:${heading.weights[0]} ${heading.weights[1]};font-style:${f.style};font-display:swap}`)
    .join("");
  const style = document.createElement("style");
  style.textContent = css + `:root{--font-heading:"${heading.family}",Georgia,serif;--font-body:"${brand.fonts.body.family}",Georgia,serif}`;
  document.head.append(style);
  document.title = `${brand.name} · Merkgids`;
}

// ---------- Kleine helpers ----------
const sections = [
  ["start", "Start"],
  ["logo", "Logo"],
  ["kleur", "Kleur"],
  ["type", "Type"],
  ["beeld", "Beeld"],
  ["stem", "Stem"],
  ["studio", "Studio"],
] as const;

const pairStyle = (bg: string, fg: string) => `background:${color(bg).hex};color:${color(fg).hex}`;

function toast(msg: string) {
  const t = document.querySelector<HTMLElement>(".toast")!;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(Number(t.dataset.timer));
  t.dataset.timer = String(setTimeout(() => t.classList.remove("show"), 1600));
}

// ---------- Secties ----------
function nav() {
  return `<nav class="nav" aria-label="Hoofdmenu">
    <a class="nav-brand" href="#start">${logoSvg(brand.logos[0], "creme")}<span>${esc(brand.name)}</span></a>
    <ul>${sections.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join("")}</ul>
  </nav>`;
}

function hero() {
  const stempel = brand.logos.find((l) => l.id === "stempel") ?? brand.logos[0];
  return `<header id="start" class="hero">
    <div class="wrap hero-grid">
      <div>
        <p class="kicker">Merkgids</p>
        <h1>${esc(brand.name)}</h1>
        <p class="lead">Alles wat je nodig hebt om een post, poster of flyer te maken die er meteen uitziet als Vinchem. Pak een logo, kies een kleur, en ga.</p>
        <p class="hero-links"><a class="btn" href="#logo">Logo downloaden</a><a class="btn ghost" href="#studio">Zelf een post maken</a></p>
      </div>
      <div class="hero-stempel" aria-hidden="true">${logoSvg(stempel, "creme")}</div>
    </div>
  </header>`;
}

function logoCard(logo: Logo) {
  const first = logo.colorways[0];
  return `<article class="logo-card" data-logo="${logo.id}" data-color="${first}">
    <div class="logo-stage" style="background:${color(bgFor(first)).hex}">${logoSvg(logo, first)}</div>
    <div class="logo-body">
      <h3>${esc(logo.label)}</h3>
      ${logo.note ? `<p>${esc(logo.note)}</p>` : ""}
      <div class="swatches" role="radiogroup" aria-label="Kleurvariant ${esc(logo.label)}">
        ${logo.colorways
          .map((c, i) => `<button role="radio" aria-checked="${i === 0}" data-colorway="${c}" title="${esc(color(c).name)}" style="background:${color(c).hex}"><span>${esc(color(c).name)}</span></button>`)
          .join("")}
      </div>
      <p class="colorway-label">Variant: <strong>${esc(color(first).name)}</strong> · op ${esc(color(bgFor(first)).name.toLowerCase())}</p>
      <div class="dl">
        <button class="btn small" data-dl="png">Download PNG</button>
        <button class="btn small ghost" data-dl="svg">Download SVG</button>
      </div>
      <p class="minsize">Minimaal ${logo.minWidth} px breed op schermen.</p>
    </div>
  </article>`;
}

function logoSection() {
  const dos = brand.dosDonts.filter((d) => d.do);
  const donts = brand.dosDonts.filter((d) => !d.do);
  return `<section id="logo" class="section">
    <div class="wrap">
      <p class="kicker">01</p>
      <h2>Logo</h2>
      <p class="intro">Kies een kleurvariant die past bij de achtergrond. Je downloadt precies wat je ziet.</p>
      <div class="logo-grid">${brand.logos.map(logoCard).join("")}</div>

      <div class="which">
        <h3>Welk bestand gebruik ik?</h3>
        <dl>
          <div><dt>PNG</dt><dd>Voor Word, PowerPoint, WhatsApp, social media en Canva. Werkt overal.</dd></div>
          <div><dt>SVG</dt><dd>Voor drukwerk, de drukker en de website. Blijft scherp op elk formaat.</dd></div>
          <div class="never"><dt>Nooit</dt><dd>Screenshots, logo's van Google Afbeeldingen of een oude versie uit je mail.</dd></div>
        </dl>
      </div>

      <div class="dodont">
        <div class="do"><h3>Wel doen</h3><ul>${dos.map((d) => `<li>${esc(d.text)}</li>`).join("")}</ul></div>
        <div class="dont"><h3>Niet doen</h3><ul>${donts.map((d) => `<li>${esc(d.text)}</li>`).join("")}</ul></div>
      </div>
    </div>
  </section>`;
}

function colorSection() {
  const shown = brand.colors.filter((c) => c.ratio > 0);
  const cards = brand.colors
    .map((c) => {
      const [r, g, b] = rgb(c.hex);
      const fg = brand.pairs.find((p) => p.bg === c.id)?.fg ?? (c.id === "zwart" ? "wit" : "zwart");
      const fgHex = c.id === "zwart" ? color("wit").hex : color(fg).hex;
      const values = [
        ["HEX", c.hex.toUpperCase()],
        ["RGB", `${r}, ${g}, ${b}`],
        ["CMYK", c.cmyk ?? ""],
      ];
      return `<article class="color-card">
        <div class="chip" style="background:${c.hex};color:${fgHex}"><span>${esc(c.name)}</span></div>
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

  const bar = shown
    .map((c) => `<div style="flex:${c.ratio};background:${c.hex}" title="${esc(c.name)} ${Math.round(c.ratio * 100)}%"><span style="color:${color(brand.pairs.find((p) => p.bg === c.id)?.fg ?? "zwart").hex}">${Math.round(c.ratio * 100)}%</span></div>`)
    .join("");
  const legend = shown.map((c) => `<li><i style="background:${c.hex}"></i>${esc(c.name)} ${Math.round(c.ratio * 100)}%</li>`).join("");

  const pairs = brand.pairs
    .map((p) => `<li style="${pairStyle(p.bg, p.fg)}"><strong>Aa</strong><span>${esc(color(p.fg).name)} op ${esc(color(p.bg).name.toLowerCase())}</span></li>`)
    .join("");

  return `<section id="kleur" class="section alt">
    <div class="wrap">
      <p class="kicker">02</p>
      <h2>Kleur</h2>
      <p class="intro">Groen is de Vinchem-kleur. Blauw en lichtblauw zijn accenten, zand, crème en wit geven rust. Klik op een waarde om hem te kopiëren.</p>
      <div class="color-grid">${cards}</div>

      <h3 class="sub">Hoeveel van elke kleur</h3>
      <div class="ratio-bar" role="img" aria-label="Verhouding kleuren">${bar}</div>
      <ul class="legend">${legend}</ul>

      <h3 class="sub">Deze combinaties mogen</h3>
      <p class="intro small">Alleen deze paren zijn goed leesbaar (WCAG AA). Andere combinaties kan de studio niet maken.</p>
      <ul class="pairs">${pairs}</ul>
    </div>
  </section>`;
}

function typeSection() {
  const f = brand.fonts.heading;
  return `<section id="type" class="section">
    <div class="wrap">
      <p class="kicker">03</p>
      <h2>Typografie</h2>
      <p class="intro">Eén lettertype voor alles: ${esc(f.family)}. Klassiek, warm en goed leesbaar. Koppen vet, tekst normaal.</p>
      <div class="type-grid">
        <div class="specimen">
          <p class="aa">Aa</p>
          <p class="family">${esc(f.family)}</p>
          <p class="glyphs">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789 &amp;!?€</p>
        </div>
        <ul class="weights">
          ${[
            [900, "Black", "Extra nadruk, spaarzaam"],
            [700, "Bold", "Koppen"],
            [500, "Medium", "Kleine regel boven, knoppen"],
            [400, "Regular", "Lopende tekst, data, tijden"],
          ]
            .map(([w, n, u]) => `<li><span class="w" style="font-weight:${w}">Zomerkamp</span><span class="meta">${w} · ${n}<br><em>${u}</em></span></li>`)
            .join("")}
          <li><span class="w" style="font-style:italic">Zomerkamp</span><span class="meta">Italic<br><em>Citaten, accenten</em></span></li>
        </ul>
      </div>

      <h3 class="sub">Zo bouw je een tekst op</h3>
      <div class="hierarchy" style="${pairStyle("groen", "creme")}">
        <p class="h-kicker">Zaterdag 14 juni</p>
        <p class="h-head">Haselünne</p>
        <p class="h-sub">We gaan op Zomerkamp naar Duitsland</p>
        <p class="h-body">Vertrek 9.00 uur bij het clubhuis. Opgeven kan tot 1 juni.</p>
      </div>
      <ol class="hier-legend">
        <li><strong>Kleine regel boven</strong> Datum of soort activiteit. Medium.</li>
        <li><strong>Kop</strong> 1 tot 3 woorden. Bold, groot.</li>
        <li><strong>Subregel</strong> Wat gaan we doen? Regular.</li>
        <li><strong>Details</strong> Tijd, plek, opgeven. Klein.</li>
      </ol>
      <p class="note">De vaste groottes per formaat (Instagram, story, poster) leggen we vast in de studio.</p>
    </div>
  </section>`;
}

function imageSection() {
  const stempel = brand.logos.find((l) => l.id === "stempel") ?? brand.logos[0];
  const tiles = photoUrls.length
    ? photoUrls.map((u) => `<figure class="photo"><img src="${u}" alt=""></figure>`).join("")
    : Array.from({ length: 4 }, (_, i) => `<figure class="photo placeholder"><span>Foto ${i + 1}<br><small>volgt</small></span></figure>`).join("");
  return `<section id="beeld" class="section alt">
    <div class="wrap">
      <p class="kicker">04</p>
      <h2>Beeld</h2>
      <p class="intro">Echte foto's van onze eigen opkomsten en kampen. Dichtbij, buiten, in actie. Geen stockfoto's.</p>
      <div class="photo-grid">${tiles}</div>

      <h3 class="sub">Foto en stempel</h3>
      <div class="demo-row">
        ${[
          ["blauw", "creme", "Haselünne", "We gaan op Zomerkamp naar Duitsland", "a", "wit"],
          ["groen", "creme", "Boerenkooltocht", "2026", "b", "creme"],
          ["zand", "groen", "Nog 8 dagen", "En dan gaan we op Zomerkamp!", "c", "groen"],
        ]
          .map(
            ([bg, fg, h, s, v, sf]) => `<figure class="demo demo-${v}" style="background:${color(bg).hex};color:${color(fg).hex}">
              <div class="demo-photo"></div>
              <div class="demo-text"><p class="dh">${h}</p><p class="ds" style="color:${color(sf).hex}">${s}</p></div>
              <div class="demo-stempel">${logoSvg(stempel, fg)}</div>
            </figure>`,
          )
          .join("")}
      </div>
      <ul class="rules">
        <li>De foto is altijd een blok. Er blijft altijd een stuk effen vlak over.</li>
        <li>Tekst staat op het vlak, nooit direct op de foto.</li>
        <li>De stempel staat half over de rand van de foto.</li>
      </ul>
    </div>
  </section>`;
}

function voiceSection() {
  const v = brand.voice;
  return `<section id="stem" class="section">
    <div class="wrap">
      <p class="kicker">05</p>
      <h2>Stem</h2>
      ${v.draft ? `<p class="draft">Concept, nog niet vastgesteld</p>` : ""}
      <p class="intro">Zo klinken we: als een enthousiaste leider die ouders en kinderen persoonlijk uitnodigt.</p>
      <ol class="voice-rules">${v.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>
      <div class="examples">${v.examples
        .map(
          (e) => `<div class="example">
            <p class="good"><span>Zo</span>${esc(e.goed)}</p>
            ${e.liever ? `<p class="bad"><span>Liever niet</span>${esc(e.liever)}</p>` : ""}
          </div>`,
        )
        .join("")}</div>
    </div>
  </section>`;
}

function studioSection() {
  return `<section id="studio" class="section studio">
    <div class="wrap">
      <p class="kicker">06</p>
      <h2>Studio</h2>
      <p class="intro">Maak zelf een post. Vul de tekst in, kies eventueel een foto en klik op een variant. Kleuren, letters en plek liggen vast, zodat het altijd Vinchem blijft.</p>
      <div id="studio-app">${studioHtml()}</div>
    </div>
  </section>`;
}

// ---------- Interactie ----------
function wire() {
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

}

applyTokens();
document.querySelector("#app")!.innerHTML =
  nav() + hero() + "<main>" + logoSection() + colorSection() + typeSection() + imageSection() + voiceSection() + studioSection() + "</main>" +
  `<footer class="foot"><div class="wrap">${esc(brand.name)} · Merkgids · Studio 2.0</div></footer><div class="toast" role="status" aria-live="polite"></div>`;
wire();
mountStudio(document.querySelector<HTMLElement>("#studio-app")!);
