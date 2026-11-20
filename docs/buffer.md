# Posts als concept naar Buffer

Met **Naar Buffer** (onder de post in de studio) gaat een post in één keer als concept naar Buffer:

- Instagram-post en Facebook-post: 4:5 (1080 × 1350)
- Instagram-story (en eventueel Facebook-story): 9:16 (1080 × 1920)

Alles komt als **concept** in Buffer. Daar keurt iemand het goed en plant het in. De tool zet nooit zelf iets online.

## Eenmalig instellen (door het merk, bijv. Vinchem)

1. Maak een (gratis) account op buffer.com, op het e-mailadres van de vereniging.
2. Koppel de kanalen: **Instagram** (bij voorkeur een zakelijk of creator-account; een persoonlijk profiel werkt alleen via een herinnering op de telefoon) en de **Facebook-pagina**.
3. Ga naar **Settings > API** (publish.buffer.com/settings/api) en maak een API-sleutel.
4. Geef de sleutel aan Patrick via een veilige weg (niet in een groepsapp).

## Eenmalig instellen (door Patrick)

Zet de sleutel in een apart bestand `merkstudio-secrets.php`, **naast** de webmap (dus niet erin). Bij dev.patrickloonstra.nl is dat `/var/www/vhosts/patrickloonstra.nl/merkstudio-secrets.php`, in dezelfde map als `merkstudio-data/`. Git-publicaties raken dit bestand nooit aan, en het is niet via internet bereikbaar.

```php
<?php
return [
    'buffer' => [
        'vinchem' => ['api_key' => 'DE_SLEUTEL'],
    ],
];
```

Zet de sleutel niet in `api/config.php`: dat bestand staat in git en wordt bij elke publicatie overschreven.

`organization_id` mag leeg blijven: de tool neemt dan de eerste organisatie van het account. De knop **Naar Buffer** verschijnt pas als de sleutel er staat.

## Hoe het werkt

1. De studio maakt de post in 4:5 en 9:16 (zelfde tekst, layout en kleuren). Een formaat dat niet on brand is, wordt overgeslagen.
2. De PNG's komen op de server in `exports/` naast de tool, met een onraadbare naam (32 tekens) en een vast adres dat op `.png` eindigt. Buffer haalt ze daar op als de post wordt gepubliceerd, dus **verwijder deze map niet**. Zoekmachines worden geweerd.
3. Per gekozen kanaal maakt de server een concept via de Buffer API (`createPost` met `saveToDraft: true`). De API-sleutel blijft op de server.

## Grenzen

- Het gratis Buffer-plan heeft maximaal 3 kanalen en 10 ingeplande posts per kanaal.
- Buffer staat 150 verzoeken per kwartier toe. Eén keer "Naar Buffer" kost 2 tot 6 verzoeken.
- Testen kan zonder echte posts: de server spreekt alleen `https://api.buffer.com` aan, of een testadres via `'endpoint' => '...'` in de config.
