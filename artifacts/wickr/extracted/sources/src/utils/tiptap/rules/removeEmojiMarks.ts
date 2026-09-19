import { Extension } from '@tiptap/react';
import { Plugin } from 'prosemirror-state';
import { EmojiRegex, hasEmoji } from '@/utils/strings';

/**
 * A tiptap extension to remove bold, italic and strike marks from emojis in any transactions
 */
export const removeMarksFromEmoji = Extension.create({
  name: 'removeMarksFromEmoji',
  // add ProseMirror plugin to tiptap editor
  addProseMirrorPlugins() {
    return [
      new Plugin({
        // append modifications to transactions
        appendTransaction: (_transactions, _oldState, newState) => {
          // get transaction from new state
          const tr = newState.tr;
          // flag to indicate if changes were made, if nothing is changed we return null instead of modified transaction
          let modified = false;

          // iterate through all descendants of the new state
          newState.doc.descendants((node, pos) => {
            // check if the node is a text node with text and marks
            if (node.isText && node.text && node.marks.length > 0) {
              let offset = 0;
              // split the text node into parts based on the emoji regex
              // split result includes emojis
              const parts = node.text.split(EmojiRegex);

              // iterate through each part of the split text
              parts.forEach((part) => {
                // if the part contains an emoji
                if (part && hasEmoji(part)) {
                  // calculate the start and end positions of the emoji within the text node
                  const start = pos + offset;
                  const end = start + part.length;

                  // iterate through each mark on the text node
                  node.marks.forEach((mark) => {
                    // check if the mark is bold, italic, or strike
                    if (
                      mark.type.name === 'bold' ||
                      mark.type.name === 'italic' ||
                      mark.type.name === 'strike'
                    ) {
                      // Remove the mark from the range containing the emoji
                      tr.removeMark(start, end, mark);
                      modified = true;
                    }
                  });
                }
                // update the offset to the next part of the text
                offset += part.length;
              });
            }
          });

          // Return the modified transaction if changes were made, otherwise return null
          return modified ? tr : null;
        },
      }),
    ];
  },
});
