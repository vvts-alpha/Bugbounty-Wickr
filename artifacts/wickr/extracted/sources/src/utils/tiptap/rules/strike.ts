// Use the ~single tilde~ or ~~double tilde~~ markdown shortcut
import { markInputRule, markPasteRule } from '@tiptap/core';
import Strike from '@tiptap/extension-strike';
import { alwaysTreatDoubleMarkerAsMarkdown } from './sharedRules';

// Default:
// const inputRegex = /(?:^|\s)((?:~~)((?:[^~]+))(?:~~))$/
// const pasteRegex = /(?:^|\s)((?:~~)((?:[^~]+))(?:~~))/g

const singleTildeInputRegex = /(?:^|\s)((?:~)((?:[^~]+))(?:~))$/;
const doubleTildeInputRegex = /((?:~~)((?:[^~]+))(?:~~))$/;

const singleTildePasteRegex = /(?:^|\s)((?:~)((?:[^~]+))(?:~))/g;
const doubleTildePasteRegex = /((?:~~)((?:[^~]+))(?:~~))/g;

export const CustomStrike = Strike.extend({
  addStorage() {
    return {
      markdown: {
        serialize: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: false },
        parse: {
          setup: alwaysTreatDoubleMarkerAsMarkdown({
            marker: '~',
            tokenOpen: 's_open',
            tokenClose: 's_close',
            tokenTag: 's',
            ruleName: 'custom_strike',
            beforeRule: 'strikethrough',
          }),
        },
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-x': () => {
        return this.editor.commands.toggleStrike();
      },
    };
  },
  addInputRules() {
    return [
      markInputRule({
        find: singleTildeInputRegex,
        type: this.type,
      }),
      markInputRule({
        find: doubleTildeInputRegex,
        type: this.type,
      }),
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({
        find: singleTildePasteRegex,
        type: this.type,
      }),
      markPasteRule({
        find: doubleTildePasteRegex,
        type: this.type,
      }),
    ];
  },
});
