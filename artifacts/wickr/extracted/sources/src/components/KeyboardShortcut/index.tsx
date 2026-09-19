import { useEffect } from 'react';
import useLatestCallback from '@/hooks/useLatestCallback';
import { Logger } from '@/lib/logger';
import { logDevError } from '@/utils/error';
import hotkeys from '@/utils/hotkeys';
import { KeyboardShortcuts } from './shortcutsMap';
import { getShortcutConfig, KeyboardShortcutAction, KeyboardShortcutHandler } from './utils';

const logger = new Logger('KeyboardShortcut');

// Allow shortcuts while in input fields
// https://github.com/jaywcjlove/hotkeys-js?tab=readme-ov-file#filter
hotkeys.filter = () => true;

type KeyboardShortcutOptions = {
  disabled?: boolean;
  action?: KeyboardShortcutAction;
};

export const useKeyboardShortcut = (
  shortcutName: KeyboardShortcuts,
  onShortcut: KeyboardShortcutHandler,
  { disabled, action }: KeyboardShortcutOptions = {}
) => {
  const latestOnShortcut = useLatestCallback(onShortcut);

  useEffect(() => {
    if (disabled) return;
    const { keys } = getShortcutConfig(shortcutName);
    if (__DEV__) {
      const existingShortcut = hotkeys.getAllKeyCodes().find((entry) => entry.shortcut === keys);
      if (existingShortcut) {
        logDevError(
          new Error(
            `Multiple active handlers assigned to ${shortcutName} (${keys}). Overwriting other handlers.`
          ),
          logger
        );
      }
    }
    const keydown = action === 'keydown';
    // defaults to up if 'keyup' or undefined
    const keyup = !keydown;
    hotkeys(
      keys,
      {
        keyup,
        keydown,
        // prevent multiple handlers from running at once
        single: true,
      },
      (event, handler) => {
        latestOnShortcut(event, handler.key);
      }
    );
    return () => {
      hotkeys.unbind(keys);
    };
  }, [disabled, shortcutName, latestOnShortcut, action]);
};

export const KeyboardShortcut: React.FC<{
  shortcut: KeyboardShortcuts;
  onShortcut: KeyboardShortcutHandler;
  disabled?: boolean;
  action?: KeyboardShortcutAction;
}> = ({ shortcut, onShortcut, disabled, action }) => {
  useKeyboardShortcut(shortcut, onShortcut, { disabled, action });
  return null;
};
