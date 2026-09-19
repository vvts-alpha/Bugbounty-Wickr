// Use the _single underscore_ or __double underscore__ markdown shortcut
import { markInputRule, markPasteRule } from '@tiptap/core';
import Italic from '@tiptap/extension-italic';

// Default:
// export const starInputRegex = /(?:^|\s)((?:\*)((?:[^*]+))(?:\*))$/
// export const starPasteRegex = /(?:^|\s)((?:\*)((?:[^*]+))(?:\*))/g
// export const underscoreInputRegex = /(?:^|\s)((?:_)((?:[^_]+))(?:_))$/
// export const underscorePasteRegex = /(?:^|\s)((?:_)((?:[^_]+))(?:_))/g

const singleUnderscoreInputRegex = /(?:^|\s)((?:_)((?:[^_]+))(?:_))$/;
const doubleUnderscoreInputRegex = /(?:^|\s)((?:__)((?:[^__]+))(?:__))$/;

const singleUnderscorePasteRegex = /(?:^|\s)((?:_)((?:[^_]+))(?:_))/g;
const doubleUnderscorePasteRegex = /(?:^|\s)((?:__)((?:[^__]+))(?:__))/g;

export const CustomItalic = Italic.extend({
  addStorage() {
    return {
      markdown: {
        serialize: { open: '_', close: '_', mixable: true, expelEnclosingWhitespace: true },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
  // overwrite the shortcuts because by default there are two of them:
  // Mod-i and Mod-Shift-i.
  addKeyboardShortcuts() {
    return {
      'Mod-i': () => this.editor.commands.toggleItalic(),
    };
  },
  addInputRules() {
    return [
      markInputRule({
        find: singleUnderscoreInputRegex,
        type: this.type,
      }),
      markInputRule({
        find: doubleUnderscoreInputRegex,
        type: this.type,
      }),
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({
        find: singleUnderscorePasteRegex,
        type: this.type,
      }),
      markPasteRule({
        find: doubleUnderscorePasteRegex,
        type: this.type,
      }),
    ];
  },
});
