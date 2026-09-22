import '@testing-library/jest-dom/vitest';

import { afterEach, vi } from 'vitest';

// jsdom does not always ship crypto.randomUUID; components and tests may use it.
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: {}, writable: true });
}
if (typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => '00000000-0000-4000-8000-000000000000',
    writable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});
