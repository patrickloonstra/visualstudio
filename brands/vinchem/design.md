# Vinchem: layoutregels voor posts

## Bron

Drie bestaande Instagram-posts van Patrick: "Haselünne", "Boerenkooltocht 2026" en "Nog 8 dagen". De regels hieronder zijn daaruit afgeleid en daarna met Patrick aangescherpt (zie Besluiten). Alles verwijst naar `brand.json`.

## Opbouw van elke post

Vijf vaste lagen, altijd in deze volgorde:

1. **Vlak**: één effen achtergrondkleur over het hele canvas. Geen verloop, geen patroon.
2. **Foto** (optioneel): één rechthoekig blok met rechte hoeken. Nooit full-bleed, er blijft altijd vlak zichtbaar.
3. **Tekst**: kleine regel boven, kop, subregel, details, call to action. Altijd op het vlak, nooit op de foto.
4. **Logo**: het officiële logo (lelie met bruggetje en touw) in een vaste vrije hoek per layout: linksboven, rechtsboven of linksonder.
5. **Stempel**: alleen de ring met "Scouting Vinchem", voor 1/3 of 2/3 over de rand van de foto, af en toe 30° of 60° gedraaid. Mag over tekst vallen.

De studio dwingt dit af: tekst die over de foto of buiten de marge wordt gesleept, maakt de post "Niet on brand" en blokkeert de download.

## Kleur

| Thema | Vlak | Kop | Tekst | Stempel |
|---|---|---|---|---|
| Groen (primair) | groen | crème | crème | crème |
| Blauw | blauw | crème | wit | crème |
| Zand | zand | groen | groen | groen |
| Crème | crème | groen | groen | groen |

Groen is de hoofdkleur (55%). In de studio is ongeveer de helft van de varianten groen.

## Typografie

Eén font: Vollkorn.

| Rol | Gewicht | Groottes (IG 4:5) | Regelafstand | Max woorden |
|---|---|---|---|---|
| Kleine regel boven | 500 | Body 34, Small 28 | 1,3 | 6 |
| Kop | 700 | Display 112, H1 96, H2 80, H3 64 | 1,0 | 6 |
| Subregel | 400 | Lead 48, Body 34 | 1,08 | 12 |
| Details | 400 | Body 34, Small 28 | 1,3 | 25 |
| Call to action | 600 | Body 34, Lead 48 | 1,2 | 6 |

- Kop: "Auto" kiest de grootste stap die past. Koppen in hoofdletters zet de studio om naar gewone schrijfwijze.
- Altijd links uitgelijnd.
- Jaartallen en cijfers in de mediaeval-cijfers van Vollkorn (standaard).

## Marges en raster

Basisformaat Instagram 4:5, 1080 × 1350. Buitenmarge 40 px. Foto en tekst blijven binnen de marge.

## Layouts

Posities in px op 1080 × 1350.

| Layout | Foto (x, y, b, h) | Tekstvak (x, y, b, h) | Stempel (midden) | Afgeleid van |
|---|---|---|---|---|
| A. Foto boven | 290, 40, 750, 800 | 40, 880, 820, 430 | 915, 840 (onderrand foto) | Haselünne |
| B. Tekst boven | 150, 340, 640, 970 | 40, 40, 1000, 280 | 790, 1140 (rechterrand foto) | Boerenkooltocht |
| C. Foto rechts | 500, 40, 540, 1080 | 40, 260, 430, 640 | 500, 1010 (linkerrand foto) | Nog 8 dagen |
| D. Zonder foto | geen | 40, 360, 1000, 700 | 915, 1185 (rechtsonder) | nieuw |
| E. Tekst onder | geen | 40, onder uitgelijnd, 1000, 690 | 935, 145 (rechtsboven) | nieuw |

Met foto toont de studio A, B en C; zonder foto D en E. Varianten die niet passen (tekst te lang voor het tekstvak) laat de studio weg.

