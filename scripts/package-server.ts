// Zet alles klaar om te uploaden naar een gewone PHP-host (bijv. Cloud86/Plesk):
//
//   dist/server/
//     index.html            kiest het merk (of stuurt door als er één is)
//     <merk>/index.html     de tool per merk
//     api/index.php         opslag (flat file), config.example.php
//     api/.htaccess
//     data/.htaccess        alleen nodig als de data in de webmap moet staan
//
// Eén merk direct in de hoofdmap (bijv. vinchem.nl/contenttool/):
//   npm run build:server -- vinchem
//
// Draai eerst: npm run build:all
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const out = "dist/server";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const single = process.argv[2];
const brands = readdirSync("dist").filter((d) => d !== "server" && existsSync(`dist/${d}/index.html`));
if (!brands.length) throw new Error("Geen gebouwde merken. Draai eerst: npm run build:all");
if (single && !brands.includes(single)) throw new Error(`Merk "${single}" is niet gebouwd. Wel: ${brands.join(", ")}`);
if (single) cpSync(`dist/${single}/index.html`, `${out}/index.html`);
else for (const b of brands) cpSync(`dist/${b}`, `${out}/${b}`, { recursive: true });

cpSync("server/api", `${out}/api`, { recursive: true, filter: (src) => !src.endsWith("config.php") });
// Zoekmachines weghouden van de hele toolmap (pagina, API, foto's). Werkt op Apache/Plesk met mod_headers.
writeFileSync(
  `${out}/.htaccess`,
  `# Interne tool: niet opnemen in zoekmachines.\n<IfModule mod_headers.c>\n  Header set X-Robots-Tag "noindex, nofollow, noimageindex, noarchive"\n</IfModule>\nOptions -Indexes\n`,
);
mkdirSync(`${out}/data`, { recursive: true });
cpSync("server/data/.htaccess", `${out}/data/.htaccess`);
writeFileSync(`${out}/data/index.html`, "");

if (single) {
  console.log(`Klaar: ${out}/ met alleen ${single} in de hoofdmap. Upload de inhoud naar de map waar de tool moet staan.`);
  process.exit(0);
}
const names = brands.map((b) => {
  const j = JSON.parse(readFileSync(`brands/${b}/brand.json`, "utf8"));
  return { id: b, name: j.name as string };
});
writeFileSync(
  `${out}/index.html`,
  names.length === 1
    ? `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${names[0].id}/"><title>${names[0].name}</title><a href="${names[0].id}/">${names[0].name}</a>`
    : `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Merkstudio</title><style>body{font:18px/1.5 system-ui;margin:48px auto;max-width:560px;padding:0 16px}a{display:block;padding:12px 0}</style><h1>Merkstudio</h1>${names.map((n) => `<a href="${n.id}/">${n.name}</a>`).join("")}`,
);
console.log(`Klaar: ${out}/ (${brands.join(", ")}). Upload de inhoud naar de webmap van het subdomein.`);
