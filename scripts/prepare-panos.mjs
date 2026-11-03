// Builds phone panos (2048x1024) and small room thumbnails from the desktop panos.
// Usage: npm run panos            (skips files that already exist)
//        npm run panos -- --force (rebuilds everything)
import { readdir, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'assets/panos');
const mobile = path.join(root, 'assets/panos-mobile');
const thumbs = path.join(root, 'assets/thumbs');
const force = process.argv.includes('--force');

const exists = (p) => access(p).then(() => true, () => false);

await mkdir(mobile, { recursive: true });
await mkdir(thumbs, { recursive: true });

const files = (await readdir(src)).filter((f) => /\.jpe?g$/i.test(f));
for (const file of files) {
  const input = path.join(src, file);
  const mOut = path.join(mobile, file);
  const tOut = path.join(thumbs, file);
  if (force || !(await exists(mOut))) {
    await sharp(input).resize({ width: 2048, height: 1024, withoutEnlargement: true }).jpeg({ quality: 78, progressive: true, mozjpeg: true }).toFile(mOut);
    console.log('mobile  ', file);
  }
  if (force || !(await exists(tOut))) {
    // Centre crop of the equirectangular image reads best as a thumbnail.
    const meta = await sharp(input).metadata();
    const w = Math.round(meta.width * 0.36);
    const h = Math.round(w * 0.6);
    await sharp(input)
      .extract({ left: Math.round((meta.width - w) / 2), top: Math.round((meta.height - h) / 2), width: w, height: h })
      .resize(240, 144)
      .jpeg({ quality: 72, mozjpeg: true })
      .toFile(tOut);
    console.log('thumb   ', file);
  }
}
console.log(`Done. ${files.length} panos processed.`);
