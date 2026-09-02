// Optional: turn public/icons/icon.svg into PNGs for the best home-screen icon on
// iOS and older Android, and rewrite the manifest to reference them.
//
//   npm i -D sharp && npm run gen:icons
//
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(root, "public", "icons", "icon.svg");
const manifestPath = path.join(root, "public", "manifest.webmanifest");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp is not installed. Run:  npm i -D sharp");
  process.exit(1);
}

const svg = readFileSync(svgPath);
const targets = [
  { file: "icon-192.png", size: 192, purpose: "any" },
  { file: "icon-512.png", size: 512, purpose: "any" },
  { file: "icon-maskable-512.png", size: 512, purpose: "maskable", pad: 0.12 },
  { file: "apple-touch-icon.png", size: 180, purpose: "apple" },
];

for (const t of targets) {
  let img = sharp(svg).resize(t.size, t.size);
  if (t.pad) {
    const inner = Math.round(t.size * (1 - t.pad * 2));
    img = sharp({
      create: { width: t.size, height: t.size, channels: 4, background: "#1F6F43" },
    }).composite([{ input: await sharp(svg).resize(inner, inner).png().toBuffer() }]);
  }
  await img.png().toFile(path.join(root, "public", "icons", t.file));
  console.log("wrote", t.file);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.icons = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("updated manifest.webmanifest");
