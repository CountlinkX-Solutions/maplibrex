import { afterEach, describe, expect, it } from 'vitest';
import { mountHook, registerMap, resetEnvironment } from './helpers';
import { ScaleControlHook } from '../js/maplibrex/hooks';

describe('test harness', () => {
  afterEach(resetEnvironment);

  it('mounts a hook against a fake map and records its calls', () => {
    const map = registerMap('m');

    const { hook } = mountHook(ScaleControlHook, { id: 'scale', mapId: 'm', position: 'top-left' });

    expect(map.addControl).toHaveBeenCalledTimes(1);
    expect(hook.pushEvent).not.toHaveBeenCalled();
  });
});
