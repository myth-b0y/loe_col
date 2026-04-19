import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const deployBase = process.env.DEPLOY_BASE ?? "/loe_col/";

console.log(`Building GitHub Pages bundle with DEPLOY_BASE=${deployBase}`);

const result = spawnSync(process.execPath, [viteCli, "build"], {
  cwd: rootDir,
  stdio: "inherit",
  env: {
    ...process.env,
    DEPLOY_BASE: deployBase,
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
