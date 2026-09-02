/*
  Draws the finished card straight onto a canvas rather than screenshotting the
  DOM. The output is a clean 1200x800 (or 1080x1350) poster at a fixed size, it
  is not tied to whatever the viewport happens to be, and it keeps the on-screen
  CSS free to use blend modes and filters.
*/

const INK = '#17122e';
const ROSE = '#ef899e';

export const PRESETS = {
  landscape: { width: 1200, height: 800 },
  portrait: { width: 1080, height: 1350 },
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The backdrop could not be loaded.'));
    image.src = src;
  });
}

async function ensureFonts() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('500 68px Fraunces'),
      document.fonts.load('500 22px Archivo'),
    ]);
    await document.fonts.ready;
  } catch {
    // Fall through to the fallback stacks rather than failing the render.
  }
}

function drawCover(ctx, image, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}

function drawGrain(ctx, width, height) {
  const size = 180;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tileCtx = tile.getContext('2d');
  const noise = tileCtx.createImageData(size, size);
  for (let i = 0; i < noise.data.length; i += 4) {
    const value = 110 + Math.random() * 145;
    noise.data[i] = value;
    noise.data[i + 1] = value;
    noise.data[i + 2] = value;
    noise.data[i + 3] = 255;
  }
  tileCtx.putImageData(noise, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const quoteFont = (size) => `500 ${size}px Fraunces, Georgia, serif`;

// Mirrors the type-size bands the plate uses on screen, as a fraction of the
// card height, so the export is set the way the preview was.
function bandCeiling(text) {
  if (text.length <= 62) return 0.105;
  if (text.length <= 120) return 0.075;
  if (text.length <= 200) return 0.052;
  return 0.04;
}

function fitQuote(ctx, text, { maxWidth, maxHeight, max, min, lineHeight }) {
  for (let size = max; size > min; size -= 2) {
    ctx.font = quoteFont(size);
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length * size * lineHeight <= maxHeight) return { size, lines };
  }
  ctx.font = quoteFont(min);
  return { size: min, lines: wrap(ctx, text, maxWidth) };
}

function slug(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'card'
  );
}

function toBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('The card could not be encoded.')),
      'image/jpeg',
      0.92,
    );
  });
}

/**
 * Renders the card and hands it to the browser as a download.
 * @returns {Promise<{width: number, height: number}>} the exported size
 */
export async function downloadCard({ src, text, author, orientation = 'landscape' }) {
  const { width, height } = PRESETS[orientation] ?? PRESETS.landscape;
  const [image] = await Promise.all([loadImage(src), ensureFonts()]);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.filter = 'saturate(0.4) contrast(1.04) brightness(1.06)';
  drawCover(ctx, image, width, height);
  ctx.restore();

  // The same two-part scrim the plate uses on screen: bottom-heavy, plus a
  // wash from the left so the text sits on settled ground.
  const vertical = ctx.createLinearGradient(0, height, 0, 0);
  vertical.addColorStop(0, 'rgba(23, 18, 46, 0.93)');
  vertical.addColorStop(0.22, 'rgba(23, 18, 46, 0.72)');
  vertical.addColorStop(0.52, 'rgba(23, 18, 46, 0.3)');
  vertical.addColorStop(0.82, 'rgba(23, 18, 46, 0.06)');
  vertical.addColorStop(1, 'rgba(23, 18, 46, 0.12)');
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, width, height);

  const horizontal = ctx.createLinearGradient(0, 0, width * 0.52, 0);
  horizontal.addColorStop(0, 'rgba(23, 18, 46, 0.42)');
  horizontal.addColorStop(1, 'rgba(23, 18, 46, 0)');
  ctx.fillStyle = horizontal;
  ctx.fillRect(0, 0, width, height);

  drawGrain(ctx, width, height);

  const pad = Math.round(width * 0.075);
  const authorSize = Math.round(height * 0.026);
  const ruleWidth = Math.round(width * 0.04);
  const gutter = Math.round(authorSize * 0.85);
  const lineHeight = 1.14;

  // Attribution first, so the quote can be stacked upwards from above it.
  const authorBaseline = height - pad;
  ctx.fillStyle = ROSE;
  ctx.fillRect(pad, Math.round(authorBaseline - authorSize * 0.3), ruleWidth, 1);

  ctx.font = `500 ${authorSize}px Archivo, system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.fillText(author, pad + ruleWidth + gutter, authorBaseline);

  const { size, lines } = fitQuote(ctx, text, {
    maxWidth: width - pad * 2 - (orientation === 'portrait' ? 0 : width * 0.12),
    maxHeight: height * 0.46,
    max: Math.round(height * bandCeiling(text)),
    min: Math.round(height * 0.024),
    lineHeight,
  });

  ctx.fillStyle = '#ffffff';
  const quoteBottom = authorBaseline - authorSize - Math.round(height * 0.05);
  lines.forEach((line, i) => {
    const y = quoteBottom - (lines.length - 1 - i) * size * lineHeight;
    ctx.fillText(line, pad, y);
  });

  const blob = await toBlob(canvas);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `quote-${slug(author)}.jpg`;
  link.click();
  URL.revokeObjectURL(url);

  return { width, height };
}
