/**
 * What MapHook counts as the same camera value, and which reported values it
 * counts as echoes (#49).
 */
import { describe, expect, it } from 'vitest';
import { CameraReports, MAX_REPORTS, sameCameraValue } from '../js/maplibrex/core/camera-reports';

describe('sameCameraValue', () => {
  it('takes centres within a millionth of a degree as the same', () => {
    expect(sameCameraValue('center', [2.35, 48.85], [2.3500004, 48.8499996])).toBe(true);
    expect(sameCameraValue('center', [2.35, 48.85], [2.351, 48.85])).toBe(false);
    expect(sameCameraValue('center', [2.35, 48.85], [2.35, 48.86])).toBe(false);
  });

  it('takes zoom, bearing and pitch within the 0.01 rounding of map:moved as the same', () => {
    for (const field of ['zoom', 'bearing', 'pitch'] as const) {
      expect(sameCameraValue(field, 6.125, Math.round(6.125 * 100) / 100), field).toBe(true);
      expect(sameCameraValue(field, 6.123, 6.12), field).toBe(true);
      expect(sameCameraValue(field, 6.123, 6.13), field).toBe(false);
    }
  });

  it('compares bearings around the circle', () => {
    expect(sameCameraValue('bearing', 180, -180)).toBe(true);
    expect(sameCameraValue('bearing', 359.999, 0)).toBe(true);
    expect(sameCameraValue('bearing', -0.001, 360)).toBe(true);
    expect(sameCameraValue('bearing', 90, -90)).toBe(false);
  });

  it('takes nothing that is not a number, or a pair of numbers for the centre, as the same', () => {
    expect(sameCameraValue('zoom', '6', 6)).toBe(false);
    expect(sameCameraValue('zoom', null, null)).toBe(false);
    expect(sameCameraValue('center', { lng: 1, lat: 2 }, [1, 2])).toBe(false);
    expect(sameCameraValue('center', [1, 2, 3], [1, 2])).toBe(false);
  });
});

describe('CameraReports', () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('counts a reported value as an echo, field by field', () => {
    const reports = new CameraReports();
    reports.record({ center: [2.35, 48.85], zoom: 6.12 });

    expect(reports.isEcho('center', [2.35, 48.85])).toBe(true);
    expect(reports.isEcho('zoom', 6.12)).toBe(true);
    expect(reports.isEcho('zoom', 7)).toBe(false);
    expect(reports.isEcho('bearing', 0)).toBe(false);
  });

  it('forgets a report once the server has answered it, whether the push succeeded or failed', async () => {
    const reports = new CameraReports();
    let answer!: () => void;
    reports.record({ zoom: 6 }, new Promise<void>((resolve) => (answer = resolve)));
    reports.record({ zoom: 7 }, Promise.resolve());

    await flush();
    expect(reports.isEcho('zoom', 6)).toBe(true);
    expect(reports.isEcho('zoom', 7)).toBe(false);

    answer();
    await flush();
    expect(reports.isEcho('zoom', 6)).toBe(false);
  });

  it(`keeps at most ${MAX_REPORTS} unanswered reports, dropping the oldest`, () => {
    const reports = new CameraReports();
    for (let zoom = 0; zoom <= MAX_REPORTS; zoom++) reports.record({ zoom });

    expect(reports.isEcho('zoom', 0)).toBe(false);
    expect(reports.isEcho('zoom', 1)).toBe(true);
    expect(reports.isEcho('zoom', MAX_REPORTS)).toBe(true);
  });
});
