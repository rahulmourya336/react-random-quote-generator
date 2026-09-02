/*
  Generates the app icons and the social card from the Ink & Plate palette.
  Run with `npm run icons`.

  The mark is two overlapping ink dots, periwinkle and rose, screen-blended
  where they cross, the way two spot inks overprint. It is pure geometry, so
  this script rasterises it directly and writes the PNGs itself rather than
  pulling in an image library for six static files.
*/

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const INK = [0x17, 0x12, 0x2e];
const GLOW = [0x27, 0x1f, 0x52];
const PERIWINKLE = [0x90, 0x89, 0xfa];
const ROSE = [0xef, 0x89, 0x9e];

// ---------------------------------------------------------------- PNG writing

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, crc]);
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  // Raw scanlines, each prefixed with filter type 0.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const from = y * width * 4;
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, from, from + width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- drawing

const SAMPLES = 4; // per axis, so 16 coverage samples per pixel

// How much of this pixel falls inside the circle.
function coverage(px, py, cx, cy, r) {
  let hits = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      const x = px + (sx + 0.5) / SAMPLES;
      const y = py + (sy + 0.5) / SAMPLES;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) hits++;
    }
  }
  return hits / (SAMPLES * SAMPLES);
}

const screen = (a, b) => 255 - ((255 - a) * (255 - b)) / 255;
const mix = (a, b, t) => a + (b - a) * t;

/**
 * Paints the mark on the ink ground.
 * @param scale mark diameter as a fraction of the shortest side
 */
function render(width, height, { scale = 0.42, grain = 0 } = {}) {
  const rgba = Buffer.alloc(width * height * 4);
  const short = Math.min(width, height);
  const r = (short * scale) / 2;
  const gap = r * 0.72; // centres either side of the middle
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Ground: ink with a soft glow off the top-left, as on the site.
      const dx = (x - width * 0.12) / width;
      const dy = (y + height * 0.15) / height;
      const glow = Math.max(0, 1 - Math.hypot(dx, dy) * 1.35);
      let R = mix(INK[0], GLOW[0], glow);
      let G = mix(INK[1], GLOW[1], glow);
      let B = mix(INK[2], GLOW[2], glow);

      const left = coverage(x, y, cx - gap, cy, r);
      const right = coverage(x, y, cx + gap, cy, r);

      if (left > 0 || right > 0) {
        // Screen-blend the two inks so the overlap reads as an overprint.
        const iR = screen(PERIWINKLE[0] * left, ROSE[0] * right);
        const iG = screen(PERIWINKLE[1] * left, ROSE[1] * right);
        const iB = screen(PERIWINKLE[2] * left, ROSE[2] * right);
        const a = Math.min(1, left + right);
        R = mix(R, iR, a);
        G = mix(G, iG, a);
        B = mix(B, iB, a);
      }

      if (grain) {
        const n = (Math.random() - 0.5) * grain;
        R += n;
        G += n;
        B += n;
      }

      const i = (y * width + x) * 4;
      rgba[i] = Math.max(0, Math.min(255, Math.round(R)));
      rgba[i + 1] = Math.max(0, Math.min(255, Math.round(G)));
      rgba[i + 2] = Math.max(0, Math.min(255, Math.round(B)));
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

const png = (name, w, h, opts) => {
  const buf = encodePNG(w, h, render(w, h, opts));
  writeFileSync(resolve(OUT, name), buf);
  console.log(`${name}  ${w}x${h}  ${(buf.length / 1024).toFixed(1)} kB`);
};

// --------------------------------------------------------------------- output

mkdirSync(OUT, { recursive: true });

png('icon-192.png', 192, 192);
png('icon-512.png', 512, 512);
// Maskable icons get cropped to a circle by some launchers, so the mark sits
// well inside the 40% safe radius.
png('icon-maskable-512.png', 512, 512, { scale: 0.3 });
png('apple-touch-icon.png', 180, 180, { scale: 0.38 });
png('og.png', 1200, 630, { scale: 0.34 });

// A single-image .ico, which is just a PNG in an ICO container (Vista and up).
const iconPNG = encodePNG(64, 64, render(64, 64));
const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0);
dir.writeUInt16LE(1, 2); // type: icon
dir.writeUInt16LE(1, 4); // one image
const entry = Buffer.alloc(16);
entry[0] = 64; // width
entry[1] = 64; // height
entry.writeUInt16LE(1, 4); // colour planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(iconPNG.length, 8);
entry.writeUInt32LE(22, 12); // offset
writeFileSync(resolve(OUT, 'favicon.ico'), Buffer.concat([dir, entry, iconPNG]));
console.log('favicon.ico  64x64');

// The SVG favicon is what modern browsers actually use; it stays crisp.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#17122E"/>
  <g style="mix-blend-mode:screen">
    <circle cx="25.5" cy="32" r="13.5" fill="#9089FA"/>
    <circle cx="38.5" cy="32" r="13.5" fill="#EF899E"/>
  </g>
</svg>
`;
writeFileSync(resolve(OUT, 'favicon.svg'), svg);
console.log('favicon.svg');
