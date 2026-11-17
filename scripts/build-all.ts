// Bouwt elk merk in brands/ (mappen die met _ beginnen tellen niet mee) naar dist/<merk>/index.html.
import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";

const brands = readdirSync("brands").filter((d) => !d.startsWith("_") && statSync(`brands/${d}`).isDirectory());
let failed = 0;
for (const b of brands) {
  try {
    execSync("npx vite build --logLevel warn", { stdio: "inherit", env: { ...process.env, BRAND: b } });
    console.log(`ok  ${b}  ->  dist/${b}/index.html`);
  } catch {
    failed++;
    console.error(`FOUT  ${b}`);
  }
}
process.exit(failed ? 1 : 0);
