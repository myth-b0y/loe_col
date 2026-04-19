# LOE_COL

Browser-first prototype for `Legends of EDEN: Champions of Light`.

Current stack:

- Phaser 3
- TypeScript
- Vite

Initial goal:

- Validate desktop and touch input early
- Keep the project easy to deploy to a browser test link
- Leave a clean path for Windows desktop packaging later

Next milestones:

1. Input and movement lab
2. Combat feel prototype
3. First playable loop vertical slice

## Deployment

- Local development: `npm run dev`
- Local production preview: `npm run build` then `npm run preview`
- GitHub Pages build check: `npm run build:pages` then `npm run verify:pages-build`
- Publish to GitHub Pages: push `main` so `.github/workflows/deploy-pages.yml` deploys `dist/`

Detailed deployment notes live in `docs/DEPLOYMENT_WORKFLOW.md`.
