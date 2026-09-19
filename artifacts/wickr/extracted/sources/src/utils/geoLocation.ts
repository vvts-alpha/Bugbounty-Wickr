import { Logger } from '@/lib/logger';
import { MILLISECONDS_PER_MINUTE } from './date';

export const DEFAULT_TILE_ZOOM = 16;

// The Spheres lat lng for local dev testing
export const SPHERES_LAT = 47.61587748338518;
export const SPHERES_LONG = -122.3393726151317;

// source: https://developers.google.com/maps/documentation/tile/2d-tiles-overview#tile_coordinate_functions
const TILE_SIZE = 256;

export const fromLatLngToPoint = (latitude: number, longitude: number) => {
  const mercator = -Math.log(Math.tan((0.25 + latitude / 360) * Math.PI));
  return {
    x: TILE_SIZE * (longitude / 360 + 0.5),
    y: (TILE_SIZE / 2) * (1 + mercator / Math.PI),
  };
};

export const fromLatLngToTileCoord = (latitude: number, longitude: number, zoom: number) => {
  const point = fromLatLngToPoint(latitude, longitude);
  const scale = Math.pow(2, zoom);

  return {
    x: Math.floor((point.x * scale) / TILE_SIZE),
    y: Math.floor((point.y * scale) / TILE_SIZE),
    z: zoom,
  };
};

export const createGoogleMapsTileUrl = (
  x: string | number,
  y: string | number,
  z: string | number,
  sessionToken?: string,
  apiKey?: string
) => `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${sessionToken}&key=${apiKey}`;

export const getGoogleMapsLocationUrl = (lat: number, lng: number) =>
  `https://google.com/maps?q=${lat},${lng}`;

const logger = new Logger('GeoLocation');

/** Returns a promise that resolves with the user's geolocation. If not allowed / error, returns undefined.
 * Note: this usually takes 2-3 seconds the first time.
 */
export const getGeoLocation = async (
  opts?: PositionOptions
): Promise<GeolocationPosition | undefined> => {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        logger.warn(`Failed to getGeolocation:`, err);
        resolve(undefined);
      },
      {
        // Accept cached results for up to one minute
        maximumAge: MILLISECONDS_PER_MINUTE,
        timeout: 10_000,
        ...opts,
      }
    );
  });
};
