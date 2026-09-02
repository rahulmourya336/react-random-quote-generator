import { useCallback, useEffect, useRef, useState } from 'react';
import QUOTES from './QuoteList.json';
import { downloadCard, PRESETS } from './renderCard';
import './QuotesGenerator.css';

const TOTAL = QUOTES.length;
const PORTRAIT = '(max-width: 40rem)';

const pickIndex = () => Math.floor(Math.random() * TOTAL);
const newSeed = () => Math.random().toString(36).slice(2, 10);
const backdropFor = (seed) => `https://picsum.photos/seed/${seed}/1600/1200`;

const SHORTCUTS = { n: 'quote', b: 'backdrop', d: 'download' };

// The collection is stored with typewriter punctuation. On a plate set in
// Fraunces, straight quotes read as a mistake, so they are corrected on the way
// to the page — and the export reads the corrected text back off the DOM.
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

export default function QuotesGenerator() {
  const [index, setIndex] = useState(pickIndex);
  const [draw, setDraw] = useState(0);
  const [seed, setSeed] = useState(newSeed);
  const [plate, setPlate] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [orientation, setOrientation] = useState('landscape');

  const quoteRef = useRef(null);
  const citeRef = useRef(null);

  const quote = QUOTES[index];
  const text = typeset(quote.text);
  const author = typeset(quote.author || 'Anonymous');

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

  // The plate turns portrait on narrow screens, and the export follows it.
  useEffect(() => {
    const query = window.matchMedia(PORTRAIT);
    const sync = () => setOrientation(query.matches ? 'portrait' : 'landscape');
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const saveCard = useCallback(async () => {
    setBusy(true);
    setStatus({ text: 'Rendering your card…' });
    try {
      const { width, height } = await downloadCard({
        src: backdropFor(seed),
        // Read from the DOM so anything rewritten in place is what gets saved.
        text: quoteRef.current?.textContent?.trim() || text,
        author: citeRef.current?.textContent?.trim() || author,
        orientation,
      });
      setStatus({ text: `Saved a ${width} × ${height} card to your downloads.` });
    } catch (error) {
      setStatus({
        text: `${error.message} Shuffle the backdrop and try again.`,
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }, [seed, text, author, orientation]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (event.target.isContentEditable) return;
      const action = SHORTCUTS[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      if (action === 'quote') drawQuote();
      if (action === 'backdrop') shuffleBackdrop();
      if (action === 'download' && !busy) saveCard();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawQuote, shuffleBackdrop, saveCard, busy]);

  // Rewriting stays plain text, whatever gets pasted in.
  const onPaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text/plain').replace(/\s+/g, ' ');
    document.execCommand('insertText', false, typeset(pasted));
  };

  return (
    <div className="app">
      <header className="masthead">
        <svg
          className="masthead__mark"
          width="26"
          height="16"
          viewBox="0 0 26 16"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="7.25" fill="#9089FA" />
          <circle cx="18" cy="8" r="7.25" fill="#EF899E" />
        </svg>
        <h1 className="wordmark">Quotes Generator</h1>
      </header>

      <main className="stage">
        <figure className="plate" data-plate={plate} aria-live="polite">
          <img
            className="plate__image"
            src={backdropFor(seed)}
            alt=""
            width="1600"
            height="1200"
            fetchPriority="high"
            crossOrigin="anonymous"
            onLoad={() => setPlate('ready')}
            onError={() => setPlate('failed')}
          />
          <div className="plate__scrim" aria-hidden="true" />
          <div className="plate__grain" aria-hidden="true" />

          <figcaption
            className="plate__caption"
            key={draw}
            data-length={lengthBand(text)}
          >
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

        <aside className="rail">
          <div className="rail__label">
            <p className="rail__index">
              <b>№ {(index + 1).toLocaleString()}</b> of {TOTAL.toLocaleString()}
            </p>
            <hr className="rail__rule" />
            <p className="rail__author">{author}</p>
          </div>

          <div className="rail__actions">
            <button className="btn btn--primary" type="button" onClick={drawQuote}>
              New quote
              <kbd className="btn__key">N</kbd>
            </button>
            <button className="btn" type="button" onClick={shuffleBackdrop}>
              Shuffle backdrop
              <kbd className="btn__key">B</kbd>
            </button>
            <button
              className="btn btn--download"
              type="button"
              onClick={saveCard}
              disabled={busy}
            >
              {busy ? 'Rendering…' : 'Download card'}
              <kbd className="btn__key">D</kbd>
            </button>
          </div>

          <p className="rail__note">
            Click the quote or the name to rewrite it. Cards export at{' '}
            {PRESETS[orientation].width} × {PRESETS[orientation].height}.
          </p>

          <p
            className="rail__status"
            role="status"
            data-tone={status?.tone ?? 'info'}
          >
            {status?.text}
          </p>
        </aside>
      </main>

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
