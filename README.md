# Tourlo Residences V2

A separate project-focused residential experience, preserving the original Tourlo demo at commit 86c1d7a7b3588bc8a1f4924334b90b7aa7337e4f. This is an illustrative Mumbai development with sample inventory, representative AI imagery, and indicative plans/pricing.

## What's included

- Guided visit: arrival, amenities, choose a home, step inside, compare; free exploration remains available.
- 16 new coordinated visual assets: paired day/dusk hero, six site scenes, six apartment scenes and two representative balcony views. Optimized mobile textures and thumbnails.
- Recalibrated clickable tower floors, 70 homes across 19 levels, filters and indicative cost sheets.
- Save up to three homes on the current browser and compare plans, sizes, facing, price and availability.
- Browser speech/typed navigation, including guided visit, next/previous stage, save and compare. This is a command-based guide; microphone support depends on browser/device.
- Existing lead fields and gate timing retained. Enquiries are emailed to the team through Resend, with the visitor as reply-to. Failed sends preserve inputs; only a confirmed send unlocks the journey. Request IDs are sent as Resend idempotency keys, so a retry never sends a second email.
- Server endpoint for live inventory from a private Google Sheet, refreshed every 30 seconds.
- Panorama retry UI, stale room-load cancellation, image fallback, keyboard modal focus and mobile layouts.

## Current connection status

Enquiries now go through Resend (`RESEND_API_KEY`, `LEAD_EMAIL_TO`, optional `LEAD_EMAIL_FROM`). The Google Sheets notes below now apply to live inventory only; the Apps Script still supports its `lead` action if enquiries ever need to go to the sheet again.

The private Google Sheets are owned by Nimish and shared with the automation account sudarshanknowsmarketing@gmail.com. The Google web app is deployed and the production connection is configured. Live checks confirmed all 70 homes, a real enquiry save, retry deduplication, and status/price changes followed by restoration. See [setup and verification](integrations/google-sheets/SETUP.md).

The lead gate requires a confirmed save. The temporary preview bypass has been removed, and previous preview sessions no longer unlock the walkthrough.

## Stack

Next.js 16 (App Router) with React 19, deployed on Vercel. Converted from the original Vite build with the experience itself unchanged:

- `app/page.js` renders the static page markup. `app/demo-boot.js` loads the framework-free sales gallery in `lib/demo/` (Three.js tower, 360 viewer, lead gate, voice guide, shortlist) in the browser after hydration.
- `app/api/leads` and `app/api/inventory` are Route Handlers (Vercel functions). Their logic lives in `lib/server/` so it is unit tested without a server.
- Images and panoramas live in `public/assets/`, runtime JSON in `public/data/`. File names are unchanged, so real project panoramas can be swapped in using the same names.
- `next.config.mjs` sets the iframe, sensor/microphone and cache headers that used to live in `vercel.json`.

## Development

Use Node 24 LTS and `npm ci`.

- `npm run dev`: development server with the API routes at http://127.0.0.1:4173 (no separate API process any more).
- `npm run build` then `npm start`: production build and server on the same port.
- `npm test`: lead validation, the lead handler against a mocked Resend API (payload, escaping, idempotency, failures), inventory handler and merging, voice parser and simulated Sheets bridge tests.
- `npm run test:browser`: desktop/mobile journey, lead retry/resume, shortlist persistence, refreshed inventory, all active rooms, missing-image recovery and tower fallback. Run `npm run build` first; Playwright starts `npm start` itself. Uses installed Chrome by default; set `PW_CHANNEL=msedge` to use Edge, or `TEST_BASE_URL` to test a deployed URL.
- `npm run inventory` regenerates `public/data/inventory.json`; `npm run panos` regenerates mobile panoramas and thumbnails from `public/assets/panos/`.

Browser lead/inventory tests mock remote responses, and the Resend and Sheets tests use simulated services; none of them is evidence of a live integration. After adding the Resend variables, submit one labelled test enquiry on the deployed site and confirm it arrives. Complete the real checks in SETUP.md after activation.

## Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Server only | Resend API key (sending access is enough). Required for the enquiry form; without it enquiries return 503 and the walkthrough stays locked. |
| `LEAD_EMAIL_TO` | Server only | Recipient address(es) for enquiries, comma separated. Required. |
| `LEAD_EMAIL_FROM` | Server only | Sender on a domain verified in Resend, e.g. `Tourlo Enquiries <enquiries@tourlo.in>`. Defaults to `onboarding@resend.dev`, which only delivers to the Resend account's own email. |
| `GOOGLE_SCRIPT_URL` | Server only | Optional Apps Script `/exec` URL for live inventory. Without it, inventory is served as labelled sample data. |
| `GOOGLE_SCRIPT_SECRET` | Server only | Shared secret checked by the Apps Script. |
| `NEXT_PUBLIC_GA_ID` | Public, build time | Optional GA4 measurement ID. |
| `NEXT_PUBLIC_BOOKING_URL` | Public, build time | Optional booking link (fallback https://tourlo.in). |

Never prefix the server keys with `NEXT_PUBLIC_` or `VITE_`. The legacy `VITE_GA_ID` and `VITE_BOOKING_URL` names are still read, so existing Vercel settings keep working. Vercel applies environment variable changes to new deployments only, so redeploy after adding or changing any of them. Copy `.env.example` to `.env.local` for local use.

## Deployment and preservation

`vercel.json` sets the framework to Next.js, which overrides the project's previous Vite build/output settings; no other Vercel changes are needed. If the project's dashboard has an Output Directory override of `dist`, clear it. Node 24 is pinned in `package.json`.

Use only the private repository sudarshanknows/tourlo-residences-v2 and Vercel project tourlo-residences-v2 in team tourlo. The original-readonly remote has a disabled push URL. The original-preserved branch points to the original reviewed commit.

V2 preview: https://tourlo-residences-v2-tourlo.vercel.app/ (team deployment protection applies). The initial release was uploaded directly from the committed source because Vercel's GitHub installation cannot currently see the new private repository. Automatic deployment on GitHub push is not connected. The new Vercel project ID is prj_njngtzavCv1NXa81MMeQpo7wDVGv. The original Vercel project and original GitHub repository remain unchanged.

## Visual accuracy

The new images improve lighting, materials and presentation. They are representative AI visualizations, not surveyed views, validated building geometry or a shared 3D model. Apartment plans are indicative and cannot be reconciled exactly to separately generated room images. Native stills are 1672 × 941 and panoramas 1774 × 887; they are not native 4K. A geometry-accurate final sales experience requires the approved architectural model, measured plans and location-specific views. No claim of perfect cross-view accuracy or uninterrupted service under all conditions is made.

The two legacy amenity panoramas remain as the existing 3D fallback garden content. All twelve scenes in the main guided/site/apartment experience use the new assets.
