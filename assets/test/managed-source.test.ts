/**
 * The pure helper behind `ManagedSource`'s updates. The lifecycle itself is
 * covered through the source hooks in source-lifecycle.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { type InPlaceUpdates, type SourceSpec, diffSource } from '../js/maplibrex/core/managed-source';

const setUrl = { method: 'setUrl', args: (spec: SourceSpec) => [spec.url] };
const setTiles = { method: 'setTiles', args: (spec: SourceSpec) => [spec.tiles] };
const setClusterOptions = { method: 'setClusterOptions', args: (spec: SourceSpec) => [{ cluster: spec.cluster }] };
const IN_PLACE: InPlaceUpdates = {
  url: setUrl,
  tiles: setTiles,
  cluster: setClusterOptions,
  clusterRadius: setClusterOptions
};

const current: SourceSpec = { type: 'vector', url: 'a.json', minzoom: 0, cluster: true, clusterRadius: 50 };

describe('diffSource', () => {
  it('lists the in-place update of each changed key that has one', () => {
    expect(diffSource(current, { ...current, url: 'b.json', tiles: ['t/{z}/{x}/{y}'] }, IN_PLACE)).toEqual([setUrl, setTiles]);
  });

  it('lists an update shared by several changed keys once', () => {
    expect(diffSource(current, { ...current, cluster: false, clusterRadius: 30 }, IN_PLACE)).toEqual([setClusterOptions]);
  });

  it('finds nothing to change between equal specifications, whatever their key order', () => {
    const reordered: SourceSpec = { clusterRadius: 50, cluster: true, minzoom: 0, url: 'a.json', type: 'vector' };

    expect(diffSource(current, reordered, IN_PLACE)).toEqual([]);
    expect(diffSource(current, { ...current })).toEqual([]);
  });

  it.each([
    ['the type', { type: 'raster' }],
    ['a key without an in-place update', { minzoom: 2 }],
    ['a key that is no longer set, even one with an update', { url: undefined }]
  ])('asks for a new source when %s changes', (_what, change) => {
    expect(diffSource(current, { ...current, ...change }, IN_PLACE)).toBeNull();
  });
});
