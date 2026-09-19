// Adapted from https://github.com/aguingand/tiptap-markdown/blob/main/src/extensions/nodes/text.js#L17
import { Text } from '@tiptap/extension-text';

export const CustomText = Text.extend({
  /**
   * @return {{markdown: MarkdownNodeSpec}}
   */
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          // Do not escape any HTML
          state.text(node.text);
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});
