# Reference decode: GHR Callisto 360 tour

Full living version: https://claude.ai/artifact/KnJpA8KbFeNhNcMgnH3Ji3 (decoded 28 Oct 2026)

## What it is

- Stock **3DVista Virtual Tour Pro** export by 360EYE, iframed on https://360eye.in/gallery/3d/GHRCallisto/index.html
- Real host: https://d2t6r6l6h3adka.cloudfront.net/gallery/3d/GHRCallisto/index.html (static files on S3 + CloudFront)
- Scene graph: `script_general.js` (1.78 MB JSON). All labels / links / PDF paths: `locale/en.txt`
- 70 cube panoramas (faces up to 5632 px, 5 tile levels, 512 px level preloads first), 696 hotspots, 4 floorplans, 2 photo albums, 4 videos, 2 PDFs, 3 audio tracks
- Extras: 3DVista Live Guided Tours (`remote.3dvista.com`), GA4 events per scene

## UI map

| Zone | Element | Behaviour |
| --- | --- | --- |
| Top left | Title + subtitle | Scene name + room size, e.g. "Drawing Room, 3BHK (11'5" x 12'0")" |
| Top left | Current / Future Status | Swaps the same drone 360 between raw site and CGI towers composited in |
| Top right | Aerial, Ground, Balcony, 3BHK, 2BHK, Office | Dropdown of thumbnail cards per category |
| In pano | Nav hotspots | Drone icon "Eagle Eye View", "Enter" chevrons, room arrows; flat, in perspective |
| In pano | Info hotspots | (i) + room name + dimensions on walls |
| In pano | Road labels | "Towards Shankarpally (Mokila Road)" on drone shots |
| Bottom bar | Contact, Location, Brochure, Rera, Photo, Video, Floorplan | Panels, PDF popups, lightboxes, floorplan minimap with dots + zoom + download |
| Bottom right | Help, VR, Share, Sound, Auto-rotate, Screenshot, Fullscreen | Utilities; Help is a dimmed coach-mark overlay |

## Content

| Category | Capture |
| --- | --- |
| Aerial (Top, Front, Left, Right, Far Left/Right) | Drone 360 + CGI tower comp, Current and Future versions |
| Ground (gate, plaza, lounges, courtyards, club, pool, courts, lawn) | CGI 360 renders |
| Balcony (A-3, D-6, F-5, H-2; 1st, 9th, 16th floor) | Drone at real floor height + CGI building edge |
| 3BHK / 2BHK rooms | Real 360 photos of sample flat |
| Office | Real 360 photos (labels reused from another client) |

## Replicate as-is

1. Current vs Future toggle on the same drone view
2. Balcony views per floor and tower face
3. Room dimension labels in the panorama
4. Floorplan minimap with live position

## Where Tourlo goes further

- Tower stacking plan with live inventory (tap a flat: balcony view, plan, price, status)
- Interior customisation inside the 360
- Lead capture on brochure download / price reveal, piped to CRM
- Dated progress timeline
- Unit-level analytics

## Flaws in the reference (avoid)

- Leftover labels from another client
- Some images 503 under load
- Stale "Current" plates with no date
- Dense UI on mobile
- No lead capture
