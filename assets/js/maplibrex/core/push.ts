/**
 * push - the one way the hooks send events to their LiveView
 *
 * Every hook pushes its events with `push(hook, event, payload)` instead of
 * calling `hook.pushEvent` itself, so that all of them:
 *
 * - push only the events their component asked for (#45). A component
 *   rendered with an `events` list (an `events` key in its `data-config`)
 *   pushes only the events named in it; without one, it pushes every event,
 *   as before. The list is read from the element's current config, so a
 *   re-render that changes it applies to the next push.
 * - drop an event that cannot be delivered (#23). The events the hooks push
 *   are notifications: no hook waits for a reply. LiveView 1.1+ returns a
 *   promise from `pushEvent` that rejects when the view is disconnected, the
 *   push times out or the server rejects it; that rejection is caught. A
 *   `pushEvent` that throws (a hook whose view is gone) is caught too.
 *
 * A push given a reply callback is a request, not a notification: it is never
 * filtered, since its caller waits for the reply. No hook sends one; only
 * `EventDispatcher.pushToLiveView` passes a callback on, when its caller
 * gives one.
 */

import type { HookContext } from '../types';
import { logger } from './logger';

/** What `push` needs of a hook: its element, whose `data-config` may list the events to push, and `pushEvent`. */
export interface EventPusher {
  el?: HTMLElement;
  pushEvent: HookContext['pushEvent'];
}

/** The `events` list last read from each element's config, kept with the config it came from. */
const filters = new WeakMap<HTMLElement, { config: string; events: Set<string> | null }>();

/** The events the component on `el` asked for, or `null` when it did not give a list. */
function requestedEvents(el: HTMLElement | undefined): Set<string> | null {
  const config = el?.dataset?.config;
  if (!el || config === undefined) return null;

  const cached = filters.get(el);
  if (cached?.config === config) return cached.events;

  let events: Set<string> | null = null;
  try {
    const list: unknown = JSON.parse(config)?.events;
    if (Array.isArray(list)) events = new Set(list.map(String));
  } catch {
    // A config that is not JSON lists no events: push everything.
  }
  filters.set(el, { config, events });
  return events;
}

/** Whether the component on `hook.el` pushes `event`: it gave no `events` list, or one naming it. */
export function wantsEvent(hook: EventPusher, event: string): boolean {
  const events = requestedEvents(hook.el);
  return events === null || events.has(event);
}

/**
 * Push `event` with `payload` from `hook`, if its component asked for it, and
 * drop it quietly if it cannot be delivered. With `onReply`, the push is a
 * request: it is always sent, and `onReply` gets the reply.
 */
export function push(hook: EventPusher, event: string, payload: Record<string, unknown>, onReply?: () => void): void {
  if (!onReply && !wantsEvent(hook, event)) return;

  try {
    const result: unknown = onReply ? hook.pushEvent(event, payload, onReply) : hook.pushEvent(event, payload);
    settle(result, event);
  } catch (error) {
    logger.debug(`[MaplibreX] Could not push ${event}:`, error);
  }
}

/** Catch the rejection of `result`, if it is a promise: an event that could not be delivered is dropped. */
export function settle(result: unknown, event: string): void {
  if (result !== null && typeof result === 'object' && typeof (result as PromiseLike<unknown>).then === 'function') {
    (result as PromiseLike<unknown>).then(undefined, (error: unknown) =>
      logger.debug(`[MaplibreX] Could not push ${event}:`, error)
    );
  }
}
