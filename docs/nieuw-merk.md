# Een nieuw merk toevoegen

Een merk is één map in `brands/`. De code hoeft niet te veranderen.

## Stappen

1. Kopieer de template:
   ```bash
   cp -r brands/_template brands/<merk>
   ```
2. Zet de bestanden in `brands/<merk>/assets/`:
   - `logos/`: SVG's in één kleur. Noteer die kleur als `sourceFill`; de studio kleurt het logo om naar de `colorways`.
   - `fonts/`: `.woff2`-bestanden. Laat `file` leeg om een systeemfont te gebruiken.
   - `photos/`: voorbeeldfoto's voor de gids (optioneel).
3. Vul `brand.json` in (zie hieronder). **Merkbeslissingen vraag je aan Patrick**: kleuren, rollen, verhoudingen, paren, typeschaal.
4. Schrijf `brands/<merk>/design.md` volgens [design-template.md](design-template.md).
5. Controleer en bouw:
   ```bash
   BRAND=<merk> npm run check
   ```
   ```bash
   npm run build:all
   ```
   Resultaat: `dist/<merk>/index.html`, één los bestand met alles erin.

## Wat staat waar in brand.json

| Sleutel | Wat | Wie beslist |
|---|---|---|
| `name`, `short` | Volledige en korte naam (`short` wordt ook bestandsnaam) | Klant |
| `colors` | Kleuren met `role` (achtergrond, accent, rust, tekst), `roleLabel` en `ratio` (aandeel, samen 1) | Patrick |
| `pairs` | Toegestane combinaties `bg`/`fg`. `"use": "large"` = alleen koppen (3:1) | Patrick, check bewaakt WCAG |
| `ui` | Welke merkkleur de gids zelf gebruikt: `primary`, `onPrimary`, `surface`, `paper`, `line`, `ink`, `highlight` | Patrick |
| `fonts` | `heading` en `body`: `family`, `file`, `italic`, `weights`, `use` | Patrick |
| `logos` | Per logo: `kind` (`logo` of `mark`), `file`, `sourceFill`, `colorways`, `minWidth`. Elk logo is één los bestand | Patrick |
| `postMarks` | Keuzes voor het merkteken op een post: één logo, of een logo met een tweede logo in het midden (`inner`, `innerScale`). `scale` = grootte t.o.v. `markSize`. De eerste is standaard | Patrick |
| `clearSpace` | Vrije ruimte rond het logo en minimale printmaat | Patrick |
| `themes` | Kleurthema's voor posts: `bg`, `head`, `text`, `mark`. Eén thema met `"primary": true` | Patrick, check bewaakt de paren |
| `formats` | Formaten met `w`, `h`, `margin`, `markSize` en `layouts` (posities in px op ware grootte) | Uit `design.md` |
| `typeSteps`, `typeScale` | Namen van de groottes en px per formaat | Patrick |
| `styles` | Per tekstrol (`kicker`, `head`, `sub`, `details`, `cta`): font, gewicht, toegestane groottes, max woorden, regels | Patrick |
| `align` | Toegestane uitlijning, bijv. `["left"]` | Patrick |
| `postTypes` | Soorten posts met voorbeeldtekst | Klant |
| `copy`, `voice`, `photoRules`, `dosDonts`, `typeRules` | Teksten in de gids. `"draft": true` toont het label "Voorstel" | Klant + Patrick |

## Wat de check bewaakt

`npm run check` en elke build stoppen als:
- een verplichte sleutel ontbreekt of een kleur-id niet bestaat;
- een logo- of fontbestand ontbreekt;
- een paar of thema WCAG AA niet haalt (4,5:1 tekst, 3:1 alleen koppen);
- een thema een kleurcombinatie gebruikt die niet in `pairs` staat;
- een formaat geen layout met én zonder foto heeft, of een grootte mist in `typeScale`.

Mappen die met `_` beginnen (zoals `_template`) worden niet gebouwd.
