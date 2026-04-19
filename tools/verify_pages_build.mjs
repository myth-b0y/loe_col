import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const expectedBase = process.env.DEPLOY_BASE ?? "/loe_col/";
const distDir = path.join(rootDir, "dist");
const indexPath = path.join(distDir, "index.html");
const html = await fs.readFile(indexPath, "utf8");

if (html.includes("/src/main.ts")) {
  throw new Error("dist/index.html still references src/main.ts, which means the production build did not run correctly.");
}

const scriptMatch = html.match(/<script[^>]+src="([^"]+)"/i);
const stylesheetMatch = html.match(/<link[^>]+href="([^"]+)"/i);
const scriptSrc = scriptMatch?.[1] ?? "";
const stylesheetHref = stylesheetMatch?.[1] ?? "";

if (!scriptSrc.startsWith(`${expectedBase}assets/`)) {
  throw new Error(`dist/index.html script src '${scriptSrc}' does not start with the expected Pages base '${expectedBase}assets/'.`);
}

if (!stylesheetHref.startsWith(`${expectedBase}assets/`)) {
  throw new Error(`dist/index.html stylesheet href '${stylesheetHref}' does not start with the expected Pages base '${expectedBase}assets/'.`);
}

if (scriptSrc.startsWith("/assets/") || stylesheetHref.startsWith("/assets/")) {
  throw new Error("dist/index.html still points at root-level /assets paths, which will break on GitHub Pages.");
}

console.log(`GitHub Pages build verified for base ${expectedBase}`);
