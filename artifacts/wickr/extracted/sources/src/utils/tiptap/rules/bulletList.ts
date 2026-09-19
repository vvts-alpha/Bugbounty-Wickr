import BulletList from '@tiptap/extension-bullet-list';
import { wrappingInputRule } from '@tiptap/react';

// Default
// const inputRegex = /^\s*([-+*])\s$/

const inputsFollowedBySpace = /^\s*([-+*])[ ]$/;

// Default implementation:
// https://github.com/aguingand/tiptap-markdown/blob/main/src/extensions/nodes/bullet-list.js#L8
export const CustomBulletList = BulletList.extend({
  addKeyboardShortcuts() {
    return {};
  },
  addStorage() {
    return {
      markdown: {
        serialize: (
          state: {
            repeat: (arg0: string, arg1: number) => string;
            renderList: (arg0: any, arg1: any, arg2: (i: number) => string) => void;
          },
          node: any
        ) => {
          // 5 spaces for for every nested list depth in markdown
          const space = state.repeat(' ', 5);
          const separator = '- ';
          state.renderList(node, space, () => separator);
        },
      },
    };
  },

  // https://github.com/ueberdosis/tiptap/blob/develop/packages/extension-bullet-list/src/bullet-list.ts#L71-L90
  addInputRules() {
    let inputRule = wrappingInputRule({
      find: inputsFollowedBySpace,
      type: this.type,
    });

    if (this.options.keepMarks || this.options.keepAttributes) {
      inputRule = wrappingInputRule({
        find: inputsFollowedBySpace,
        type: this.type,
        keepMarks: this.options.keepMarks,
        keepAttributes: this.options.keepAttributes,
        getAttributes: () => {
          return this.editor.getAttributes('textStyle');
        },
        editor: this.editor,
      });
    }
    return [inputRule];
  },
});
