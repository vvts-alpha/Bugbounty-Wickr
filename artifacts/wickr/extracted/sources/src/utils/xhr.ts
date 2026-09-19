import { PrefixedError } from './error';
import { redactInProd } from './strings';

/**
 * @throws If response is not OK
 * @returns Response if OK
 */
export function throwIfNotOk(res: Response): Response {
  if (!res || !res.ok) {
    // URLs should be safe, but obscuring for now just in case
    const urlInfo = redactInProd(`; url: ${res.url}`, '');
    throw new Error(`Response failed with status: ${res.status} ${res.statusText}${urlInfo}`);
  }
  return res;
}

/**
 * Checks response for OK
 * @throws If response is not OK
 * @returns Promise with the JSON
 */
export function responseToJson<T = any>(res: Response): Promise<T> {
  throwIfNotOk(res);
  return res.json();
}

export async function responseToUint8Array(res: Response) {
  throwIfNotOk(res);
  try {
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (err) {
    throw new PrefixedError('responseToUint8Array failed: ', err);
  }
}
