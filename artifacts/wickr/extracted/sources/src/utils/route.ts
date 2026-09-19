import { generatePath } from 'react-router';
import { joinPath } from './path';

/** Create a function to generate paths with the given prefix */
export function createRouteGenerator(prefix: string) {
  const generate: typeof generatePath = (path, params) => {
    return generatePath(joinPath(prefix, path), params);
  };
  return generate;
}
