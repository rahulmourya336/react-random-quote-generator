import '@testing-library/jest-dom/vitest';

// jsdom ships no matchMedia, so the plate always reports its landscape default
// under test. Override `matches` in a test that needs the portrait branch.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    media: query,
    matches: false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
