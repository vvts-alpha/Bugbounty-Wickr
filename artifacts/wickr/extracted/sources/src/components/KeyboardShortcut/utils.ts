import { getPlatform } from '@/utils/platform';
import { ALL_SHORTCUTS, CMD_OR_CTRL, KeyboardShortcuts, ShortcutConfig } from './shortcutsMap';

export type KeyboardShortcutHandler = (event: KeyboardEvent, combo: string) => void;
export type KeyboardShortcutAction = 'keyup' | 'keydown';

const CMD_OR_CTRL_REGEX = new RegExp(CMD_OR_CTRL, 'gi');

export function getShortcutConfig(name: KeyboardShortcuts) {
  const { defaultKeys, nativeLinux, nativeMac, nativeWindows, ...config } = (
    ALL_SHORTCUTS as Record<KeyboardShortcuts, ShortcutConfig>
  )[name];
  let keys = defaultKeys;
  let cmdOrCtrl = 'ctrl';
  switch (getPlatform()) {
    case 'macOS':
      cmdOrCtrl = 'command';
      if (nativeMac) keys = nativeMac;
      break;
    case 'Windows':
      if (nativeWindows) keys = nativeWindows;
      break;
    case 'Linux':
      if (nativeLinux) keys = nativeLinux;
      break;
  }
  keys = keys.replace(CMD_OR_CTRL_REGEX, cmdOrCtrl).toLowerCase();

  return {
    ...config,
    keys,
  };
}

const CMD = '⌘';

/** Get array of each key in the shortcut combo as an array, formatted for display */
export function getKeyboardShortcutCombo(name: KeyboardShortcuts): string[] {
  const hotKey = getShortcutConfig(name);
  if (!hotKey) return [];
  // Convert to readable array, e.g.: 'cmd+shift+f' => ['⌘', 'Shift', 'F']
  return hotKey.keys
    .split('+')
    .map((k) =>
      k.toLowerCase() === 'command'
        ? CMD
        : `${k[0].toUpperCase()}${k.length > 1 ? k.substring(1) : ''}`
    );
}
