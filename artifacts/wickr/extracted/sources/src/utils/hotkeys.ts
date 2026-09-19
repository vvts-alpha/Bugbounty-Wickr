// eslint-disable-next-line no-restricted-imports
import hotkeysJS from 'hotkeys-js';

function createNoConflictHotkeys() {
  // does not seem to work, perhaps because only if used with a script tag?
  const hotkeys = hotkeysJS.noConflict();

  // manually remove from the window if set
  if (typeof window !== 'undefined' && 'hotkeys' in window) {
    delete window['hotkeys'];
  }
  return hotkeys;
}

export default createNoConflictHotkeys();
