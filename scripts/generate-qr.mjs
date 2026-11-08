#!/usr/bin/env node
/**
 * Generate the shop QR code as SVG + PNG into ./qr/.
 *
 * Usage:
 *   npm run qr -- --url=https://yourdomain.com/r/shop --name="Shop Name"
 *
 * Resolution order for the URL:
 *   1. --url flag
 *   2. NEXT_PUBLIC_APP_URL from .env.local plus --slug (default "shop")
 *
 * Prints exact physical sizes so the sticker can be ordered with confidence.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import QRCode from "qrcode";

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    slug: { type: "string", default: "shop" },
    name: { type: "string", default: "shop" },
    size: { type: "string", default: "1024" },
    out: { type: "string", default: "qr" },
  },
  allowPositionals: false,
});

/** Minimal .env.local reader so the script runs without extra dependencies. */
async function readAppUrlFromEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return null;
  const { readFile } = await import("node:fs/promises");
  const contents = await readFile(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*NEXT_PUBLIC_APP_URL\s*=\s*(.+)\s*$/.exec(line);
    if (match?.[1]) return match[1].replace(/^["']|["']$/g, "").trim();
  }
  return null;
}

async function main() {
  const appUrl = values.url ?? (await readAppUrlFromEnv());

  if (!appUrl) {
    console.error(
      "No URL available. Pass --url=https://example.com/r/shop, or set NEXT_PUBLIC_APP_URL in .env.local.",
    );
    process.exit(1);
  }

  if (!appUrl.startsWith("https://")) {
    console.error(
      "The QR URL must use https:// so the shop page is trusted by browsers.",
    );
    process.exit(1);
  }

  const target = values.url ? appUrl : `${appUrl.replace(/\/$/, "")}/r/${values.slug}`;
  const size = Math.min(4096, Math.max(256, Number(values.size) || 1024));
  const outDir = path.resolve(process.cwd(), values.out);

  await mkdir(outDir, { recursive: true });

  const slugSafe =
    String(values.name)
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "shop";

  const options = {
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  };

  const svg = await QRCode.toString(target, { ...options, type: "svg", width: size });
  const png = await QRCode.toBuffer(target, { ...options, type: "png", width: size });

  const svgPath = path.join(outDir, `${slugSafe}-qr.svg`);
  const pngPath = path.join(outDir, `${slugSafe}-qr.png`);

  await writeFile(svgPath, svg, "utf8");
  await writeFile(pngPath, png);

  // A 25mm minimum is the practical floor for reliable phone scanning of a
  // printed code at arm's length.
  const modules = svg.match(/<rect/g)?.length ?? 0;

  console.log(`\nQR code generated\n`);
  console.log(`  Target : ${target}`);
  console.log(`  SVG    : ${svgPath}`);
  console.log(`  PNG    : ${pngPath}  (${size}x${size})`);
  console.log(`\nPrint guidance`);
  console.log(`  Minimum print size : 25 mm square (1000 mil)`);
  console.log(`  Recommended        : 40-50 mm square at the counter`);
  console.log(`  Quiet zone         : keep ~4 modules of white space around the code`);
  console.log(
    `  Test               : scan from 20-30 cm on both Android and iOS before printing\n`,
  );
  if (modules === 0) {
    console.warn("  warning: could not estimate module count; verify the SVG visually\n");
  }
}

main().catch((error) => {
  console.error("QR generation failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
