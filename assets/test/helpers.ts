import { vi } from 'vitest';
import { MapManager } from '../js/maplibrex/core/map-manager';
import { FakeMap, resetMocks } from './mocks/maplibre-gl';

type HookEventHandler = (payload: any) => void;

export interface MountedHook {
  /** The hook context: the hook definition's own methods run with this as `this`. */
  hook: any;
  el: HTMLElement;
  /** Server-pushed event handlers registered through `handleEvent`. */
  serverHandlers: Map<string, HookEventHandler[]>;
  /** Simulate `push_event` from the server. */
  pushFromServer(event: string, payload: any): void;
  /** Re-render the element with a new config and run `updated()`. */
  update(config: Record<string, unknown>): void;
  destroy(): void;
}

/** Register a fresh FakeMap under `id` and return it. */
export function registerMap(id = 'map'): FakeMap {
  const map = new FakeMap();
  MapManager.register(id, map as never);
  return map;
}

/**
 * Mount a hook object the way LiveView would: `this.el` carries the JSON
 * config in `data-config`, and `pushEvent` / `handleEvent` are spies.
 * `innerHTML` is rendered inside the element before `mounted()` runs.
 */
export function mountHook(
  definition: any,
  config: Record<string, unknown>,
  innerHTML = ''
): MountedHook {
  const el = document.createElement('div');
  el.id = String(config.id);
  el.dataset.config = JSON.stringify(config);
  el.innerHTML = innerHTML;
  document.body.appendChild(el);

  const serverHandlers = new Map<string, HookEventHandler[]>();
  const hook: any = Object.create(definition);
  hook.el = el;
  hook.pushEvent = vi.fn();
  hook.pushEventTo = vi.fn();
  hook.handleEvent = vi.fn((event: string, handler: HookEventHandler) => {
    serverHandlers.set(event, [...(serverHandlers.get(event) ?? []), handler]);
  });

  hook.mounted();

  return {
    hook,
    el,
    serverHandlers,
    pushFromServer(event, payload) {
      (serverHandlers.get(event) ?? []).forEach((h) => h(payload));
    },
    update(next) {
      el.dataset.config = JSON.stringify(next);
      hook.updated?.();
    },
    destroy() {
      hook.destroyed?.();
      el.remove();
    }
  };
}

/** Clean slate between tests. */
export function resetEnvironment(): void {
  MapManager.clear();
  resetMocks();
  document.body.innerHTML = '';
}
