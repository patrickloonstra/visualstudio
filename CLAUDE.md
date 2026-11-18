# Merkstudio

Interactieve brandguide plus een vergrendelde content studio, per merk. Eerste testmerk: Scouting Vinchem.
Onderdeel van Studio 2.0 (patrickloonstra.nl): klanten maken zelf uitingen, Patrick bewaakt het merk.

## Doel

Een vrijwilliger of communicatiepersoon zonder designkennis maakt in een paar minuten een post die on-brand is, zonder dat hij het merk kan "stukmaken".

Succes na de eerste test: iemand van Vinchem maakt binnen een week zelf een post met de studio en plaatst die.

## Twee delen

### 1. Brandguide (lezen en downloaden)
- Logo's per variant (primair, met tagline, secundair, beeldmerk), met kleurvarianten-switcher
- Download PNG en origineel SVG per kleurvariant
- Blok "Welk bestand gebruik ik?" (PNG, SVG, nooit: screenshots)
- Do's en don'ts bij het logo (niet uitrekken, niet op drukke foto, enz.)
- Kleurkaarten met rol (achtergrond, accent, tekst), HEX/RGB/CMYK, klik om te kopiëren
- Verhoudingsbalk "Hoeveel van elke kleur"
- Typografie: lettertypes en vaste typeschaal
- Beeld: fotostijl en voorbeelden
- Tone of voice: korte regels plus voorbeeldzinnen
- Navigatie bovenaan: Start, Logo, Kleur, Type, Beeld, Stem, Studio

### 2. Content studio (maken)
- Formulier: formaat, kleine regel boven, grote kop, details, CTA, optionele foto
- Knop "Maak layouts": toont 4 tot 6 varianten, alleen met merkfonts, merkkleuren en beeldmerken
- "Andere kleuren": schudt alleen toegestane kleurcombinaties
- Fijnafstemming: tekst aanpassen, variant kiezen, foto verschuiven. Geen vrije fonts, kleuren of groottes.
- Export als PNG (en PDF voor A4/A3 posters)

## Merkregels die vastliggen (de kern)
- Alleen kleurparen uit `brand.json` > `pairs` zijn toegestaan; elk paar voldoet aan WCAG AA (4.5:1 tekst, 3:1 grote tekst). Build faalt als een paar dat niet haalt.
- Typeschaal ligt vast per formaat; tekst die te lang is krimpt binnen een min/max of de studio geeft een melding ("Kop te lang, maximaal ~8 woorden").
- Logo altijd met vrije ruimte en minimale grootte per formaat.
- Nooit tekst direct op een drukke foto zonder vlak of overlay.

## Formaten (Vinchem)
- Instagram post 4:5 (1080x1350)
- Instagram/WhatsApp story 9:16 (1080x1920)
- Vierkant 1:1 (1080x1080)
- Facebook/website header 1.91:1 (1200x628)
- Poster A4 staand (print, PDF)

## Post-types Vinchem (sjablonen)
- Opkomstaankondiging
- Activiteit of evenement
- Oproep voor leiding of vrijwilligers
- Terugblik met foto's

## Architectuur
- Eén bron per merk: `brands/<merk>/brand.json` plus `brands/<merk>/assets/` (SVG-logo's, fonts, foto's)
- Layouts zijn HTML/CSS-sjablonen die alleen tokens uit `brand.json` gebruiken, nooit hardcoded waarden
- Stack: Vite + TypeScript, zo min mogelijk afhankelijkheden. Export met `html-to-image` (PNG) en print-CSS of `jspdf` (PDF)
- Build levert per merk één zelfstandig HTML-bestand op (`vite-plugin-singlefile`), zodat het ook als los bestand te mailen is
- Deploy: per merk in een map op de eigen site van de klant (Vinchem: `vinchem.nl/contenttool/`, `npm run build:server -- vinchem`), of meerdere merken onder één subdomein (`npm run build:server`)
- Geen accounts en geen database. Wel een optionele flat-file-opslag in PHP (besluit Patrick, 2026-11-18): `server/api/index.php` bewaart posts als JSON en foto's als bestanden, met een toegangscode per merk (`config.php`, niet in git)
- Opslag, twee standen die de tool zelf kiest: online met `api/` ernaast = server; los HTML-bestand = browser (IndexedDB). In beide: export/import als `.merkstudio.json`. Elke post is één `PostDoc` (tekst, foto, layout, thema, aanpassingen)
- Toegangscode Vinchem staat voorlopig uit (`require_code => false` in de config op dev, besluit Patrick 2026-11-18). Wel onvindbaar voor zoekmachines: `noindex`-meta in `index.html`, `X-Robots-Tag` via `.htaccess` in de toolmap en in de API
- Hosting: gewone PHP-host (Cloud86/Plesk), subdomein van patrickloonstra.nl. Zie `docs/online-zetten.md`; `npm run build:server` maakt de uploadmap

