// Programmeerbare ingang voor scripts (scripts/make-post.ts): window.merkstudio.render(doc) geeft een PNG.
import { makeVariants, newDoc, type PostDoc } from "./studio/model";
import { renderPng } from "./studio/render";

declare global {
  interface Window {
    merkstudio: {
      brand: string;
      newDoc: typeof newDoc;
      variants: typeof makeVariants;
      render: (doc: PostDoc) => Promise<{ png: string; issues: { msg: string }[] }>;
    };
  }
}

export function exposeApi(brandId: string) {
  window.merkstudio = { brand: brandId, newDoc, variants: makeVariants, render: renderPng };
}
