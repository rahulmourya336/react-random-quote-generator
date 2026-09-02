# Quotes Generator

Draw a quote from a collection of 1,643, set it on a photographic plate, rewrite
it if you like, and download the card.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
npm test         # vitest
```

## How it works

A quote is drawn at random from `src/QuotesGenerator/QuoteList.json` and paired
with a backdrop from [Lorem Picsum](https://picsum.photos). Both the quote and
the attribution are editable in place, so the card you download is the card you
see.

`New quote` (**N**) draws again, `Shuffle backdrop` (**B**) changes the
photograph, `Download card` (**D**) saves a JPEG — 1200 × 800 on wide screens,
1080 × 1350 on narrow ones.

### The download

`src/QuotesGenerator/renderCard.js` draws the finished card onto a canvas rather
than screenshotting the DOM. The export is a fixed-size poster instead of a
capture at whatever the viewport happened to be, and it leaves the on-screen CSS
free to use blend modes and filters. It relies on Lorem Picsum serving
`Access-Control-Allow-Origin: *`, which keeps the canvas untainted.

## Design

The house style is *Ink & Plate*: a deep violet ground, with periwinkle
(`#9089FA`) marking anything you can act on and rose (`#EF899E`) reserved for
attribution — both carried over from the app's original PWA theme colours. The
quote sets in **Fraunces**, the interface in **Archivo**. Type size responds to
how long the quote is, so a four-word aphorism and a six-line one each get a
size that suits them.

## Built with

Vite, React 19, and `vite-plugin-pwa` (Workbox) for offline support.

## Hosted on

[Vercel](https://react-random-quote.vercel.app/)

`vercel.json` pins the framework to Vite and the output to `dist/`. If the
Vercel project still has **Create React App** selected as its framework preset,
change it to **Vite** in Project Settings → Build & Development Settings — the
preset in the dashboard takes precedence over the repo for some fields, and the
old preset looks for a `build/` directory that no longer exists.
