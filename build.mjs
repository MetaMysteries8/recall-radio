import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
await mkdir(`${root}/dist`, { recursive: true });
for (const file of [
  "index.html",
  "app.js",
  "core.js",
  "library.js",
  "search.js",
  "style.css",
  "icon.svg",
  "demo.json",
  "demo.mp3",
  "generation-evidence.json",
  "browser-test-evidence.json",
])
  await copyFile(`${root}/${file}`, `${root}/dist/${file}`);
