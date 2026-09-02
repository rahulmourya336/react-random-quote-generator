import { useCallback, useEffect, useRef, useState } from 'react';
import QUOTES from './QuoteList.json';
import {
  DEFAULT_SCALE,
  FORMATS,
  SCALES,
  backdropFor,
  canCopyImage,
  canShareImage,
  copyImage,
  renderCard,
  saveToDisk,
  shareImage,
} from './renderCard';
import './QuotesGenerator.css';

const TOTAL = QUOTES.length;
const FORMAT_KEYS = Object.keys(FORMATS);

const pickIndex = () => Math.floor(Math.random() * TOTAL);
const newSeed = () => Math.random().toString(36).slice(2, 10);

const SHORTCUTS = { n: 'quote', b: 'backdrop', s: 'share', c: 'copy', d: 'download' };

const ROWS = ['top', 'middle', 'bottom'];
const COLS = ['left', 'center', 'right'];

// The collection is stored with typewriter punctuation. On a plate set in
// Fraunces, straight quotes read as a mistake, so they are corrected on the way
// to the page, and the export reads the corrected text back off the DOM.
export function typeset(text) {
  return text
    .replace(/\.\.\./g, '…')
    .replace(/"([^"]*)"/g, '“$1”')
    .replace(/(\w)'(\w)/g, '$1’$2')
    .replace(/'/g, '’');
}

// Sets the type size band, so a four-word aphorism and a six-line one each get
// a size that suits them rather than one compromise between the two.
function lengthBand(text) {
  if (text.length <= 62) return 'short';
  if (text.length <= 120) return 'medium';
  if (text.length <= 200) return 'long';
  return 'epic';
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const ShareIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M8 1.8v8.4M8 1.8 5.2 4.6M8 1.8l2.8 2.8M2.8 9.2v4a1 1 0 0 0 1 1h8.4a1 1 0 0 0 1-1v-4" {...stroke} />
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <rect x="5.4" y="5.4" width="8.2" height="8.2" rx="2" {...stroke} />
    <path d="M10.6 5.4V3.8a1.4 1.4 0 0 0-1.4-1.4H3.8a1.4 1.4 0 0 0-1.4 1.4v5.4a1.4 1.4 0 0 0 1.4 1.4h1.6" {...stroke} />
  </svg>
);

const SaveIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M8 2v8.2M8 10.2 5 7.2M8 10.2l3-3M2.8 12.6v.6a1 1 0 0 0 1 1h8.4a1 1 0 0 0 1-1v-.6" {...stroke} />
  </svg>
);

const DiceIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <rect x="2.4" y="2.4" width="11.2" height="11.2" rx="3.2" {...stroke} />
    <circle cx="6" cy="6" r="1" fill="currentColor" />
    <circle cx="10" cy="10" r="1" fill="currentColor" />
  </svg>
);