## Twee foto's

Upload je twee foto's, dan toont de studio alleen deze layouts (groot + klein, de kleine half over de grote, met een rand van 12 px in de achtergrondkleur):

| Layout | Foto 1 (groot) | Foto 2 (klein) | Logo | Stempel over |
|---|---|---|---|---|
| F. Twee foto's boven | 290, 40, 750, 760 | 110, 540, 300, 380 | linksboven | onderrand foto 1 |
| G. Twee foto's rechts | 500, 40, 540, 1080 | 330, 720, 300, 380 | linksboven | onderrand foto 1 |
| H. Tekst boven, twee foto's | 150, 340, 640, 900 | 600, 870, 360, 430 | rechtsboven | linkerrand foto 1 |

## Merkteken

- Logo (lelie met bruggetje en touw) en stempel (ring met tekst) zijn twee losse elementen. Nooit samengevoegd.
- Op elke post staat de stempel (`postMarks`: alleen `stempel`), plus het logo in een hoek (`postLogo`, `logoSize` 150 px, positie per layout in `logo`). Diameter 210 px (`markSize`), ongeveer 19% van de breedte.
- Half over een fotorand. Zonder foto in een hoek, binnen de marge.
- **De lelie nooit los.** Het touw hoort er altijd omheen. (In de oude posts stond de lelie zonder touw; dat doen we niet meer.)
- Kleur volgt het thema (zie Kleur).

## Formaten

- Instagram/Facebook post 4:5 (1080 × 1350): de layouts hierboven.
- Story 9:16 (1080 × 1920): dezelfde layouts, verticaal geschaald binnen 250 px vrije ruimte boven en onder (daar legt Instagram zijn knoppen overheen). Gebruikt voor Instagram- en Facebook-stories via Buffer.
- Nog niet: vierkant 1:1, header 1,91:1, poster A4 (PDF).

## Besluiten

- 2026-11-20: Naar Buffer: post als concept naar het eigen Buffer-account van Vinchem, in 4:5 (Instagram + Facebook) en 9:16 (story), met een eigen veld "Tekst bij de post". (Patrick)

- 2026-11-18: posts met twee foto's: groot + klein, stempel over de rand van de grote foto. Briefing heeft twee uploadvelden. (Patrick)

- 2026-11-18: op elke post het officiële logo in een vrije hoek (studio kiest per layout: A, C, D, E linksboven; B rechtsboven). Stempel voor 1/3 of 2/3 over de foto (willekeurig) en af en toe 30° of 60° gedraaid; "Stempel anders" kiest een nieuwe stand. Kleine regel boven: datumkiezer ("Zaterdag 21 juni") en vaste woorden. (Patrick)

- 2026-11-18: logo en stempel zijn losse elementen, nooit samengevoegd. Op elke post altijd de stempel. (Logo niet op posts: later dezelfde dag vervangen, zie hierboven.) Pagina compact: direct de studio, stijlgids via een link. (Patrick)
- 2026-11-17: crème op blauw alleen voor koppen (3,8:1); kleine tekst op blauw is wit. (Patrick)
- 2026-11-17: eerste formaat is Instagram 4:5. (Patrick)
- 2026-11-17: foto's overal met rechte hoeken. (Patrick)
- 2026-11-17: de lelie nooit los, altijd met touw. (Patrick)
- 2026-11-17: alleen het beeldmerk, geen woordmerk; Vollkorn voor koppen en tekst. (Patrick)

## Open punten

- Typeschaal (groottes hierboven) is afgeleid van de voorbeelden en nog niet vastgesteld.
- Vrije ruimte rond het logo (voorstel: een kwart van de logobreedte) en minimale printmaat (voorstel: 2,5 cm).
- Regels voor typografie en de tone of voice zijn concepten.
- CMYK-waarden voor drukwerk ontbreken.
- Echte foto's voor de gids en voor "In gebruik".
