import { describe, expect, it } from 'vitest';
import * as entry from '../js/maplibrex';

const CONTROL_HOOKS = ['ControlHook', 'ControlButtonHook', 'ControlGroupHook', 'ZoomRangeHook'];

describe('MapHooks registration', () => {
  it.each(CONTROL_HOOKS)('registers %s', (name) => {
    expect(Object.keys(entry.MapHooks)).toContain(name);
    expect((entry.MapHooks as Record<string, unknown>)[name]).toBeDefined();
  });

  it.each(CONTROL_HOOKS)('exports %s by name', (name) => {
    const exported = (entry as Record<string, unknown>)[name];
    expect(exported).toBeDefined();
    expect(exported).toBe((entry.MapHooks as Record<string, unknown>)[name]);
  });
});