export default function QuotesGenerator() {
  const [index, setIndex] = useState(pickIndex);
  const [draw, setDraw] = useState(0);
  const [seed, setSeed] = useState(newSeed);
  const [format, setFormat] = useState('post');
  const [plate, setPlate] = useState('loading');
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState(null);
  const [placement, setPlacement] = useState(FORMATS.post.placement);
  const [placed, setPlaced] = useState(false);
  const [scaleStep, setScaleStep] = useState(DEFAULT_SCALE);
  const [shareable, setShareable] = useState(false);
  const [copyable, setCopyable] = useState(false);

  const quoteRef = useRef(null);
  const citeRef = useRef(null);

  const quote = QUOTES[index];
  const text = typeset(quote.text);
  const author = typeset(quote.author || 'Anonymous');
  const spec = FORMATS[format];
  const src = backdropFor(seed, format);
  const scale = SCALES[scaleStep];

  useEffect(() => {
    setShareable(canShareImage());
    setCopyable(canCopyImage());
  }, []);

  const drawQuote = useCallback(() => {
    setIndex((current) => {
      let next = pickIndex();
      while (TOTAL > 1 && next === current) next = pickIndex();
      return next;
    });
    setDraw((n) => n + 1);
    setStatus(null);
  }, []);

  const shuffleBackdrop = useCallback(() => {
    setPlate('loading');
    setSeed(newSeed());
    setStatus(null);
  }, []);

  const chooseFormat = useCallback(
    (next) => {
      setPlate('loading');
      setFormat(next);
      if (!placed) setPlacement(FORMATS[next].placement);
      setStatus(null);
    },
    [placed],
  );

  const place = useCallback((v, h) => {
    setPlacement({ v, h });
    setPlaced(true);
    setStatus(null);
  }, []);

  const resetLayout = useCallback(() => {
    setPlaced(false);
    setScaleStep(DEFAULT_SCALE);
    setPlacement(FORMATS[format].placement);
    setStatus(null);
  }, [format]);

  // One render feeds all three outputs; the words come off the DOM so anything
  // rewritten in place is what gets shared.
  const build = useCallback(
    () =>
      renderCard({
        src,
        text: quoteRef.current?.textContent?.trim() || text,
        author: citeRef.current?.textContent?.trim() || author,
        format,
        placement,
        scale,
      }),
    [src, text, author, format, placement, scale],
  );

  const run = useCallback(async (job, work) => {
    setBusy(job);
    setStatus({ text: 'Rendering…' });
    try {
      setStatus({ text: await work() });
    } catch (error) {
      if (error?.name === 'AbortError') setStatus(null);
      else setStatus({ text: error.message, tone: 'error' });
    } finally {
      setBusy(null);
    }
  }, []);

  const onShare = useCallback(
    () =>
      run('share', async () => {
        const card = await build();
        await shareImage({
          blob: card.jpeg,
          filename: card.filename,
          text: quoteRef.current?.textContent?.trim() || text,
          author: citeRef.current?.textContent?.trim() || author,
        });
        return 'Shared.';
      }),
    [run, build, text, author],
  );

  const onCopy = useCallback(
    () =>
      run('copy', async () => {
        const card = await build();
        await copyImage(card.png);
        return 'Image copied. Paste it anywhere.';
      }),
    [run, build],
  );

  const onSave = useCallback(
    () =>
      run('save', async () => {
        const card = await build();
        saveToDisk(card.jpeg, card.filename);
        return `Saved ${card.width} × ${card.height} to your downloads.`;
      }),
    [run, build],
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (event.target.isContentEditable) return;
      const action = SHORTCUTS[event.key.toLowerCase()];
      if (!action || busy) return;
      event.preventDefault();
      if (action === 'quote') drawQuote();
      if (action === 'backdrop') shuffleBackdrop();
      if (action === 'share' && shareable) onShare();
      if (action === 'copy' && copyable) onCopy();
      if (action === 'download') onSave();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawQuote, shuffleBackdrop, onShare, onCopy, onSave, busy, shareable, copyable]);

  // Rewriting stays plain text, whatever gets pasted in.
  const onPaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text/plain').replace(/\s+/g, ' ');
    document.execCommand('insertText', false, typeset(pasted));
  };

  return (
    <div className="app">
      <header className="masthead">
        <svg className="masthead__mark" width="26" height="16" viewBox="0 0 26 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7.25" fill="#9089FA" />
          <circle cx="18" cy="8" r="7.25" fill="#EF899E" />
        </svg>
        <h1 className="wordmark">Quotes Generator</h1>
        <p className="masthead__note">Pick a size, then share it or make it your wallpaper.</p>
      </header>

      <main className="stage">
        <div className="platebox">
          <figure
            className="plate"
            data-plate={plate}
            data-format={format}
            data-v={placement.v}
            data-h={placement.h}
            style={{ '--ratio': spec.ratio, '--text-scale': scale }}
            aria-live="polite"
          >
            <img
              className="plate__image"
              src={src}
              alt=""
              width={spec.w}
              height={spec.h}
              fetchPriority="high"
              crossOrigin="anonymous"
              onLoad={() => setPlate('ready')}
              onError={() => setPlate('failed')}
            />
            <div className="plate__scrim" aria-hidden="true" />
            <div className="plate__grain" aria-hidden="true" />

            <figcaption className="plate__caption" key={draw} data-length={lengthBand(text)}>
              <blockquote
                className="plate__quote"
                ref={quoteRef}
                contentEditable="plaintext-only"
                suppressContentEditableWarning
                spellCheck="false"
                onPaste={onPaste}
                aria-label="Quote, editable"
              >
                {text}
              </blockquote>
              <div className="plate__by">
                <span className="plate__rule" aria-hidden="true" />
                <cite
                  className="plate__cite"
                  ref={citeRef}
                  contentEditable="plaintext-only"
                  suppressContentEditableWarning
                  spellCheck="false"
                  onPaste={onPaste}
                  aria-label="Attribution, editable"
                >
                  {author}
                </cite>
              </div>
            </figcaption>
          </figure>

          <p className="credit">
            <span className="credit__author">{author}</span>
            <span className="credit__index">
              № {(index + 1).toLocaleString()} of {TOTAL.toLocaleString()}
            </span>
          </p>
        </div>

        <aside className="rail">
          <div className="draws">
            <button className="pill pill--primary" type="button" onClick={drawQuote}>
              <span className="pill__label">New quote</span>
              <kbd className="pill__key">N</kbd>
            </button>
            <button
              className="pill pill--icon"
              type="button"
              onClick={shuffleBackdrop}
              aria-label="Shuffle backdrop"
              title="Shuffle backdrop"
            >
              <DiceIcon />
            </button>
          </div>

          <div className="group">
            <div className="sizes" role="group" aria-label="Image size">
              {FORMAT_KEYS.map((key) => {
                const f = FORMATS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    className="size"
                    aria-pressed={key === format}
                    onClick={() => chooseFormat(key)}
                  >
                    <span className="size__shape" style={{ '--ratio': f.ratio }} aria-hidden="true" />
                    <span className="size__label">{f.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="caption">
              {spec.w} × {spec.h} for {spec.note}
            </p>
          </div>

          <div className="group tweaks">
            <div className="place" role="group" aria-label="Text placement">
              {ROWS.map((v) =>
                COLS.map((h) => (
                  <button
                    key={`${v}-${h}`}
                    type="button"
                    className="place__cell"
                    aria-pressed={placement.v === v && placement.h === h}
                    aria-label={`Place text ${v} ${h}`}
                    onClick={() => place(v, h)}
                  />
                )),
              )}
            </div>

            <div className="textsize">
              <button
                type="button"
                className="step"
                aria-label="Smaller text"
                disabled={scaleStep === 0}
                onClick={() => setScaleStep((n) => Math.max(0, n - 1))}
              >
                &minus;
              </button>
              <span className="textsize__value">Text {Math.round(scale * 100)}%</span>
              <button
                type="button"
                className="step"
                aria-label="Larger text"
                disabled={scaleStep === SCALES.length - 1}
                onClick={() => setScaleStep((n) => Math.min(SCALES.length - 1, n + 1))}
              >
                +
              </button>
            </div>

            <button type="button" className="linkish" onClick={resetLayout}>
              Reset layout
            </button>
          </div>

          <p className="caption caption--hint">Click the quote or the name to rewrite it.</p>

          <p className="status" role="status" data-tone={status?.tone ?? 'info'}>
            {status?.text}
          </p>
        </aside>
      </main>

      <div className="share">
        {shareable && (
          <button className="pill pill--share" type="button" onClick={onShare} disabled={!!busy}>
            <ShareIcon />
            <span className="pill__label">{busy === 'share' ? 'Sharing…' : 'Share'}</span>
            <kbd className="pill__key">S</kbd>
          </button>
        )}
        {copyable && (
          <button className="pill" type="button" onClick={onCopy} disabled={!!busy}>
            <CopyIcon />
            <span className="pill__label">{busy === 'copy' ? 'Copying…' : 'Copy image'}</span>
            <kbd className="pill__key">C</kbd>
          </button>
        )}
        <button className="pill" type="button" onClick={onSave} disabled={!!busy}>
          <SaveIcon />
          <span className="pill__label">{busy === 'save' ? 'Saving…' : 'Download'}</span>
          <kbd className="pill__key">D</kbd>
        </button>
      </div>

      <footer className="colophon">
        <p>
          Built by{' '}
          <a href="https://twitter.com/rahucrux" rel="noreferrer">
            Rahul Mourya
          </a>
        </p>
        <p>Backdrops from Lorem Picsum</p>
      </footer>
    </div>
  );
}
