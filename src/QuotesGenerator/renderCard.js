/*
  Draws the finished image straight onto a canvas rather than screenshotting the
  DOM, so the output is a real fixed-size image at whatever the chosen format
  needs, and the on-screen CSS stays free to use blend modes and filters.
*/

const INK = '#17122e';
const ROSE = '#ef899e';

/*
  Every size the app can produce. `ratio` drives the on-screen plate, `w`/`h`
  drive both the export and the backdrop request, so what you see cropped on the
  plate is exactly what you get in the file.

  `placement` is only the starting point. The formats that get cropped or
  covered in use begin centred, because an avatar is masked to a circle and a
  wallpaper sits behind a clock and icons, but any size can be moved anywhere.
*/
export const FORMATS = {
  post: {
    label: 'Card',
    note: 'posts and messages',
    w: 1200,
    h: 800,
    ratio: 1.5,
    textWidth: 0.73,
    placement: { v: 'bottom', h: 'left' },
  },
  square: {
    label: 'Profile',
    note: 'avatars, cropped round',
    w: 1080,
    h: 1080,
    ratio: 1,
    // Kept inside the circle an avatar gets masked to.
    textWidth: 0.66,
    placement: { v: 'middle', h: 'center' },
  },
  desktop: {
    label: 'Desktop',
    note: '16:9 screens',
    w: 2560,
    h: 1440,
    ratio: 1.7778,
    textWidth: 0.73,
    placement: { v: 'bottom', h: 'left' },
  },
  phone: {
    label: 'Phone',
    note: 'lock and home screens',
    w: 1170,
    h: 2532,
    ratio: 0.4621,
    textWidth: 0.82,
    placement: { v: 'middle', h: 'center' },
  },
};

// Text size steps, as a multiplier on the size the quote would otherwise get.
export const SCALES = [0.7, 0.85, 1, 1.2, 1.45];
export const DEFAULT_SCALE = 2; // index into SCALES

export const backdropFor = (seed, format) => {
  const { w, h } = FORMATS[format] ?? FORMATS.post;
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
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
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// The scrim follows the words: it weights toward whichever edge they sit
// against, and becomes an even wash with a vignette when they sit in the middle.
function drawScrim(ctx, width, height, placement) {
  if (placement.v === 'middle') {
    ctx.fillStyle = 'rgba(23, 18, 46, 0.6)';
    ctx.fillRect(0, 0, width, height);
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.2,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72,
    );
    vignette.addColorStop(0, 'rgba(23, 18, 46, 0.08)');
    vignette.addColorStop(1, 'rgba(23, 18, 46, 0.82)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const fromBottom = placement.v === 'bottom';
  const gradient = ctx.createLinearGradient(
    0,
    fromBottom ? height : 0,
    0,
    fromBottom ? 0 : height,
  );
  gradient.addColorStop(0, 'rgba(23, 18, 46, 0.93)');
  gradient.addColorStop(0.22, 'rgba(23, 18, 46, 0.72)');
  gradient.addColorStop(0.52, 'rgba(23, 18, 46, 0.3)');
  gradient.addColorStop(0.82, 'rgba(23, 18, 46, 0.06)');
  gradient.addColorStop(1, 'rgba(23, 18, 46, 0.12)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (placement.h !== 'center') {
    const fromLeft = placement.h === 'left';
    const side = ctx.createLinearGradient(
      fromLeft ? 0 : width,
      0,
      fromLeft ? width * 0.52 : width * 0.48,
      0,
    );
    side.addColorStop(0, 'rgba(23, 18, 46, 0.42)');
    side.addColorStop(1, 'rgba(23, 18, 46, 0)');
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, width, height);
  }
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

// Mirrors the type bands the plate uses on screen, as a fraction of the image
// width, so the file is set the way the preview was.
export function bandCeiling(text) {
  if (text.length <= 62) return 0.088;
  if (text.length <= 120) return 0.066;
  if (text.length <= 200) return 0.05;
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

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('The image could not be encoded.')),
      type,
      quality,
    );
  });
}

