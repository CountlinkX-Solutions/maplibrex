/**
 * Debug-gated logging.
 *
 * MaplibreX is chatty during development — every hook reports its lifecycle —
 * but a library must not pollute a host application's console in production.
 * `logger.debug` is silent unless debugging is explicitly enabled; warnings and
 * errors always reach the console because they signal a real problem.
 *
 * Debugging is enabled by either:
 *   - `debug: true` on a `<.map>` component's config, or
 *   - `window.__MAPLIBREX_DEBUG__ = true` before the bundle loads.
 */

declare global {
  interface Window {
    __MAPLIBREX_DEBUG__?: boolean;
  }
}

let debugEnabled: boolean =
  typeof window !== 'undefined' && window.__MAPLIBREX_DEBUG__ === true;

/**
 * Enable or disable debug output for the whole library.
 */
export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

/**
 * Whether debug output is currently enabled.
 */
export function isDebug(): boolean {
  return debugEnabled;
}

export const logger = {
  /** Lifecycle and diagnostic output. Silent unless debugging is enabled. */
  debug(...args: unknown[]): void {
    if (debugEnabled) {
      console.log(...args);
    }
  },

  /** Recoverable problems. Always logged. */
  warn(...args: unknown[]): void {
    console.warn(...args);
  },

  /** Failures. Always logged. */
  error(...args: unknown[]): void {
    console.error(...args);
  }
};
