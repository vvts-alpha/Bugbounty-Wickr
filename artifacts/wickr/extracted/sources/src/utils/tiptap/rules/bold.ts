// Use the *single star* or **double star** markdown shortcut
import { markInputRule, markPasteRule } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import { alwaysTreatDoubleMarkerAsMarkdown } from './sharedRules';

// Default:
// export const starInputRegex = /(?:^|\s)((?:\*\*)((?:[^*]+))(?:\*\*))$/
// export const starPasteRegex = /(?:^|\s)((?:\*\*)((?:[^*]+))(?:\*\*))/g
// export const underscoreInputRegex = /(?:^|\s)((?:__)((?:[^__]+))(?:__))$/
// export const underscorePasteRegex = /(?:^|\s)((?:__)((?:[^__]+))(?:__))/g

const singleStarInputRegex = /(?:^|\s)((?:\*)((?:[^*]+))(?:\*))$/;
const doubleStarInputRegex = /((?:\*\*)((?:[^*]+))(?:\*\*))$/;

const singleStarPasteRegex = /(?:^|\s)((?:\*)((?:[^*]+))(?:\*))/g;
const doubleStarPasteRegex = /((?:\*\*)((?:[^*]+))(?:\*\*))/g;

export const CustomBold = Bold.extend({
  addStorage() {
    return {
      markdown: {
        // Notes on markdown serialize format:
        // https://github.com/aguingand/tiptap-markdown/blob/main/src/extensions/marks/bold.js
        // https://github.com/ProseMirror/prosemirror-markdown/blob/master/src/to_markdown.ts
        serialize: { open: '**', close: '**', mixable: true, expelEnclosingWhitespace: false },
        parse: {
          setup: alwaysTreatDoubleMarkerAsMarkdown({
            marker: '*',
            tokenOpen: 'strong_open',
            tokenClose: 'strong_close',
            tokenTag: 'strong',
            ruleName: 'custom_bold',
            beforeRule: 'emphasis',
          }),
        },
      },
    };
  },
  addInputRules() {
    return [
      markInputRule({
        find: singleStarInputRegex,
        type: this.type,
      }),
      markInputRule({
        find: doubleStarInputRegex,
        type: this.type,
      }),
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({
        find: singleStarPasteRegex,
        type: this.type,
      }),
      markPasteRule({
        find: doubleStarPasteRegex,
        type: this.type,
      }),
    ];
  },
});
