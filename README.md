# Tourlo Web Demo

An interactive sales gallery demo for **Tourlo Demo Residences** (fictional, Mumbai), built to embed on tourlo.in.

- 3D tower (Three.js) with 24 floors, each tappable, day and night modes, and a Landscaped Garden hotspot on the podium
- Live inventory from `data/inventory.json` with filters (BHK, status, price, facing). Matching floors glow on the tower
- Unit view with an indicative SVG plan, specs, an indicative cost sheet and an EMI calculator
- 360 viewer with drag, pinch or scroll zoom, gyroscope on phones, room thumbnails and hotspots between rooms
- Lead form after about 60 seconds of interaction or when a second 360 room is opened
- Optional GA4 events and a persistent "Book a full live demo" call to action

Vite and vanilla JS. No backend. The initial load is about 650 KB (gzip about 200 KB); panos load only when opened.

## Run locally

Requires Node 18 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open the URL Vite prints (http://localhost:5173). To test on a phone on the same Wi-Fi, use the "Network" URL.

Production build and local preview:

```bash
npm run build
```

```bash
npm run preview
```

## Deploy on Vercel

1. Push this repo to GitHub and import it in Vercel (Framework preset: Vite, or "Other").
2. Build command `npm run build`, output directory `dist` (already set in `vercel.json`).
3. Add the environment variables below under Project Settings, Environment Variables, then redeploy.

`vercel.json` allows the site to be framed by any origin and enables motion sensors in frames. To limit framing to your own site, change `frame-ancestors *` to `frame-ancestors https://tourlo.in https://*.tourlo.in`.

### Embedding in tourlo.in

```html
<iframe
  src="https://YOUR-DEPLOYMENT.vercel.app/"
  style="width:100%;height:100vh;border:0"
  allow="gyroscope; accelerometer; fullscreen"
  loading="lazy"
  title="Tourlo interactive demo"></iframe>
```

The `allow` attribute is needed for the gyroscope to work inside the iframe.

## Environment variables

Copy `.env.example` to `.env.local` for local development. All are optional.

| Variable | Purpose |
| --- | --- |
| `VITE_LEAD_WEBHOOK` | URL that receives the lead form as a JSON `POST`. If empty, the lead is logged to the browser console and the demo still unlocks. |
| `VITE_GA_ID` | GA4 measurement id (`G-XXXXXXXXXX`). If empty, analytics is off. |
| `VITE_BOOKING_URL` | Target of every "Book a full live demo" button. Defaults to https://tourlo.in. |

These are baked in at build time, so redeploy after changing them.

**Lead payload** includes `name`, `company`, `phone`, `email`, `role`, `trigger` (`time` or `second_room`), `page`, `referrer`, `submittedAt`, `activeSeconds`, `lastFloor`, `lastUnit` and `roomsViewed`. If the webhook does not answer CORS preflight requests (common with Zapier, Make and Google Apps Script), the demo retries as a simple `text/plain` request with the same JSON body.

**GA4 events:** `floor_click`, `unit_open`, `pano_open`, `filter_used`, `lead_submit`, `book_demo_click`, `time_spent` (engaged seconds, sent when the tab is hidden or closed). `emi_used` is sent as a bonus. With `?dev=1` all events are also logged to the console.

## Editing inventory

`data/inventory.json` is fetched at runtime, so you can edit it and redeploy without touching code.

Each unit:

```json
{
  "unit": "1203",
  "floor": 12,
  "type": "A",
  "typeName": "Type A Residence",
  "bhk": 3,
  "duplex": false,
  "carpetArea": 1240,
  "facing": "E",
  "status": "available",
  "price": 32145000
}
```

- `status` is `available`, `held` or `sold`.
- `facing` is `N`, `E`, `S` or `W`. On Type A floors it also sets which quadrant of the key plan the unit sits in (N top left, E top right, S bottom right, W bottom left). Type B uses `E` (right) and `W` (left).
- `price` is the agreement value in INR. The app formats it as Cr or Lakh.
- The top level `pricing` block drives the cost sheet: floor rise per sq ft per floor, PLC by facing, GST rate, stamp duty rate and registration. Base price is shown as `price` minus floor rise minus PLC.

To regenerate fresh dummy data (overwrites the file):

```bash
npm run inventory
```

## Editing 360 rooms and hotspots

`data/hotspots.json` defines three tours (`typeA`, `typeB`, `amenity`). Each room has an `id`, a `label`, a `file` name, an optional starting `initialYaw` and `initialPitch`, and a list of `hotspots`:

```json
{ "to": "typeA_study", "label": "Study", "yaw": 40, "pitch": -4 }
```

`yaw` is degrees left or right of the centre of the pano image (positive is right, range -180 to 180). `pitch` is degrees up or down (positive is up).

The current positions are sensible placeholders. To place them precisely:

1. Open the site with `?dev=1`, for example http://localhost:5173/?dev=1
2. Open a 360 room. A readout shows the yaw and pitch under the pointer.
3. Click the spot where the hotspot should sit (a doorway, for example). The yaw and pitch are logged to the console and a ready JSON snippet is copied to the clipboard.
4. Paste it into `data/hotspots.json`, set `to` and `label`, save and refresh.

## Swapping in real project panos

Keep the same file names and the app picks them up with no code changes.

1. Put 2:1 equirectangular JPGs (4096x2048 recommended) in `assets/panos/` using the existing names:
   - `typeA_living.jpg`, `typeA_living_dining.jpg`, `typeA_study.jpg`
   - `typeB_living.jpg`, `typeB_lounge.jpg`, `typeB_stair_dining.jpg`
   - `amenity_garden_1.jpg`, `amenity_garden_2.jpg`
2. Rebuild the phone versions (2048x1024) and room thumbnails:

   ```bash
   npm run panos -- --force
   ```

   This writes `assets/panos-mobile/` and `assets/thumbs/`. You can also supply your own phone panos in `assets/panos-mobile/` with the same names.
3. Re-check hotspot positions with `?dev=1` and adjust `data/hotspots.json`.

Screens narrower than 768 px (or devices that cannot handle 4096 px textures) get the phone panos; larger screens get the desktop panos.

To add or rename rooms, add the JPG and a matching room entry in `data/hotspots.json`.

### Balcony view

If `assets/views/balcony_view.jpg` exists, Type A units show a "View from balcony" button that opens the image full screen. If the file is missing, the button stays hidden.

## Project structure

```
index.html            App shell
src/main.js           App wiring: panels, filters, unit view, tours
src/tower.js          Three.js tower, day and night, floor picking
src/viewer.js         360 viewer, hotspots, gyroscope, dev mode
src/plans.js          Indicative SVG plans and floor key plan
src/cost.js           Cost sheet and EMI calculator
src/lead.js           Lead gate and webhook
src/analytics.js      GA4 loader and events
src/styles.css        All styles
data/inventory.json   Units and pricing (runtime)
data/hotspots.json    Tours, rooms and hotspots (runtime)
assets/               Panos, phone panos, thumbnails, optional views
scripts/              Inventory generator and pano preparation
```

`assets/` and `data/` are served as they are in development and copied into `dist/` on build.
