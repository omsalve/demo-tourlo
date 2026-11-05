# First prompt to paste into Claude Code

Read CLAUDE.md and docs/reference-decode.md. Then:

1. Run `npm install` and `npm run fetch:panos`, and confirm all 70 panoramas downloaded.
2. Run `npm run dev` and check the viewer loads, the category menus work, and the Current / Future toggle switches on Front View (to Top).
3. Do roadmap item 1: open each Aerial status pair, decide which image is Current (empty site) and which is Future (CGI towers), and update `statusPairs` in `public/data/tour.json` with `verified: true`.
4. Then start roadmap item 2 (navigation hotspots with the Virtual Tour plugin) for the Flat scenes, beginning with Drawing Room, and add a dev-only helper that logs yaw/pitch on click.

Work on a branch, keep commits small, and open a PR when item 2 works on desktop and on a 390px mobile viewport.
