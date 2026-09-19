import { Extension } from '@tiptap/core';

export interface KeyBindingsOptions {
  onEnterKeyPress: () => void;
  onControlEnterKeyPress: () => boolean;
  onAltEnterKeyPress: () => boolean;
  onShiftEnterKeyPress: () => boolean;
}

/**
 * An extension to bind any key combination we want
 */
export const KeyBindingsExtension = Extension.create<KeyBindingsOptions>({
  name: 'keyBindings',
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        this.options.onEnterKeyPress();
        // return true to prevent default behavior
        return true;
      },
      'Control-Enter': () => {
        return this.options.onControlEnterKeyPress();
      },
      'Alt-Enter': () => {
        return this.options.onAltEnterKeyPress();
      },
      'Shift-Enter': () => {
        return this.options.onShiftEnterKeyPress();
      },
    };
  },
});
