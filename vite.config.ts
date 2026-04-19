import { defineConfig } from "vite";

function resolveBase(): string {
  if (process.env.DEPLOY_BASE && process.env.DEPLOY_BASE.length > 0) {
    return process.env.DEPLOY_BASE;
  }

  if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split("/")[1];
    if (repoName) {
      return `/${repoName}/`;
    }
  }

  return "/";
}

export default defineConfig({
  base: resolveBase(),
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
