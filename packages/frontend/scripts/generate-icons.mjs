import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const publicDir = resolve(root, 'public');
const iconsDir = resolve(publicDir, 'icons');

const svgPath = resolve(publicDir, 'favicon.svg');
const svg = await readFile(svgPath);

if (!existsSync(iconsDir)) {
  await mkdir(iconsDir, { recursive: true });
}

const pngSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const icoSizes = [16, 32, 48];

const renderPng = async (size) =>
  sharp(svg, { density: Math.max(96, size * 4) })
    .resize(size, size)
    .png()
    .toBuffer();

for (const size of pngSizes) {
  const buf = await renderPng(size);
  await writeFile(resolve(iconsDir, `icon-${size}x${size}.png`), buf);
  console.log(`  ✓ icons/icon-${size}x${size}.png`);
}

const apple = await renderPng(180);
await writeFile(resolve(publicDir, 'apple-touch-icon.png'), apple);
console.log('  ✓ apple-touch-icon.png');

const icoBuffers = await Promise.all(icoSizes.map((s) => renderPng(s)));
const icoBuffer = await toIco(icoBuffers);
await writeFile(resolve(publicDir, 'favicon.ico'), icoBuffer);
console.log('  ✓ favicon.ico (16, 32, 48)');

console.log('\nAll icons generated from favicon.svg');
