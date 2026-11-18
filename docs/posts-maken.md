# Posts maken

Er zijn drie manieren. Ze leveren allemaal hetzelfde op: een post die on brand is, en een bestand waarmee je hem later weer kunt aanpassen.

## 1. Zelf in de studio

Open de merkgids (`dist/<merk>/index.html`) en ga naar **Studio**.

1. **Ik heb een post nodig over…**: kies het soort post en vul de velden in. Heb je al een tekst (mail, WhatsApp)? Plak hem onder "Heb je al een tekst?" en klik **Verdeel over de velden**. De studio verandert geen woorden, hij verdeelt alleen.
2. **Leg het op**: je krijgt tot zes varianten die passen. **Kleuren schudden** geeft dezelfde layouts in andere toegestane kleuren.
3. Klik een variant aan. In de editor klik je op een tekst of de foto om hem aan te passen: woorden, grootte (alleen stappen uit de typeschaal), kleur (alleen toegestane combinaties), positie (slepen). De foto sleep je binnen zijn kader.
4. De badge zegt **On brand ✓** of noemt wat er mis is. Alleen als hij groen is kun je **Download PNG** gebruiken.

**Opslaan gaat vanzelf.** Elke post staat onder **Mijn posts** in deze browser. Wil je verder op een andere computer, of een back-up? Kies **Back-up van alle posts (.json)** en later **Back-up terugzetten**. Een back-up is geen afbeelding; de afbeelding krijg je met **Download PNG** onder de post.

Let op: posts in de browser zijn per browser en per computer. Wie de browsergegevens wist, is ze kwijt. Bewaar belangrijke posts dus ook als bestand.

## 2. Claude maakt ze voor je

Stuur Claude de tekst en de foto('s). Claude zet ze in een map en draait het script:

```
brands/<merk>/posts/<datum-onderwerp>/
  post.json
  foto.jpg
```

```json
{
  "type": "opkomst",
  "fields": {
    "kicker": "Zaterdag 21 juni",
    "head": "Vlotten bouwen",
    "sub": "Wie bouwt het snelste vlot?",
    "details": "10.00 tot 12.00 uur bij het clubhuis",
    "cta": "Geef je op via de app"
  },
  "photo": "foto.jpg"
}
```

```bash
npm run build:all
```

```bash
npm run post -- brands/vinchem/posts/2026-06-vlotten
```

Resultaat in dezelfde map:
- `variant-1.png` tot `variant-6.png`: alleen varianten die on brand zijn.
- `<map>.merkstudio.json`: open dit in de studio (**Mijn posts > Back-up terugzetten**) om een variant verder aan te passen.

Weet je al welke layout en kleur je wilt? Zet `"layout": "a", "theme": "groen"` in `post.json`; dan maakt het script één `post.png`. Optioneel: `"photoPos": { "x": 50, "y": 30, "zoom": 1.2 }` om de foto te verschuiven.

Alles staat in de repo, dus Claude kan een post later aanpassen door `post.json` te wijzigen en het script opnieuw te draaien.

## 3. Uit een bestand

Een `.merkstudio.json` (van de studio of het script) open je in **Mijn posts > Back-up terugzetten**. De posts komen in je lijst en zijn volledig te bewerken.
