// Maakt posts uit een map met post.json (+ foto), zonder de studio te openen.
//
//   npm run post -- brands/vinchem/posts/2026-06-vlotten
//
// post.json:
//   { "type": "opkomst", "format": "ig45",
//     "fields": { "kicker": "", "head": "", "sub": "", "details": "", "cta": "" },
//     "photo": "foto.jpg", "photoPos": { "x": 50, "y": 50, "zoom": 1 },
//     "layout": "a", "theme": "groen",          <- layout/theme optioneel
//     "mark": "stempel-logo" }                  <- merkteken optioneel (brand.json > postMarks)
//
// Zonder layout/theme: tot 6 passende varianten (variant-1.png ...). Met: één post.png.
// Schrijft ook <map>.merkstudio.json: open die in de studio (Mijn posts > Open bestand) om verder te bewerken.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { createRequire } from "node:module";

// Playwright via require: werkt met een lokale én een globale installatie.
type Page = {
  on(ev: "pageerror", fn: (e: Error) => void): void;
  goto(url: string): Promise<unknown>;
  waitForFunction(fn: () => boolean): Promise<unknown>;
  evaluate<A, R>(fn: (arg: A) => Promise<R>, arg: A): Promise<R>;
};
const { chromium } = createRequire(import.meta.url)("playwright") as {
  chromium: { launch(): Promise<{ newPage(): Promise<Page>; close(): Promise<void> }> };
};
type Rendered = { doc: { layout: string; theme: string }; png: string; issues: { msg: string }[] };
type Input = { type: string; format?: string; mark?: string; fields: Record<string, string>; photo?: string; photoPos?: object; layout?: string; theme?: string };

const dir = resolve(process.argv[2] ?? "");
const brand = process.env.BRAND ?? dir.split("/brands/")[1]?.split("/")[0] ?? "vinchem";
const html = resolve("dist", brand, "index.html");
if (!existsSync(join(dir, "post.json"))) throw new Error(`Geen post.json in ${dir}`);
if (!existsSync(html)) throw new Error(`Eerst bouwen: BRAND=${brand} npm run build`);

const input: Input = JSON.parse(readFileSync(join(dir, "post.json"), "utf8"));
const mime: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const photo = input.photo
  ? `data:${mime[extname(input.photo).toLowerCase()] ?? "image/jpeg"};base64,${readFileSync(join(dir, input.photo)).toString("base64")}`
  : null;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("file://" + html);
await page.waitForFunction(() => !!window.merkstudio);

const result: Rendered[] = await page.evaluate(
  async ({ input, photo }: { input: Input; photo: string | null }) => {
    const ms = window.merkstudio;
    const base = ms.newDoc(input.type, input.fields);
    if (input.format) base.format = input.format;
    if (input.mark) base.mark = input.mark;
    base.photo = photo ? { src: photo, x: 50, y: 50, zoom: 1, ...input.photoPos } : null;
    const candidates = input.layout ? [{ ...base, layout: input.layout, theme: input.theme ?? base.theme }] : ms.variants(base);
    const out: Rendered[] = [];
    for (const doc of candidates) {
      const r = await ms.render(doc);
      if (input.layout || r.issues.length === 0) out.push({ doc, ...r });
      if (out.length >= (input.layout ? 1 : 6)) break;
    }
    return out;
  },
  { input, photo },
);
await browser.close();
if (errors.length) console.error(errors.join("\n"));

const slug = basename(dir);
result.forEach((r, i) => {
  const name = input.layout ? "post.png" : `variant-${i + 1}.png`;
  writeFileSync(join(dir, name), Buffer.from(r.png.split(",")[1], "base64"));
  const label = `${r.doc.layout}/${r.doc.theme}`;
  console.log(`${r.issues.length ? "LET OP" : "ok"}  ${name}  (${label})${r.issues.map((x) => "\n      " + x.msg).join("")}`);
});
if (!result.length) console.log("Geen enkele variant past. Maak de tekst korter.");
writeFileSync(
  join(dir, `${slug}.merkstudio.json`),
  JSON.stringify({ app: "merkstudio", brand, exported: new Date().toISOString(), posts: result.map((r, i) => ({ ...r.doc, id: `${slug}-${i + 1}` })) }),
);
console.log(`Bewerkbaar bestand: ${join(dir, slug + ".merkstudio.json")}`);
