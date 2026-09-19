import OrderedList from '@tiptap/extension-ordered-list';

// Default implementation:
// https://github.com/aguingand/tiptap-markdown/blob/main/src/extensions/nodes/ordered-list.js#L18
export const CustomOrderedList = OrderedList.extend({
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
          node: { attrs: { start: number } }
        ) => {
          const start = node.attrs.start || 1;
          // 5 spaces for for every nested list depth in markdown
          const space = state.repeat(' ', 5);
          const separator = '. ';
          state.renderList(node, space, (i: number) => String(start + i) + separator);
        },
      },
    };
  },
});
