export function isEmailUrl(url: string) {
  return url.startsWith('mailto:');
}

/** If URL is an email URL, parse the email out of it, otherwise return it as-is */
export function removeUrlMailto(url: string | URL) {
  return url.toString().replace(/^mailto:/, '');
}

/**
 * Manage app reloads with any special logic needed based on the router.
 *
 * HashRouter and MemoryRouter can simply reload the page, but BrowserRouter
 * will require us to navigate to index.html in production environments
 */
export function reloadApp() {
  // eslint-disable-next-line no-restricted-syntax
  location.reload?.();
}

/**
 * In dev, the app can be loaded from dev.app.wickr.aws or localhost
 * Worker URLs need to have the same hostname as the main thread, so
 * this adjusts the URLs as necessary to conform to the appropriate host
 * as specified in vite.config.ts
 */
export function fixLocalUrl(url: string): string;
export function fixLocalUrl(url: URL): URL;
export function fixLocalUrl(url: string | URL): string | URL {
  if (!__DEV__) return url;
  const fixedUrl = new URL(url);
  if (location.hostname === 'dev.app.wickr.aws' && fixedUrl.hostname === 'localhost') {
    fixedUrl.hostname = 'dev.app.wickr.aws';
  }
  return typeof url === 'string' ? fixedUrl.toString() : fixedUrl;
}
