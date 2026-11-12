import { defineConfig } from 'vite';
import { cp } from 'node:fs/promises';
import path from 'node:path';

// assets/ and data/ live at the repo root so they are easy to find and edit.
// Vite serves them as-is in dev; this plugin copies them into dist/ on build
// so they are fetched at runtime (no rebuild needed to edit JSON on the server).
const copyRuntimeFiles = () => ({
  name: 'copy-runtime-files',
  apply: 'build',
  async closeBundle() {
    const out = path.resolve('dist');
    await cp(path.resolve('assets'), path.join(out, 'assets'), { recursive: true });
    await cp(path.resolve('data'), path.join(out, 'data'), { recursive: true });
  },
});

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    assetsDir: 'static',
    target: 'es2019',
    chunkSizeWarningLimit: 800,
  },
  server: { host: '127.0.0.1', proxy: { '/api': {target:'http://127.0.0.1:4174',changeOrigin:false} } },
  plugins: [copyRuntimeFiles()],
});
