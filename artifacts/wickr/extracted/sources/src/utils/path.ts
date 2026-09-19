/**
 * Given a string that is supposed to be a link, such as https://amazon.com or amazon.com, prepends
 * "https://" to the string if it does not start with "https://" or "http://"
 */
export const ensureLinkHasProtocol = (link: string): string =>
  link.match(/^https{0,1}:\/\//i) ? link : `https://${link}`;

/** Join url/path parts together, removing redundant '/' separators */
export const joinPath = (...args: string[]) => {
  return args.reduce((path, part) => `${path.replace(/\/$/, '')}/${part.replace(/^\//, '')}`);
};

/** Removes any leading or trailing '/' at the beginning or end of a path string. */
export const trimPath = (path: string) => {
  return path.replace(/(^\/)|(\/$)/, '');
};

export const getFileExtension = (filename: string) => {
  if (!filename) return '';
  return filename.split('.')?.slice(1)?.pop() || '';
};

let allowedToOpenExtensions: string[] = [];
export function setAllowedExtensions(extensions: string[]) {
  allowedToOpenExtensions = extensions.map((extension) => extension.toUpperCase());
}

export function isAllowedToOpenFile(filename: string) {
  const fileExt = getFileExtension(filename)?.toUpperCase();
  if (!fileExt) {
    return false;
  }

  return allowedToOpenExtensions.indexOf(fileExt) !== -1;
}
