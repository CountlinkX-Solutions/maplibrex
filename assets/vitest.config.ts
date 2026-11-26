import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests live in `assets/test/`, outside `assets/js/`: `assets/js` ships in the
// Hex package and is what esbuild bundles, so nothing under it may be a test.
// They are deliberately not part of tsconfig.json either (`mix typecheck`
// covers the shipped sources only); vitest transpiles them directly.
export default defineConfig({
  resolve: {
    alias: {
      'maplibre-gl': fileURLToPath(new URL('./test/mocks/maplibre-gl.ts', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    clearMocks: true
  }
});
