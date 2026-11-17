import "./style.css";
import { exposeApi } from "./api";
import { brand, color, fontUrl } from "./brand";
import { guideHtml, ui, wireGuide } from "./guide";
import { mountStudio, studioHtml } from "./studio/ui";

// Tokens uit brand.json naar CSS: merkkleuren (--c-*), paginarollen (--primary e.d.) en fonts.
function applyTokens() {
  const root = document.documentElement.style;
  brand.colors.forEach((c) => root.setProperty(`--c-${c.id}`, c.hex));
  const roles = ui();
  const map: Record<string, string> = {
    "--primary": roles.primary, "--on-primary": roles.onPrimary, "--surface": roles.surface, "--paper": roles.paper,
    "--line": roles.line, "--ink": roles.ink, "--highlight": roles.highlight,
  };
  Object.entries(map).forEach(([k, id]) => root.setProperty(k, color(id).hex));

  const faces: string[] = [];
  const seen = new Set<string>();
  for (const f of [brand.fonts.heading, brand.fonts.body]) {
    for (const [file, style] of [[f.file, "normal"], [f.italic, "italic"]] as const) {
      const url = file ? fontUrl(file) : "";
      if (!url || seen.has(url)) continue;
      seen.add(url);
      faces.push(`@font-face{font-family:"${f.family}";src:url(${url}) format("woff2");font-weight:${f.weights[0]} ${f.weights[1]};font-style:${style};font-display:swap}`);
    }
  }
  const style = document.createElement("style");
  style.textContent = faces.join("") + `:root{--font-heading:"${brand.fonts.heading.family}",Georgia,serif;--font-body:"${brand.fonts.body.family}",Georgia,serif}`;
  document.head.append(style);
  document.title = `${brand.name} · Merkgids`;
}

applyTokens();
document.querySelector("#app")!.innerHTML = guideHtml(studioHtml());
wireGuide();
mountStudio(document.querySelector<HTMLElement>("#studio-app")!);
exposeApi(brand.short.toLowerCase());
