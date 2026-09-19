// Adapted from https://github.com/ueberdosis/tiptap/blob/main/packages/suggestion/src/findSuggestionMatch.ts
import { escapeForRegEx } from '@tiptap/core';
import { SuggestionMatch, Trigger } from '@tiptap/suggestion';

export function findBotSuggestionMatch(config: Trigger): SuggestionMatch {
  const { char, $position } = config;

  const escapedChar = escapeForRegEx(char);
  // Check for /[command]@[mention]
  const regexp = new RegExp(`^(/[a-zA-Z0-9]+)(${escapedChar}[^\\s${escapedChar}]*)`, 'gm');

  const text = $position.nodeBefore?.isText && $position.nodeBefore.text;
  if (!text) {
    return null;
  }

  const match = Array.from(text.matchAll(regexp)).pop();
  if (!match || match.input === undefined || match.index === undefined || match.length < 3) {
    return null;
  }

  // The absolute position of the match in the document
  const from = match[1].length + 1;
  const to = from + match[2].length;

  // If the $position is located within the matched substring, return that range
  if (from < $position.pos && to >= $position.pos) {
    return {
      range: {
        from,
        to,
      },
      query: match[2].slice(char.length),
      text: match[2],
    };
  }

  return null;
}
