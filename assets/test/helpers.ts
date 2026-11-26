import { vi } from 'vitest';
import { Socket } from 'phoenix';
import { LiveSocket } from 'phoenix_live_view';
import { MapManager } from '../js/maplibrex/core/map-manager';
import { MapHooks } from '../js/maplibrex';
import { FakeMap, type FakeMapOptions, resetMocks } from './mocks/maplibre-gl';

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

/**
 * Register a fresh FakeMap under `id` and return it. Its container is
 * `container`, or a new element with that id in the document. Pass
 * `{ loaded: false }` for a map whose style is still loading.
 */
export function registerMap(id = 'map', container?: HTMLElement, options?: FakeMapOptions): FakeMap {
  if (!container) {
    container = document.createElement('div');
    container.id = id;
    document.body.appendChild(container);
  }
  const map = new FakeMap(container, options);
  MapManager.register(id, map as never);
  return map;
}

export interface LiveViewHarness {
  /** Apply a server re-render: LiveView patches the view to `html`. */
  render(html: string): void;
  /** Every event a hook pushed to the server (`pushEvent`), in order, as [event, payload]. */
  pushes: [string, unknown][];
  /** Deliver the server's answers to the pushes so far, in order (see `server`). */
  answer(): void;
}

export interface LiveViewOptions {
  /** `false`: the view is not connected and rejects every push. */
  connected?: boolean;
  /** Mount the real MapHook, which builds its map from the element's `data-config`, instead of the stub. */
  realMapHook?: boolean;
  /**
   * The LiveView's `handle_event/3` and re-render: given each pushed event
   * and its payload, the HTML it renders in answer, or `undefined` when
   * nothing changed. The answers wait for `answer()`; each is applied the way
   * LiveView applies a push's reply: the re-render is patched in, then the
   * promise `pushEvent` returned resolves.
   */
  server?: (event: string, payload: any) => string | undefined;
}

/**
 * Renders `html` in a real LiveView: the LiveSocket and View of the
 * phoenix_live_view client in deps/, never connected. LiveView itself mounts,
 * updates and destroys the hooks, and `render()` goes through its DOM patch
 * (morphdom), which matches elements by id anywhere in the view. The whole
 * view is a single dynamic, so every render patches all of it.
 *
 * `MapHook` is replaced by a stub that registers a FakeMap on its element,
 * the way the real hook creates a MapLibre map in it, unless `realMapHook`
 * is set. A hook's `pushEvent` is recorded in `pushes` instead of going to a
 * server, and answered at once with no re-render, unless `server` answers
 * it. With `connected: false` the unconnected view rejects every push, as
 * LiveView does while the socket is down, and `pushes` stays empty.
 */
export function renderLiveView(
  html: string,
  { connected = true, realMapHook = false, server }: LiveViewOptions = {}
): LiveViewHarness {
  const root = document.createElement('div');
  root.id = 'phx-test';
  root.setAttribute('data-phx-session', 'test');
  root.setAttribute('data-phx-static', '');
  document.body.appendChild(root);

  const FakeMapHook = {
    mounted(this: { el: HTMLElement }) {
      registerMap(this.el.id, this.el);
    }
  };
  const hooks = realMapHook ? MapHooks : { ...MapHooks, MapHook: FakeMapHook };
  const liveSocket = new LiveSocket('/live', Socket, { hooks });
  // What joining over the socket would do: create the root view, then apply
  // the server's first render.
  const view = (liveSocket as any).newRootView(root);
  const pushes: [string, unknown][] = [];
  const answers: (() => void)[] = [];
  if (connected) {
    view.pushHookEvent = (_el: unknown, _target: unknown, event: string, payload: unknown) => {
      pushes.push([event, payload]);
      if (!server) return Promise.resolve({ reply: undefined, ref: 0 });

      const next = server(event, payload);
      return new Promise((resolve) => {
        answers.push(() => {
          if (next !== undefined) view.update({ 0: next }, []);
          resolve({ reply: undefined, ref: 0 });
        });
      });
    };
  }
  view.onJoin({ rendered: { s: ['', ''], 0: html }, liveview_version: liveSocket.version() });

  return {
    render(next) {
      view.update({ 0: next }, []);
    },
    pushes,
    answer() {
      answers.splice(0).forEach((send) => send());
    }
  };
}

export interface MountOptions {
  /**
   * The hook's `pushEvent`, instead of the default spy. A plain function, not
   * a spy: a spy settles the promise it returns, so a rejected one would never
   * go unhandled. LiveView 1.1+ returns a promise that rejects when the push
   * fails.
   */
  pushEvent?: (event: string, payload: unknown) => unknown;
}

/**
 * Mount a hook object the way LiveView would: `this.el` carries the JSON
 * config in `data-config`, and `pushEvent` / `handleEvent` are spies.
 * `innerHTML` is rendered inside the element before `mounted()` runs.
 */
export function mountHook(
  definition: any,
  config: Record<string, unknown>,
  innerHTML = '',
  options: MountOptions = {}
): MountedHook {
  const el = document.createElement('div');
  el.id = String(config.id);
  el.dataset.config = JSON.stringify(config);
  el.innerHTML = innerHTML;
  document.body.appendChild(el);

  const serverHandlers = new Map<string, HookEventHandler[]>();
  const hook: any = Object.create(definition);
  hook.el = el;
  hook.pushEvent = options.pushEvent ?? vi.fn();
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
