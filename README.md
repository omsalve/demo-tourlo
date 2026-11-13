# Tourlo Residences V2

A separate project-focused residential experience, preserving the original Tourlo demo at commit 86c1d7a7b3588bc8a1f4924334b90b7aa7337e4f. This is an illustrative Mumbai development with sample inventory, representative AI imagery, and indicative plans/pricing.

## What's included

- Guided visit: arrival, amenities, choose a home, step inside, compare; free exploration remains available.
- 16 new coordinated visual assets: paired day/dusk hero, six site scenes, six apartment scenes and two representative balcony views. Optimized mobile textures and thumbnails.
- Recalibrated clickable tower floors, 70 homes across 19 levels, filters and indicative cost sheets.
- Save up to three homes on the current browser and compare plans, sizes, facing, price and availability.
- Browser speech/typed navigation, including guided visit, next/previous stage, save and compare. This is a command-based guide; microphone support depends on browser/device.
- Existing lead fields and gate timing retained. Failed saves preserve inputs; only a confirmed server response unlocks the journey. Request IDs deduplicate retries.
- Server endpoints for private Google Sheets enquiries and inventory refresh every 30 seconds.
- Panorama retry UI, stale room-load cancellation, image fallback, keyboard modal focus and mobile layouts.

## Current connection status

The private Google Sheets are owned by Nimish and shared with the automation account sudarshanknowsmarketing@gmail.com. The Google web app is deployed and the production connection is configured. Live checks confirmed all 70 homes, a real enquiry save, retry deduplication, and status/price changes followed by restoration. See [setup and verification](integrations/google-sheets/SETUP.md).

The lead gate requires a confirmed save. The temporary preview bypass has been removed, and previous preview sessions no longer unlock the walkthrough.

## Development

Use Node 24 LTS and npm ci. Run npm run dev:api in one terminal and npm run dev -- --port 4173 in another. For browser checks, Chrome must be installed.

- npm test: server validation, inventory integrity, voice parser and simulated Sheets bridge tests.
- npm run test:browser: desktop/mobile journey, lead retry/resume, shortlist persistence, refreshed inventory, all active rooms, missing-image recovery and tower fallback.
- npm run build: production output in dist. Vercel deploys the api directory as server functions.

Browser lead/inventory tests mock remote responses. The Sheets script test uses a simulated Google service; neither is evidence of a live Google integration. Complete the real checks in SETUP.md after activation.

## Deployment and preservation

Use only the private repository sudarshanknows/tourlo-residences-v2 and Vercel project tourlo-residences-v2 in team tourlo. The original-readonly remote has a disabled push URL. The original-preserved branch points to the original reviewed commit.

V2 preview: https://tourlo-residences-v2-tourlo.vercel.app/ (team deployment protection applies). The initial release was uploaded directly from the committed source because Vercel's GitHub installation cannot currently see the new private repository. Automatic deployment on GitHub push is not connected. The new Vercel project ID is prj_njngtzavCv1NXa81MMeQpo7wDVGv.

Server configuration: GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_SECRET. Never prefix those keys with VITE_ or ship secrets to the browser. Optional VITE_GA_ID enables existing analytics. The original Vercel project and original GitHub repository remain unchanged.

## Visual accuracy

The new images improve lighting, materials and presentation. They are representative AI visualizations, not surveyed views, validated building geometry or a shared 3D model. Apartment plans are indicative and cannot be reconciled exactly to separately generated room images. Native stills are 1672 × 941 and panoramas 1774 × 887; they are not native 4K. A geometry-accurate final sales experience requires the approved architectural model, measured plans and location-specific views. No claim of perfect cross-view accuracy or uninterrupted service under all conditions is made.

The two legacy amenity panoramas remain as the existing 3D fallback garden content. All twelve scenes in the main guided/site/apartment experience use the new assets.
