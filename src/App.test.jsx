import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import App from './App';
import QUOTES from './QuotesGenerator/QuoteList.json';
import { typeset } from './QuotesGenerator/QuotesGenerator';

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
  expect(screen.getByRole('button', { name: /download card/i })).toBeEnabled();
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
