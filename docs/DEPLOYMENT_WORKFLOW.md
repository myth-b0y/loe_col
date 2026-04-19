# Deployment Workflow

This project has two valid browser targets:

1. Localhost development and preview
2. GitHub Pages at `https://myth-b0y.github.io/loe_col/`

They are not the same build target.

## Build Targets

- Local dev: `npm run dev`
  - Uses Vite dev server
  - Base path: `/`
- Local preview: `npm run build` then `npm run preview`
  - Uses the normal production bundle for localhost testing
  - Output folder: `dist/`
  - Base path: `/`
- GitHub Pages build: `npm run build:pages`
  - Uses the GitHub Pages subpath base
  - Output folder: `dist/`
  - Base path: `/loe_col/`

## Publish Target

GitHub Pages is published by the GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

That workflow:

- installs dependencies with `npm ci`
- runs `npm run build:pages`
- runs `npm run verify:pages-build`
- uploads `dist/` as the Pages artifact
- deploys that artifact to the GitHub Pages site

## Release Checklist

1. Run `npm run build`
2. Run `npm run build:pages`
3. Run `npm run verify:pages-build`
4. Commit the changes
5. Push `main`
6. Wait for the `Deploy to GitHub Pages` workflow to finish
7. Verify `https://myth-b0y.github.io/loe_col/` shows the expected build number

## Why This Exists

Local preview can look correct even when the GitHub Pages build would fail, because GitHub Pages serves the app from `/loe_col/` instead of `/`.

The explicit Pages build and verification steps are here to catch that mismatch before publish.
