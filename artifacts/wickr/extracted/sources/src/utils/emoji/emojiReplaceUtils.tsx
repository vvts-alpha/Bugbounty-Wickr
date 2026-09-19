import { JSONContent } from '@tiptap/react';
import { shorthandToUnicodeEmoji } from './emojiMapping';

export const emojifyShortHands = (input: string) => {
  for (const key in shorthandToUnicodeEmoji) {
    const escapedKey = key.replace(/[.*+?^${}()|_[\]\\]/g, '\\$&');
    const emojiRegex = new RegExp(`(?<=\\s|^)(${escapedKey})(?=\\s|$)`, 'g');

    let emojiMatch;
    while ((emojiMatch = emojiRegex.exec(input))) {
      const emojiStartIndex = emojiMatch.index;
      const emojiEndIndex = emojiMatch.index + emojiMatch[0].length;

      // Replace the input with unicode character while persisting adjacent characters included in the regex match
      input =
        input.slice(0, emojiStartIndex) +
        input.slice(emojiStartIndex, emojiEndIndex).replace(key, shorthandToUnicodeEmoji[key]) +
        input.slice(emojiEndIndex);
    }
  }
  return input;
};

// Emojify shorthand emojis in JSON content
export const emojifyShortHandsInJsonContent = (jsonContent: JSONContent): JSONContent => {
  const contentLength = jsonContent.content?.length ?? 0;
  for (let nodeIndex = 0; nodeIndex < contentLength; nodeIndex++) {
    const node = jsonContent.content?.[nodeIndex];

    if (!node) {
      continue;
    }
    if (node.marks && node.marks[0]?.type === 'code') {
      continue;
    }

    if (node.type !== 'codeBlock') {
      emojifyShortHandsInJsonContent(node);
    }

    if (node.text) {
      node.text = emojifyShortHands(node.text);
    }
  }
  return jsonContent;
};
