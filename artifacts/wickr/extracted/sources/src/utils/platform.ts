import platform from 'platform';

const os = platform.os?.family ?? '';

export const isMac = () => os === 'OS X';

export const isWindows = () => os.startsWith('Windows');

export const isQt = () => typeof qt !== 'undefined' || navigator.userAgent.includes('QtWebEngine');

export const getQt = () => (typeof qt !== 'undefined' ? qt : undefined);

export const getQtVersion = () => navigator.userAgent.match(/QtWebEngine\/([^ ]+)/)?.[1];

export const isWeb = () => !isQt() && !isElectron();

export const isElectron = () => platform.name === 'Electron';

export const isAndroid = () => os.toLowerCase().includes('android');

export const isIOS = () => os.toLowerCase().includes('ios');

export const isMobile = () => isAndroid || isIOS;

export const isLinux = () => !isMac() && !isWindows() && !isMobile();

export const isFirefox = () => platform.name === 'Firefox';

export const isChrome = () => platform.name === 'Chrome';

export const getPlatformVersion = () => platform.version;

export function getPlatform() {
  if (isWindows()) return 'Windows';
  if (isMac()) return 'macOS';
  if (isLinux()) return 'Linux';
  if (isAndroid()) return 'Android';
  if (isIOS()) return 'iOS';
  return '';
}

// See the link below for reference:
// https://learn.microsoft.com/en-us/microsoft-edge/web-platform/how-to-detect-win11#sample-code-for-detecting-windows-11
export const isWindows11OrLater = async (): Promise<boolean> => {
  if (isWindows()) {
    // @ts-expect-error
    const ua = await navigator.userAgentData?.getHighEntropyValues(['platformVersion']);
    if (ua?.platformVersion) {
      const majorPlatformVersion = parseInt(ua.platformVersion.split('.')[0]);
      return majorPlatformVersion >= 13;
    }
  }
  return false;
};

let cachedRenderer: string | undefined;
/**
 * Returns the name of the current WebGL renderer, or empty string if it fails to retrive the info.
 *
 * Modified from MDN example: https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_renderer_info
 */
export const getWebGLRendererName = () => {
  if (cachedRenderer !== undefined) return cachedRenderer;
  cachedRenderer = '';
  if (typeof document === 'undefined') return cachedRenderer;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');

    if (debugInfo && gl) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      if (typeof renderer === 'string') {
        cachedRenderer = renderer;
      }
    }
    canvas.remove();
  } catch {
    cachedRenderer = '';
  }
  return cachedRenderer;
};
