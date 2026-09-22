import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Path aliases come from tsconfig.json (`@/*` -> `./src/*`).
    tsconfigPaths: true,
    alias: {
      // `server-only` throws outside a React Server Component graph, so unit
      // tests resolve it to an empty module. Route-handler tests still exercise
      // real server behaviour because they call the handlers directly.
      'server-only': path.resolve(process.cwd(), 'src/test/server-only-stub.ts'),
    },
  },
  test: {
    // Server/BFF tests exercise real Request/Response objects, so the node
    // environment is the default. UI tests opt into jsdom per file.
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    restoreMocks: true,
    clearMocks: true,
  },
});
