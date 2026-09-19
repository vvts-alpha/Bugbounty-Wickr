type ConstructorFn = { new (...args: any[]): any };

/** @returns value if it is an instanceof the constructor, undefined otherwise */
export function valueIfInstanceOf<T extends ConstructorFn>(
  value: unknown,
  constructorFn: T
): InstanceType<T> | undefined {
  return value instanceof constructorFn ? value : undefined;
}

/** @returns new object with the same properties as the input object, minus null and undefined properties */
export function withoutNilProperties<T extends AnyObject>(obj: T): OmitNilKeys<T> {
  // newObj must be any because we do not assign on init
  const newObj: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null) {
      newObj[key] = obj[key];
    }
  }
  return newObj;
}

/**
 * Check if a property exists on an object
 * @param obj - object to check
 * @param prop - property to check for
 * @returns true if obj is a valid object and has the property, false otherwise
 */
export function objectHasProperty<P extends string>(
  obj: unknown,
  prop: P
): obj is Record<P, unknown> {
  // we can't use object.getOwnProperty because it doesn't climb the prototype chain
  return Boolean(obj && typeof obj === 'object' && prop in obj);
}
