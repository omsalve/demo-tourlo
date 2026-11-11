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


def exists(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 200
    except Exception:
        return False


def tiles_across(base, level):
    """How many 512 px tiles span one face at a source level (0 if the level is missing)."""
    n = 0
    while exists(f"{base}/f/{level}/{n}_0.jpg"):
        n += 1
    return n


def plan(row):
    """Source base URL, the source level for each of our levels, and its tile count."""
    m = re.match(r"(.*_0)/f/(\d+)/0_0\.jpg$", row["cube_front_512"])
    if not m:
        raise ValueError(f"Unexpected cube URL: {row['cube_front_512']}")
    base, top = m.group(1), int(m.group(2))  # `top` is the source level holding the 512 px face
    src = [(top, 1), (top - 1, 2)]
    # The 2048 px level: 3DVista pyramids differ per scene (some go 1024, 2048, 3584;
    # others 1024, 1536, 3072, 5632). Take the first level at least 2048 px wide,
    # or the largest one if the scene never reaches 2048 (it gets upscaled).
    best = None
    for level in range(top - 2, -1, -1):
        n = tiles_across(base, level)
        if n > (best[1] if best else 2):
            best = (level, n)
        if n >= 4:
            break
    if not best:
        raise ValueError("no source level above 1024 px")
    src.append(best)
    return base, src


def direct_jobs(base, src, scene_dir):
    """(url, dest) for levels whose source grid already matches ours."""
    jobs = []
    for ours, (level, n) in enumerate(src):
        if n != LEVELS[ours]:
            continue
        for face in FACES:
            for r in range(n):
                for c in range(n):
                    url = f"{base}/{face}/{level}/{r}_{c}.jpg"
                    jobs.append((url, scene_dir / face / str(ours) / f"{r}_{c}.jpg"))
    return jobs


def resample_level(pool, base, level, n, ours, scene_dir):
    """Stitch a larger source face, downscale it to our size and cut it into our tile grid."""
    try:
        from PIL import Image
    except ImportError:
        sys.exit("This scene needs Pillow to resample tiles: pip install pillow")
    size, out_n = 512 * LEVELS[ours], LEVELS[ours]
    failed, made = [], 0
    for face in FACES:
        out_dir = scene_dir / face / str(ours)
        if all((out_dir / f"{r}_{c}.jpg").exists() for r in range(out_n) for c in range(out_n)):
            continue
        cache = scene_dir / "_src" / face
        jobs = [(f"{base}/{face}/{level}/{r}_{c}.jpg", cache / f"{r}_{c}.jpg") for r in range(n) for c in range(n)]
        bad = [u for u, s in pool.map(lambda j: (j[0], fetch(*j)), jobs) if s.startswith("FAIL")]
        if bad:
            failed += bad
            continue
        tiles = [[Image.open(cache / f"{r}_{c}.jpg") for c in range(n)] for r in range(n)]
        width = sum(t.width for t in tiles[0])
        height = sum(row[0].height for row in tiles)
        face_img = Image.new("RGB", (width, height))
        y = 0
        for row in tiles:
            x = 0
            for t in row:
                face_img.paste(t, (x, y))
                x += t.width
            y += row[0].height
        face_img = face_img.resize((size, size), Image.LANCZOS)
        made += 1
        out_dir.mkdir(parents=True, exist_ok=True)
        for r in range(out_n):
            for c in range(out_n):
                box = (c * 512, r * 512, (c + 1) * 512, (r + 1) * 512)
                face_img.crop(box).save(out_dir / f"{r}_{c}.jpg", quality=90)
        for f in cache.iterdir():
            f.unlink()
        cache.rmdir()
    if (scene_dir / "_src").exists() and not any((scene_dir / "_src").iterdir()):
        (scene_dir / "_src").rmdir()
    return failed, made


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

            done = scene_dir / ".complete"
            if done.exists():
                results = [("", "skip")]
            else:
                base, src = plan(row)
                jobs = [(row["equirect_724x362"], thumb)] + direct_jobs(base, src, scene_dir)
                results = list(pool.map(lambda j: (j[0], fetch(*j)), jobs))
                for ours, (level, across) in enumerate(src):
                    if across != LEVELS[ours]:
                        bad_urls, made = resample_level(pool, base, level, across, ours, scene_dir)
                        results += [(u, "FAIL") for u in bad_urls] + [("", "ok")] * made
            bad = [u for u, s in results if s.startswith("FAIL")]
            got = sum(1 for _, s in results if s == "ok")
            failed += bad
            if not bad:
                done.touch()
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
