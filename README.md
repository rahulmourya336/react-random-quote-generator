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
npm run icons    # regenerate the icons and social card
```

### Icons

`scripts/generate-icons.mjs` writes every icon, `favicon.ico`, `favicon.svg`
and the 1200 × 630 `og.png` from the palette. The mark is two overlapping ink
dots: periwinkle and rose, screen-blended where they cross, the way two spot
inks overprint. It is pure geometry, so the script rasterises it directly
rather than depending on an image library for six static files. Re-run it after
changing a palette value.

The social card carries the mark but no wordmark: rendering Fraunces would mean
adding a font-capable rasteriser. The unfurl title and description supply the
words. If you want the name set on the card, add `@resvg/resvg-js` and point it
at the font file.

## How it works

A quote is drawn at random from `src/QuotesGenerator/QuoteList.json` and paired
with a backdrop from [Lorem Picsum](https://picsum.photos). Both the quote and
the attribution are editable in place, so the card you download is the card you
see.

`New quote` (**N**) draws again and `Shuffle backdrop` (**B**) changes the
photograph.

### Sizes

Four sizes, defined once in `FORMATS` in `renderCard.js`:

| Size | Pixels | Made for |
| --- | --- | --- |
| Share card | 1200 × 800 | Posts and messages |
| Profile | 1080 × 1080 | Avatars, cropped round |
| Desktop | 2560 × 1440 | 16:9 screens |
| Phone | 1170 × 2532 | Lock and home screen |

Choosing a size reshapes the plate and re-requests the backdrop at the new
dimensions under the same seed, so it is the same photograph recropped, and the
preview is the crop you will get in the file.

### Placement and text size

The nine-cell grid moves the quote to any corner, edge or the middle, and the
minus and plus steps take the type from 70% to 145% of the size the quote would
otherwise get. Both drive the preview and the export from the same numbers.

Each size opens at a sensible placement: Share card and Desktop hang their text
bottom-left, while Profile and Phone centre it, because an avatar is masked to
a circle and a wallpaper sits behind a clock and icons. That default applies
until you move the text yourself, after which your placement is kept when you
switch sizes. `Reset layout` puts both back.

The scrim follows the words rather than the format. Text against an edge gets a
gradient weighted to that edge; text in the middle gets an even wash and a
vignette. The Profile text column is held inside the circle the avatar gets cut
to.

### Sharing

On a phone the three outputs move to a bar pinned to the bottom of the screen,
within thumb reach whatever else is scrolled. Share keeps its label there and
the other two become icons, so all three fit on a narrow screen.

`Share` (**S**) hands the image to the OS share sheet through the Web Share API,
`Copy image` (**C**) puts it on the clipboard, and `Download` (**D**) saves it.
Share and Copy are feature-detected and hidden where the browser lacks them, so
Download is always present as the fallback. One render feeds all three; the PNG
is encoded alongside the JPEG only because Chrome will not accept a JPEG on the
clipboard.

### The render

`src/QuotesGenerator/renderCard.js` draws the finished image onto a canvas
rather than screenshotting the DOM. The output is a real fixed-size image
instead of a capture at whatever the viewport happened to be, and it leaves the
on-screen CSS free to use blend modes and filters. It relies on Lorem Picsum
serving `Access-Control-Allow-Origin: *`, which keeps the canvas untainted.

On screen the plate is a CSS container, so the quote is sized in container
units against the plate rather than the viewport. A narrow phone wallpaper and
a wide desktop one are each set in proportion to the image they belong to, and
the canvas uses the same fractions so the file matches the preview.

## Design

The house style is *Ink & Plate*: a deep violet ground, with periwinkle
(`#9089FA`) marking anything you can act on and rose (`#EF899E`) reserved for
attribution. Both are carried over from the app's original PWA theme colours. The
quote sets in **Fraunces**, the interface in **Archivo**. Type size responds to
how long the quote is, so a four-word aphorism and a six-line one each get a
size that suits them.

## Built with

Vite, React 19, and `vite-plugin-pwa` (Workbox) for offline support.

## Hosted on

[Vercel](https://react-random-quote.vercel.app/)

`vercel.json` pins the framework to Vite and the output to `dist/`. If the
Vercel project still has **Create React App** selected as its framework preset,
change it to **Vite** in Project Settings → Build & Development Settings. The
preset in the dashboard takes precedence over the repo for some fields, and the
old preset looks for a `build/` directory that no longer exists.
