/// <reference types="vite/client" />
declare module "@brand/brand.json" {
  const brand: unknown;
  export default brand;
}

declare const __BUILD__: { time: string; commit: string; dirty: boolean };
