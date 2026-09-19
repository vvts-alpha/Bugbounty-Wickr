import isNil from 'lodash/isNil';
import { Logger } from '@/lib/logger';
import { redactInProd } from '@/utils/strings';

const logger = new Logger('proto-utils');

/**
 * Validate that an object has the required keys
 * @returns object
 * @throws if missing any of the keys
 */
export function assertRequiredKeys<T extends AnyObject>(
  obj: T,
  requiredKeys: Array<keyof OmitNullableKeys<T>>
): T {
  const missingKey = requiredKeys.find((k) => isNil(obj[k]));
  const valid = obj && !missingKey;
  if (!valid) {
    const msg = `missing required key: ${missingKey as string}`;
    logger.error(msg, redactInProd(obj, ''));
    throw new Error(msg);
  }
  return obj;
}

export const assertRequiredKeysFactory =
  <T extends AnyObject>(keys: Array<keyof OmitNullableKeys<T>>) =>
  (obj: T | any): T =>
    assertRequiredKeys(obj, keys);

export function hasRequiredKeys<T extends AnyObject>(
  obj: T,
  requiredKeys: Array<keyof OmitNullableKeys<T>>
): boolean {
  try {
    assertRequiredKeys(obj, requiredKeys);
    return true;
  } catch {
    return false;
  }
}

export const hasRequiredKeysFactory =
  <T extends AnyObject>(keys: Array<keyof OmitNullableKeys<T>>) =>
  (obj: T | any): obj is T =>
    hasRequiredKeys(obj, keys);

export function assertOneOfKeys<T extends AnyObject>(obj: T | any, oneOfKeys: Array<keyof T>): T {
  if (oneOfKeys.length === 0) return obj;
  const foundKeys = oneOfKeys.filter((key) => !isNil(obj[key]));
  const valid = obj && foundKeys.length === 1;
  if (!valid) {
    const msg = `multiple keys found when one expected: ${foundKeys.join(', ')}`;
    logger.warn(msg, redactInProd(obj, ''));
    throw new Error(msg);
  }
  return obj;
}

export function hasOneOfKeys<T extends AnyObject>(
  obj: T | any,
  oneOfKeys: Array<keyof T>
): boolean {
  try {
    assertOneOfKeys(obj, oneOfKeys);
    return true;
  } catch {
    return false;
  }
}

export function selectConvoId(convo: { vGroupID: string }) {
  return convo.vGroupID;
}
