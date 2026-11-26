/**
 * The pure helpers behind `ManagedLayer`'s updates. The lifecycle itself is
 * covered through the layer hooks in layer-lifecycle.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { type DesiredLayer, diffLayer, isEqual } from '../js/maplibrex/core/managed-layer';

describe('isEqual', () => {
  it('compares JSON values deeply, regardless of object key order', () => {
    expect(isEqual({ a: 1, b: [1, { c: 'x' }] }, { b: [1, { c: 'x' }], a: 1 })).toBe(true);
    expect(isEqual(['==', ['get', 'kind'], 'cafe'], ['==', ['get', 'kind'], 'bar'])).toBe(false);
    expect(isEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(isEqual({ 0: 1 }, [1])).toBe(false);
    expect(isEqual(null, {})).toBe(false);
    expect(isEqual(1, '1')).toBe(false);
  });

  it('treats a key holding undefined as absent, as JSON does', () => {
    expect(isEqual({ spec: { type: 'circle' }, beforeId: undefined }, { spec: { type: 'circle' } })).toBe(true);
    expect(isEqual({ a: undefined }, { a: null })).toBe(false);
  });
});

describe('diffLayer', () => {
  const current: DesiredLayer = {
    spec: { type: 'circle', source: 's', paint: { 'circle-radius': 6, 'circle-color': '#f00' }, layout: {}, minzoom: 2 }
  };
  const withSpec = (spec: Record<string, unknown>, beforeId?: string): DesiredLayer => ({
    spec: { ...current.spec, ...spec },
    beforeId
  });

  it('lists the changes MapLibre can apply in place, removed properties as undefined', () => {
    const next = withSpec(
      {
        paint: { 'circle-radius': 8, 'circle-opacity': 0.5 },
        layout: { visibility: 'none' },
        filter: ['has', 'name'],
        minzoom: 3,
        maxzoom: 12
      },
      'labels'
    );

    expect(diffLayer(current, next)).toEqual([
      { kind: 'paint', name: 'circle-radius', value: 8 },
      { kind: 'paint', name: 'circle-color', value: undefined },
      { kind: 'paint', name: 'circle-opacity', value: 0.5 },
      { kind: 'layout', name: 'visibility', value: 'none' },
      { kind: 'filter', value: ['has', 'name'] },
      { kind: 'zoom', minzoom: 3, maxzoom: 12 },
      { kind: 'move', beforeId: 'labels' }
    ]);
    expect(diffLayer(next, withSpec({ paint: next.spec.paint, layout: next.spec.layout, minzoom: 3, maxzoom: 12 }, 'labels'))).toEqual([
      { kind: 'filter', value: undefined }
    ]);
  });

  it('finds nothing to change between equal states, whatever their key order', () => {
    const reordered: DesiredLayer = {
      spec: { minzoom: 2, layout: {}, paint: { 'circle-color': '#f00', 'circle-radius': 6 }, source: 's', type: 'circle' }
    };

    expect(diffLayer(current, reordered)).toEqual([]);
  });

  it.each([
    ['the type', { type: 'symbol' }],
    ['the source', { source: 'other' }],
    ['the source layer', { 'source-layer': 'roads' }],
    ['a removed zoom bound', { minzoom: undefined }],
    ['any other spec key', { metadata: { note: 'x' } }]
  ])('asks for a re-add when %s changes', (_what, spec) => {
    expect(diffLayer(current, withSpec(spec))).toBeNull();
  });
});
