import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { checkBrand } from "./scripts/contrast";

const brand = process.env.BRAND ?? "vinchem";
const brandDir = resolve(import.meta.dirname, "brands", brand);

// Versie-info voor de footer: wanneer gebouwd en vanaf welke commit.
function gitInfo() {
  try {
    const commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim() !== "";
    return { commit, dirty };
  } catch {
    return { commit: "", dirty: false };
  }
}
const build = { time: new Date().toISOString(), ...gitInfo() };

// Laat build en dev-server falen als een toegestaan kleurpaar WCAG AA niet haalt.
function contrastGuard(): Plugin {
  return {
    name: "merkstudio-contrast",
    buildStart() {
      const { errors } = checkBrand(brandDir);
      if (errors.length) this.error("\n" + errors.join("\n"));
    },
  };
}

export default defineConfig({
  resolve: { alias: { "@brand": brandDir } },
  define: { __BRAND_ID__: JSON.stringify(brand), __BUILD__: JSON.stringify(build) },
  plugins: [contrastGuard(), viteSingleFile()],
  build: { outDir: `dist/${brand}`, assetsInlineLimit: 100_000_000 },
});
