// PDF.js needs CJK character maps and fallback fonts for real thesis PDFs.
import { cp, mkdir } from "node:fs/promises";
const target = new URL("../public/pdfjs/", import.meta.url);
await mkdir(target, { recursive: true });
for (const folder of ["cmaps", "standard_fonts", "wasm"])
  await cp(
    new URL(`../node_modules/pdfjs-dist/${folder}/`, import.meta.url),
    new URL(`${folder}/`, target),
    { recursive: true },
  );
await cp(
  new URL("../node_modules/pdfjs-dist/LICENSE", import.meta.url),
  new URL("LICENSE", target),
);
