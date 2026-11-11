#!/usr/bin/env python3
"""
Download the GHR Callisto panoramas listed in ghr_callisto_pano_links.csv.

Usage:
    npm run fetch:panos        # thumbnails + sharp cube tiles (up to 2048 px per face)

Output:
    public/assets/panos/<category>/<nn>_<scene>.jpg                       724x362 thumbnail (menus)
    public/assets/panos/<category>/<nn>_<scene>/<face>/<level>/<r>_<c>.jpg  cube tiles for the viewer
        face:  f b l r u d   (front back left right up down)
        level: 0 = 512 px face (1 tile), 1 = 1024 px (2x2 tiles), 2 = 2048 px (4x4 tiles)
    public/assets/panos/manifest.json   (what was downloaded)

The source tour (3DVista) stores each cube face as 512 px tiles at several
zoom levels. We keep the three power-of-two levels, which is what the Photo
Sphere Viewer cubemap tiles adapter expects. Re-running skips files that exist.

No installs needed: Python 3.8+ standard library only.
Assets are GHR Infra / 360EYE copyright: internal testing only, keep the repo private.
"""
import csv, json, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "ghr_callisto_pano_links.csv"
OUT = ROOT / "public" / "assets" / "panos"
FACES = ["f", "b", "l", "r", "u", "d"]
LEVELS = [1, 2, 4]  # tiles per side for our levels 0, 1, 2
WORKERS = 8


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def fetch(url, dest, tries=4):
    if dest.exists() and dest.stat().st_size > 0:
        return "skip"
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, tries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            dest.write_bytes(data)
            return "ok"
        except Exception as e:
            if attempt == tries:
                return f"FAIL ({e})"
            time.sleep(2 * attempt)  # CloudFront sometimes returns 503 under load


def tile_jobs(row, scene_dir):
    """(url, dest) for every tile of every face at the 512 / 1024 / 2048 levels."""
    m = re.match(r"(.*_0)/f/(\d+)/0_0\.jpg$", row["cube_front_512"])
    if not m:
        raise ValueError(f"Unexpected cube URL: {row['cube_front_512']}")
    base, top = m.group(1), int(m.group(2))  # `top` is the source level holding the 512 px face
    jobs = []
    for ours, n in enumerate(LEVELS):
        src_level = top - ours
        for face in FACES:
            for r in range(n):
                for c in range(n):
                    url = f"{base}/{face}/{src_level}/{r}_{c}.jpg"
                    jobs.append((url, scene_dir / face / str(ours) / f"{r}_{c}.jpg"))
    return jobs


def main():
    if not CSV_PATH.exists():
        sys.exit(f"Missing {CSV_PATH.name} in data/.")
    rows = list(csv.DictReader(CSV_PATH.open(newline="", encoding="utf-8")))
    manifest, failed = [], []

    with ThreadPoolExecutor(WORKERS) as pool:
        for row in rows:
            n = int(row["#"])
            cat = slug(row["category"])
            name = f"{n:02d}_{slug(row['scene'])}"
            thumb = OUT / cat / f"{name}.jpg"
            scene_dir = OUT / cat / name

            jobs = [(row["equirect_724x362"], thumb)] + tile_jobs(row, scene_dir)
            results = list(pool.map(lambda j: (j[0], fetch(*j)), jobs))
            bad = [u for u, s in results if s.startswith("FAIL")]
            got = sum(1 for _, s in results if s == "ok")
            failed += bad
            status = f"{got} new, {len(bad)} failed" if (got or bad) else "skip"
            print(f"[{n:02d}/{len(rows)}] {row['category']:<8} {row['scene']:<28} {status}")

            manifest.append({
                "id": name,
                "category": row["category"],
                "name": row["scene"],
                "thumb": thumb.relative_to(ROOT / "public").as_posix(),
                "tiles": scene_dir.relative_to(ROOT / "public").as_posix(),
            })

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"\nDone. {len(manifest)} scenes, {len(failed)} failed files.")
    print(f"Manifest: {(OUT / 'manifest.json').relative_to(ROOT)}")
    if failed:
        print("Re-run the script to retry failed files:")
        for u in failed[:40]:
            print("  ", u)


if __name__ == "__main__":
    main()
