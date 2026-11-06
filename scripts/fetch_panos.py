#!/usr/bin/env python3
"""
Download the GHR Callisto panoramas listed in ghr_callisto_pano_links.csv.

Usage:
    npm run fetch:panos          # 360 JPGs only (70 files, small)
    npm run fetch:panos:cube     # also the 6 cube faces per scene (420 more files)

Output:
    public/assets/panos/<category>/<nn>_<scene>.jpg
    public/assets/panos/<category>/<nn>_<scene>/cube_{front,back,left,right,up,down}.jpg   (with --cube)
    public/assets/panos/manifest.json   (what was downloaded)

No installs needed: Python 3.8+ standard library only.
Assets are GHR Infra / 360EYE copyright: internal testing only, keep the repo private.
"""
import csv, json, re, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "ghr_callisto_pano_links.csv"
OUT = ROOT / "public" / "assets" / "panos"
FACES = ["front", "back", "left", "right", "up", "down"]
WANT_CUBE = "--cube" in sys.argv


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def fetch(url, dest, tries=3):
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


def main():
    if not CSV_PATH.exists():
        sys.exit(f"Missing {CSV_PATH.name} next to this script.")
    rows = list(csv.DictReader(CSV_PATH.open(newline="", encoding="utf-8")))
    manifest, failed = [], []

    for row in rows:
        n = int(row["#"])
        cat = slug(row["category"])
        name = f"{n:02d}_{slug(row['scene'])}"
        pano = OUT / cat / f"{name}.jpg"
        status = fetch(row["equirect_724x362"], pano)
        print(f"[{n:02d}/{len(rows)}] {row['category']:<8} {row['scene']:<28} {status}")
        if status.startswith("FAIL"):
            failed.append(row["equirect_724x362"])

        entry = {
            "id": name,
            "category": row["category"],
            "name": row["scene"],
            "panorama": pano.relative_to(ROOT / "public").as_posix(),
        }

        if WANT_CUBE:
            cube = {}
            for face in FACES:
                dest = OUT / cat / name / f"cube_{face}.jpg"
                s = fetch(row[f"cube_{face}_512"], dest)
                if s.startswith("FAIL"):
                    failed.append(row[f"cube_{face}_512"])
                cube[face] = dest.relative_to(ROOT / "public").as_posix()
            entry["cube"] = cube

        manifest.append(entry)
        time.sleep(0.15)  # be gentle with the host

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"\nDone. {len(manifest)} scenes, {len(failed)} failed.")
    print(f"Manifest: {(OUT / 'manifest.json').relative_to(ROOT)}")
    if failed:
        print("Re-run the script to retry failed files:")
        for u in failed:
            print("  ", u)


if __name__ == "__main__":
    main()
