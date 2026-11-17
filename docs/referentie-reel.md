# Referentie: Instagram-reel

Patrick wees op een reel van @youraiauntie (november 2026) als voorbeeld voor de werking van de tool. De reel zelf kon niet bekeken worden; Patrick gaf een frame-voor-frame samenvatting. Kern:

- Eén HTML-pagina (offline, fonts en SVG's ingebed) met een brandguide en een ingebouwde content studio.
- Gids: logo met kleurvarianten en downloads, "Welk bestand gebruik ik?", vrije ruimte, fout-voorbeelden met CSS op de echte SVG, kleurkaarten met rol, verhoudingsbalk, combinaties per achtergrond (berekend met WCAG), type, foto's, stem, in gebruik, "Maak iets", "Neem alles mee" (zip).
- Studio: briefing-modal ("Waar gaat de post over?"), 6 varianten, "Kleuren schudden", editor met canvas en inspectiepaneel (woorden, stijl, regelkaart met woordenteller, grootte als stappen, kleur met uitgegrijsde verboden combinaties, uitlijning), "On brand"-badge, ongedaan maken, PNG op ware grootte.
- Principes: één bron van waarheid, contrast berekend, stijlen in plaats van vrije opmaak, regels zichtbaar en afgedwongen, de studio schrijft niet, alles offline in één bestand.

Bewust niet overgenomen:
- **Dekking, blend-modus en draaien** in de editor: die laten een gebruiker het merk stukmaken. Dat botst met het doel van deze tool.
- **Vrij schalen met handvatten**: grootte gaat via de stappen van de typeschaal.
- **Gecentreerde of rechtse uitlijning** voor Vinchem: het merk lijnt altijd links uit (`brand.json > align`).
