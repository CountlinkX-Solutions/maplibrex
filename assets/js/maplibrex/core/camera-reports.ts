/**
 * camera-reports - how MapHook tells its own camera from a camera the
 * LiveView sets (#49)
 *
 * The map tells the LiveView where it is (`map:moved`, `map:zoom_changed`).
 * A LiveView that keeps that position in its assigns renders it back in the
 * map's `data-config`. That value is an echo: applying it would move the map
 * to where it already is or, when the answer arrives while the user is still
 * moving the map, back to a place the user has already left; either way a
 * second `map:moved` would follow.
 *
 * `CameraReports` remembers each camera the hook reported until LiveView has
 * the server's answer to that push. LiveView patches in the re-render that
 * comes with the answer (calling MapHook's `updated()`) before it settles the
 * promise `pushEvent` returned, so an echo rendered by `handle_event/3` always
 * arrives while its report is remembered, however long the answer takes and
 * however many moves the user makes meanwhile. Once the answer is in, the
 * report is forgotten: the server sending that camera again later means it,
 * and it is applied. A report whose push gave no promise is kept until
 * `MAX_REPORTS` newer ones push it out.
 *
 * Values are compared with a tolerance (`sameCameraValue`). The centre is
 * sent unrounded and comes back from Jason exactly, so its tolerance only
 * absorbs float noise and a centre rounded to 6 decimals on the server.
 * Zoom, bearing and pitch are sent in `map:moved` rounded to 0.01, so the
 * map is within 0.005 of what it reported; that is their tolerance.
 */

import type { Map as MapLibreMap } from 'maplibre-gl';

export type LngLat = [number, number];

/** A map camera, as `data-config` and `map:moved` give it. */
export interface Camera {
  center: LngLat;
  zoom: number;
  bearing: number;
  pitch: number;
}

export type CameraField = keyof Camera;

export const CAMERA_FIELDS: readonly CameraField[] = ['center', 'zoom', 'bearing', 'pitch'];

/** How many unanswered reports are kept at most. */
export const MAX_REPORTS = 32;

/** Degrees of longitude and latitude: about 11 cm, under a pixel up to zoom 19. */
const CENTER_TOLERANCE = 1e-6;

/** Half the 0.01 step `map:moved` rounds zoom, bearing and pitch to, plus float noise. */
const ROUNDING_TOLERANCE = 0.005 + 1e-9;

function isLngLat(value: unknown): value is LngLat {
  return Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === 'number');
}

/**
 * Whether `a` and `b` are the same value of the camera `field`, within its
 * tolerance. Bearings are compared around the circle (-180 and 180 are the
 * same). A value that is not a number (or, for the centre, a pair of
 * numbers) is never the same as anything.
 */
export function sameCameraValue(field: CameraField, a: unknown, b: unknown): boolean {
  if (field === 'center') {
    return (
      isLngLat(a) &&
      isLngLat(b) &&
      Math.abs(a[0] - b[0]) <= CENTER_TOLERANCE &&
      Math.abs(a[1] - b[1]) <= CENTER_TOLERANCE
    );
  }
  if (typeof a !== 'number' || typeof b !== 'number') return false;

  let difference = a - b;
  if (field === 'bearing') difference = ((((difference + 180) % 360) + 360) % 360) - 180;
  return Math.abs(difference) <= ROUNDING_TOLERANCE;
}

/** Where `map` is. */
export function cameraOf(map: MapLibreMap): Camera {
  const { lng, lat } = map.getCenter();
  return { center: [lng, lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
}

export class CameraReports {
  /** The reports still waiting for the server's answer, oldest first. */
  private pending: Partial<Camera>[] = [];

  /**
   * Remember `report`, the camera values one event told the server, until
   * `answered` settles; without `answered`, until newer reports push it out.
   */
  record(report: Partial<Camera>, answered?: PromiseLike<unknown>): void {
    this.pending.push(report);
    if (this.pending.length > MAX_REPORTS) this.pending.shift();
    answered?.then(() => this.forget(report));
  }

  /** Whether `value` is the `field` of a report the server has not answered yet. */
  isEcho(field: CameraField, value: unknown): boolean {
    return this.pending.some((report) => field in report && sameCameraValue(field, report[field], value));
  }

  private forget(report: Partial<Camera>): void {
    this.pending = this.pending.filter((r) => r !== report);
  }
}
