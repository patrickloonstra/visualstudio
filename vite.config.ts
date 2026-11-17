import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";
import { checkBrand } from "./scripts/contrast";

const brand = process.env.BRAND ?? "vinchem";
const brandDir = resolve(import.meta.dirname, "brands", brand);

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
  plugins: [contrastGuard(), viteSingleFile()],
  build: { outDir: `dist/${brand}`, assetsInlineLimit: 100_000_000 },
});