/**
 * Paints the image and hands back the encoded blobs.
 * PNG comes along because the clipboard will not take a JPEG.
 */
export async function renderCard({
  src,
  text,
  author,
  format = 'post',
  placement,
  scale = 1,
}) {
  const spec = FORMATS[format] ?? FORMATS.post;
  const { w: width, h: height } = spec;
  const where = placement ?? spec.placement;
  const [image] = await Promise.all([loadImage(src), ensureFonts()]);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.filter = 'saturate(0.62) contrast(1.05) brightness(1.02)';
  drawCover(ctx, image, width, height);
  ctx.restore();

  drawScrim(ctx, width, height, where);
  drawGrain(ctx, width, height);

  const pad = Math.round(width * 0.075);
  const authorSize = Math.round(width * 0.021);
  const ruleWidth = Math.round(width * 0.04);
  const gutter = Math.round(authorSize * 0.85);
  const lineHeight = 1.14;

  const { size, lines } = fitQuote(ctx, text, {
    maxWidth: width * spec.textWidth,
    maxHeight: height * 0.66,
    max: Math.round(width * bandCeiling(text) * scale),
    min: Math.round(width * 0.02),
    lineHeight,
  });

  // Stack the quote and its attribution as one block, then place the block.
  const quoteHeight = lines.length * size * lineHeight;
  const spacer = Math.round(authorSize * 1.6);
  const blockHeight = quoteHeight + spacer + authorSize;

  const blockTop = {
    top: pad,
    middle: Math.round((height - blockHeight) / 2),
    bottom: height - pad - blockHeight,
  }[where.v];

  const textX = { left: pad, center: width / 2, right: width - pad }[where.h];

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = where.h === 'center' ? 'center' : where.h;
  ctx.fillStyle = '#ffffff';
  ctx.font = quoteFont(size);
  lines.forEach((line, i) => {
    ctx.fillText(line, textX, blockTop + size * 0.86 + i * size * lineHeight);
  });

  const authorBaseline = blockTop + quoteHeight + spacer + authorSize * 0.8;
  ctx.font = `500 ${authorSize}px Archivo, system-ui, sans-serif`;
  const authorWidth = ctx.measureText(author).width;
  const runWidth = ruleWidth + gutter + authorWidth;

  const ruleX = {
    left: pad,
    center: width / 2 - runWidth / 2,
    right: width - pad - runWidth,
  }[where.h];

  ctx.fillStyle = ROSE;
  ctx.fillRect(
    ruleX,
    Math.round(authorBaseline - authorSize * 0.3),
    ruleWidth,
    Math.max(1, Math.round(width / 1200)),
  );

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.fillText(author, ruleX + ruleWidth + gutter, authorBaseline);

  const [jpeg, png] = await Promise.all([
    toBlob(canvas, 'image/jpeg', 0.92),
    toBlob(canvas, 'image/png'),
  ]);

  return {
    width,
    height,
    jpeg,
    png,
    filename: `quote-${slug(author)}-${format}.jpg`,
  };
}

export function saveToDisk(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function canShareImage() {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  try {
    const probe = new File([new Blob([''])], 'probe.jpg', { type: 'image/jpeg' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function shareImage({ blob, filename, text, author }) {
  const file = new File([blob], filename, { type: blob.type });
  await navigator.share({
    files: [file],
    title: 'Quotes Generator',
    text: `“${text}”\n${author}`,
  });
}

export function canCopyImage() {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof window !== 'undefined' &&
    typeof window.ClipboardItem !== 'undefined'
  );
}

export async function copyImage(pngBlob) {
  // Chrome only accepts PNG on the clipboard, which is why both are encoded.
  await navigator.clipboard.write([
    new window.ClipboardItem({ 'image/png': pngBlob }),
  ]);
}
