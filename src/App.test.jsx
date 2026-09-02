import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import App from './App';
import QUOTES from './QuotesGenerator/QuoteList.json';
import { typeset } from './QuotesGenerator/QuotesGenerator';
import { FORMATS } from './QuotesGenerator/renderCard';

test('straightens typewriter punctuation into real quotes and dashes', () => {
  expect(typeset("don't")).toBe('don’t');
  expect(typeset('He said "go".')).toBe('He said “go”.');
  expect(typeset('Wait...')).toBe('Wait…');
});

test('opens with a quote drawn from the collection', () => {
  render(<App />);

  const quote = document.querySelector('blockquote').textContent;
  const author = document.querySelector('cite').textContent;

  expect(QUOTES.some((entry) => typeset(entry.text) === quote)).toBe(true);
  expect(author).not.toBe('');
  expect(screen.getByText(/of 1,643/).textContent).toMatch(
    /^№ [\d,]+ of 1,643$/,
  );
});

test('every action is reachable by name', () => {
  render(<App />);

  expect(screen.getByRole('button', { name: /new quote/i })).toBeEnabled();
  expect(screen.getByRole('button', { name: /shuffle backdrop/i })).toBeEnabled();
  expect(screen.getByRole('button', { name: /download/i })).toBeEnabled();
});

test('drawing a new quote replaces the one on the plate', async () => {
  const user = userEvent.setup();
  render(<App />);

  const before = document.querySelector('blockquote').textContent;
  await user.click(screen.getByRole('button', { name: /new quote/i }));

  expect(document.querySelector('blockquote').textContent).not.toBe(before);
});

test('the quote and the attribution can be rewritten in place', () => {
  render(<App />);

  expect(document.querySelector('blockquote')).toHaveAttribute(
    'contenteditable',
    'plaintext-only',
  );
  expect(document.querySelector('cite')).toHaveAttribute(
    'contenteditable',
    'plaintext-only',
  );
});

test('offers every size, with the share card selected to begin with', () => {
  render(<App />);

  for (const spec of Object.values(FORMATS)) {
    expect(screen.getByRole('button', { name: new RegExp(spec.label, 'i') }))
      .toBeInTheDocument();
  }

  expect(
    screen.getByRole('button', { name: new RegExp(FORMATS.post.label, 'i') }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('choosing a size reshapes the plate and re-requests a matching backdrop', async () => {
  const user = userEvent.setup();
  render(<App />);

  const plate = document.querySelector('.plate');
  const image = document.querySelector('.plate__image');
  expect(plate).toHaveStyle({ '--ratio': String(FORMATS.post.ratio) });
  expect(image.getAttribute('src')).toContain(
    `/${FORMATS.post.w}/${FORMATS.post.h}`,
  );

  await user.click(screen.getByRole('button', { name: new RegExp(FORMATS.phone.label, 'i') }));

  expect(plate).toHaveStyle({ '--ratio': String(FORMATS.phone.ratio) });
  expect(plate).toHaveAttribute('data-format', 'phone');
  // Same seed, new dimensions: the same photograph, cropped for the new shape.
  expect(image.getAttribute('src')).toContain(
    `/${FORMATS.phone.w}/${FORMATS.phone.h}`,
  );
  expect(
    screen.getByRole('button', { name: new RegExp(FORMATS.phone.label, 'i') }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('text can be moved around the image and resized', async () => {
  const user = userEvent.setup();
  render(<App />);

  const plate = document.querySelector('.plate');
  // The share card starts bottom-left.
  expect(plate).toHaveAttribute('data-v', 'bottom');
  expect(plate).toHaveAttribute('data-h', 'left');
  expect(plate).toHaveStyle({ '--text-scale': '1' });

  await user.click(screen.getByRole('button', { name: /place text top right/i }));
  expect(plate).toHaveAttribute('data-v', 'top');
  expect(plate).toHaveAttribute('data-h', 'right');

  await user.click(screen.getByRole('button', { name: /larger text/i }));
  expect(screen.getByText(/^Text \d+%$/).textContent).toBe('Text 120%');

  await user.click(screen.getByRole('button', { name: /reset layout/i }));
  expect(plate).toHaveAttribute('data-v', 'bottom');
  expect(plate).toHaveAttribute('data-h', 'left');
  expect(screen.getByText(/^Text \d+%$/).textContent).toBe('Text 100%');
});

test('a size keeps its own default placement until the text is moved', async () => {
  const user = userEvent.setup();
  render(<App />);
  const plate = document.querySelector('.plate');

  // Profile centres its text, because an avatar is cropped round.
  await user.click(screen.getByRole('button', { name: new RegExp(FORMATS.square.label, 'i') }));
  expect(plate).toHaveAttribute('data-v', 'middle');
  expect(plate).toHaveAttribute('data-h', 'center');

  // Once moved deliberately, that choice survives a size change.
  await user.click(screen.getByRole('button', { name: /place text bottom right/i }));
  await user.click(screen.getByRole('button', { name: new RegExp(FORMATS.phone.label, 'i') }));
  expect(plate).toHaveAttribute('data-v', 'bottom');
  expect(plate).toHaveAttribute('data-h', 'right');
});