## Code (stand na fase 2)
- `src/main.ts`: opstart. Zet kleuren uit `brand.json` als CSS-variabelen: `--c-<id>` en paginarollen `--primary`, `--on-primary`, `--surface`, `--paper`, `--line`, `--ink`, `--highlight` (uit `brand.json > ui`). CSS gebruikt alleen die rollen, nooit merknamen
- `src/guide.ts`: de pagina. Opent direct op de studio ("Maak een post"); `#stijlgids` toont een korte stijlgids (logo's, kleuren, regels, zip). Bewust compact: gebruikers zijn scoutingmensen, geen designers (Patrick, 2026-11-18)
- Fotobank: `#fotobank`, gedeelde voorraad foto's per merk op de server (`api/?action=bank-*`). Kiezen kopieert de foto naar de post. Alleen online
- Posts met twee foto's: layouts met `photo2` (groot + klein); PostDoc heeft `photo2`
- `src/logos.ts`: logo's als losse SVG's; `markSvg` stelt het merkteken op een post samen uit `brand.json > postMarks`
- `src/studio/model.ts` (PostDoc, varianten, tekst verdelen), `render.ts` (post renderen, tekst passend maken, merkregels checken, PNG), `ui.ts` (briefing, varianten, editor, Mijn posts), `store.ts` (IndexedDB en bestand)
- `src/wcag.ts`: contrast, gedeeld door check, gids en studio
- `scripts/contrast.ts`: merkcontrole (structuur, bestanden, WCAG, thema's); draait bij elke build
- `scripts/make-post.ts` (`npm run post -- <map>`): posts maken uit `post.json` + foto, zie `docs/posts-maken.md`
- `scripts/build-all.ts` (`npm run build:all`): elk merk in `brands/` (behalve `_*`)
- Nieuw merk: `docs/nieuw-merk.md`, sjabloon in `brands/_template/`, layoutregels per merk in `brands/<merk>/design.md` (sjabloon: `docs/design-template.md`)

## brand.json (schets)
```json
{
  "name": "Scouting Vinchem",
  "colors": [
    { "id": "primary", "name": "", "hex": "", "role": "accent", "ratio": 0.2 }
  ],
  "pairs": [ { "bg": "primary", "fg": "white" } ],
  "fonts": { "heading": { "family": "", "file": "" }, "body": { "family": "", "file": "" } },
  "typeScale": { "ig45": { "kicker": 32, "headline": [72, 120], "body": 34 } },
  "logos": [
    { "id": "primary", "label": "Primair logo", "file": "logo-primary.svg", "colorways": ["primary", "white", "black"], "minWidth": 160 }
  ],
  "voice": { "rules": [], "examples": [] },
  "dosDonts": []
}
```

## Werkwijze
- Fase 1: brand.json + brandguide-pagina voor Vinchem
- Fase 2: content studio met 1 formaat (IG 4:5) en 2 post-types
- Fase 3: overige formaten en post-types, PNG/PDF-export
- Fase 4: deploy, testen met Vinchem, feedback verwerken
- Fase 5 (pas bij tweede merk): merk-onafhankelijk maken en een nieuw merk toevoegen = alleen een nieuwe map in `brands/`

Stand 2026-11-17: fase 1 en 2 klaar, plus de opbouw voor fase 5 (template, merkcontrole, build per merk; getest met een tijdelijk tweede merk). Studio volgt de referentie-reel (zie `docs/referentie-reel.md`).

## Stijl van werken
- Nederlands in de interface, korte zinnen, geen em-dashes
- Na elke fase: screenshot of preview laten zien en wachten op feedback van Patrick
- Merkbeslissingen (kleuren, paren, typeschaal) nooit zelf verzinnen: vragen aan Patrick
