# Tourlo 360 Prototype

Small-scale web 360 real estate tour, modelled on the GHR Callisto 3DVista tour. Built with Next.js (static export) + Photo Sphere Viewer.

## Quick start

```
npm install
npm run fetch:panos   # one-time: downloads 70 test panoramas (needs Python 3.8+)
npm run dev
```

Open http://localhost:3000.

## Build and deploy

```
npm run build     # static site in out/
npm run preview   # check it on http://localhost:4173
```

Upload `out/` to any static host (Netlify, Vercel, S3). For a sub-path, build with `NEXT_PUBLIC_BASE_PATH=/your-path`. Remove `out/assets/panos/` first if the deploy is public (see Notes). Add `--cube` mode with `npm run fetch:panos:cube` if you also want the 512px cube faces.

## What works

- Scene menu by category with thumbnails
- Current / Future toggle on aerial views
- Contact, Location, Share link, Auto-rotate
- Deep links (`#scene=40_drawing-room`)
- Mobile layout

## Notes

- Test panoramas are third-party (GHR Infra / 360EYE): internal testing only, never committed (gitignored).
- Project brief and roadmap for Claude Code: `CLAUDE.md`.
