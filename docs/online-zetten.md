# Online zetten op een gewone PHP-host (Cloud86 / Plesk)

## Variant A: in een map van een bestaande site (bijv. vinchem.nl/contenttool/)

Eén merk, direct in de map:

```bash
npm run build:server -- vinchem
```

Upload de inhoud van `dist/server/` (plus `api/config.php`) naar `httpdocs/contenttool/`. De tool staat dan op `https://vinchem.nl/contenttool/`. De rest van de site merkt er niets van: de tool gebruikt alleen zijn eigen map, en het inlog-cookie geldt alleen voor `/contenttool/`. Posts en foto's komen in `merkstudio-data/` naast de webmap (niet erin).

## Variant B: eigen subdomein met meerdere merken (bijv. merk.patrickloonstra.nl)

Resultaat: `https://merk.patrickloonstra.nl/vinchem/`. Posts en foto's worden als gewone bestanden op de server bewaard (flat file). Geen database, niets te onderhouden. Je Framer-site op patrickloonstra.nl blijft ongemoeid.

## Wat je nodig hebt

- Een webhostingpakket met PHP 8.1 of nieuwer (Cloud86: standaard).
- Toegang tot de DNS van patrickloonstra.nl.

## 1. Subdomein aanmaken (Plesk)

1. Plesk > **Add Subdomain** > naam `merk` (of iets anders). Laat de documentroot staan.
2. Kies bij **PHP Settings** voor PHP 8.1 of nieuwer.
3. SSL: Cloud86 vraagt automatisch een gratis Let's Encrypt-certificaat aan zodra de DNS klopt (kan tot 4 uur duren). Lukt dat niet, vraag het aan via **SSL/TLS Certificates**.

## 2. DNS

Je hoofddomein wijst naar Framer. Laat die records staan. Voeg alleen toe, op de plek waar de DNS van patrickloonstra.nl beheerd wordt:

| Type | Naam | Waarde |
|---|---|---|
| A | `merk` | het IP-adres van je Cloud86-pakket (staat in Plesk/My Cloud86) |

Beheert Cloud86 de DNS zelf, dan maakt Plesk dit record vaak automatisch aan.

## 3. Bestanden maken

```bash
npm run build:server
```

Dit maakt `dist/server/`:

```
index.html          stuurt door naar het merk
vinchem/index.html  de tool
api/index.php       de opslag
api/config.example.php
api/.htaccess
data/.htaccess
```

## 4. Toegangscodes instellen

1. Kopieer `api/config.example.php` naar `api/config.php`.
2. Maak voor elke code een hash:
   ```bash
   php server/tools/hash.php een-goede-code-voor-vinchem
   ```
   Geen PHP op je computer? Gebruik de PHP-terminal in Plesk, of vraag Claude.
3. Zet de hashes in `config.php` bij `vinchem` en `admin_hash`. De codes zelf geef je aan de mensen die mogen inloggen; die staan nergens op de server.

## 5. Uploaden

Plesk > **Files** > de map van het subdomein (bijv. `merk.patrickloonstra.nl/`). Upload de **inhoud** van `dist/server/` plus je `config.php` in `api/`.

De data komt standaard één map hoger: `/var/www/vhosts/patrickloonstra.nl/merkstudio-data/`. Die map maakt de API zelf aan en is niet via internet bereikbaar. Kan dat niet (foutmelding "Kan de opslagmap niet maken"), zet dan in `config.php`: `'data_dir' => __DIR__ . '/../data',`.

## 6. Controleren

- `https://merk.patrickloonstra.nl/` stuurt door naar `/vinchem/` en de studio vraagt om de toegangscode.
- `https://merk.patrickloonstra.nl/api/config.php` geeft een lege pagina of "Forbidden", nooit tekst.
- Maak een post met foto, herlaad: de post staat er nog. Open hem op je telefoon: daar staat hij ook.

## Back-up

Alles staat in `merkstudio-data/`. Een back-up is die map downloaden (Plesk > Files > map > Download/Archive). Cloud86 maakt daarnaast zelf back-ups van je pakket.

## Updaten

Nieuwe versie van de tool: `npm run build:server` en alleen `vinchem/index.html` (en eventueel `api/index.php`) opnieuw uploaden. `config.php` en de data blijven staan.

## Privacy

Er staan foto's op de server, mogelijk van kinderen. Daarom:
- staan posts en foto's buiten de webmap en zijn ze alleen na inloggen op te vragen;
- wordt elke upload gecontroleerd op een echte JPG, PNG of WebP;
- wordt na 10 foute inlogpogingen per kwartier geblokkeerd.

Spreek met Vinchem af wie de toegangscode krijgt, en wissel hem als iemand stopt (nieuwe hash in `config.php`).

## Variant C: via git naar dev.patrickloonstra.nl (zo staat het nu)

Plesk (Cloud86) publiceert de privé-repo `patrickloonstra/dev` naar `dev.patrickloonstra.nl`. De tool staat in `dev/vinchem/`.

Bijwerken na een wijziging in deze repo:

```bash
npm run build:server -- vinchem
```

Kopieer daarna de inhoud van `dist/server/` naar `vinchem/` in de repo `dev` en houd daarbij `vinchem/api/config.php` intact. Commit en push naar `main`. Plesk haalt de wijziging op via de webhook, of met **Pull updates** in Plesk > Git.

Data staat op `/var/www/vhosts/patrickloonstra.nl/merkstudio-data/` en wordt door een publicatie niet aangeraakt.
