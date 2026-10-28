# Tourlo Web Demo: Build Brief

## What this is
Tourlo (tourlo.in) is an immersive real estate sales gallery used by developers in India. This repo is a lightweight, interactive web demo embedded on tourlo.in so prospects can try the product before a sales meeting. It must feel premium, load fast on mid-range Android phones over 4G, and push visitors to book a full live demo.

Demo project name: **Tourlo Demo Residences** (fictional, Mumbai).

## Stack
- Vite + vanilla JS (or React if clearly better), Three.js for the tower and the 360 viewer.
- No backend. Static site deployable on Vercel.
- Must work inside an iframe.

## Assets already in this repo
`assets/panos/` (4096x2048 equirectangular JPG, desktop) and `assets/panos-mobile/` (2048x1024, phones):
- Type A, 3 BHK apartment: `typeA_living.jpg`, `typeA_living_dining.jpg`, `typeA_study.jpg`
- Type B, 4 BHK sky villa (duplex): `typeB_living.jpg`, `typeB_lounge.jpg`, `typeB_stair_dining.jpg`
- Amenity, landscaped garden: `amenity_garden_1.jpg`, `amenity_garden_2.jpg`
- Optional: `assets/views/balcony_view.jpg`. If this file exists, show a "View from balcony" button in Type A. If not, hide the button.

There are NO tower renders, floor masks, night versions, unfurnished versions or floor plan images. Do not show toggles for assets that do not exist.

## Features to build

### 1. Tower (built in Three.js, no renders needed)
- A stylized, elegant architectural massing model of a 24 storey residential tower on a podium. Glass and light stone look, soft shadows, subtle ambient occlusion feel. Think premium architectural scale model, not a game.
- Each floor is its own mesh so it can highlight on hover/tap.
- Floors 1 to 20: Type A apartments, 4 per floor. Floors 21 to 24: Type B sky villas, 2 per floor.
- Slow auto-rotate on load; drag/swipe to orbit; limited zoom; camera never goes below ground.
- Day/night toggle: changes sky, sun, and turns on warm window glow at night.
- Podium has a "Landscaped Garden" hotspot that opens the amenity panos.

### 2. Live inventory
- Create `data/inventory.json` with dummy data for every unit: unit number, floor, type, BHK, carpet area (sq ft), facing (N/E/S/W), status (available / held / sold, roughly 55/15/30), price in INR shown as Cr or Lakh.
- Tapping a floor opens a side panel (bottom sheet on mobile) with that floor's units colored by status.
- Filters: BHK, status, price range, facing. Matching floors glow on the tower.

### 3. Unit view
- Tapping a unit shows: an indicative floor plan drawn as clean SVG by you (3 BHK for Type A, 4 BHK duplex for Type B; label it "Indicative plan"), specs, price, and status.
- Mini cost sheet: base price, floor rise, PLC, GST 5%, stamp duty 6%, registration. Clearly marked as indicative.
- EMI calculator: loan %, rate, tenure sliders.
- "Step inside" button opens the 360 viewer for that unit type.

### 4. 360 viewer
- Drag/swipe to look around, pinch/scroll to zoom (limited FOV range), gyroscope on mobile if permitted.
- Room switcher thumbnails plus clickable hotspots between rooms of the same unit.
- Add a hidden dev mode (`?dev=1`): clicking in the pano logs and copies yaw/pitch so hotspot positions can be set by hand in a `data/hotspots.json` file. Use sensible placeholder positions until then.
- Load the mobile pano on small screens and desktop pano on large screens. Show a loader and fade between rooms.

### 5. Lead capture
- Visitors explore freely. After about 60 seconds of interaction, or when they open a second 360 room, show a polite form: name, company, phone, email, role (Developer / Sales / CP / Other). Unlocks the rest.
- POST to the URL in env var `VITE_LEAD_WEBHOOK`. If not set, log to console and still unlock.
- Remember unlocked state in sessionStorage.

### 6. Analytics
- If `VITE_GA_ID` is set, load GA4 and send events: floor_click, unit_open, pano_open, filter_used, lead_submit, book_demo_click, time_spent.

### 7. Call to action
- Persistent small "Book a full live demo" button, plus a final card after the 360 view. Links to `VITE_BOOKING_URL` (fallback: https://tourlo.in).

## Design
- Dark, premium, minimal. Brand-neutral palette for now (near black, warm off-white, one gold accent). Clean sans serif from Google Fonts.
- Small "Tourlo" wordmark top left as text.
- Mobile first. Thumb-friendly controls. No horizontal scroll.
- Never use em dashes or en dashes in any UI copy.

## Performance targets
- Initial load under 3 MB before any pano is opened. Lazy load panos.
- 60 fps orbit on a mid-range phone. Cap pixel ratio at 2.

## Delivery
- Clean README with: how to run locally, how to deploy on Vercel, the env vars, how to edit inventory and hotspots, how to swap in real project panos later using the same file names.
- Open a pull request when done, with a short summary and anything you could not do.
