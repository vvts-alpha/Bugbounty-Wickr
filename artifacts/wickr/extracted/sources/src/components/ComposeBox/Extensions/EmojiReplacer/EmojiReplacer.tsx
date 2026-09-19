import { Extension } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { clsx } from 'clsx';
import emojiRegex from 'emoji-regex';
import { isEmojiSupported } from 'is-emoji-supported';
import twemoji from 'twemoji';
import { getSupportedCodepoint } from '@/utils/emoji/emojiDetails';

import styles from '@/components/Emojify/Emojify.module.less';

/**
 * Save time before findEmojis is first used
 * The first time isEmojiSupported runs it can take anywhere from 0.5-1.5 seconds.
 * Doing this in the background shortens the delay the first time you enter an emoji
 * in the compose box.
 */
export function preloadFindEmojis() {
  isEmojiSupported('✅');
}

const findEmojis = (doc: Node): DecorationSet => {
  const decorations: Decoration[] = [];

  doc.descendants((node, position) => {
    if (!node.text) {
      return;
    }

    const regex = emojiRegex();
    for (const match of node.text.matchAll(regex)) {
      const emoji = match[0];
      const index = match.index || 0;
      const from = position + index;
      const codepoint = getSupportedCodepoint(twemoji.convert.toCodePoint(emoji));
      const to = from + emoji.length;
      const decoration = Decoration.inline(from, to, {
        class: clsx(styles.emojifyTiptap, {
          [styles.unsupported]: !isEmojiSupported(emoji),
        }),
        style: `--imgUrl: url(/imgs/twemoji/72x72/${codepoint}.png)`,
      });

      decorations.push(decoration);
    }
  });

  return DecorationSet.create(doc, decorations);
};

/**
 * When an emoji is inserted into the compose box (either by typing, pasting, or otherwise),
 * this extension adds a decoration to it and replaces the emoji with an image of the emoji
 * from Twemoji. This ensures that the emoji looks the same across all platforms and uses
 * the Twemoji emoji images everywhere. This is only necessary in the compose box since
 * the <Emojify> component can handle everywhere else that doesn't have a complex
 * state, like the compose box / editor. This also handles showing unsupported platform
 * emojis, such as showing the melting face emoji on Windows, since Windows doesn't support
 * it natively (renders as an X or a blank space).
 *
 * TODO: The first time this is used, it introduces a delay in the compose box. Running
 * preloadFindEmojis shortens the delay, but I still see a 1 second delay on first entry.
 * The profiler shows it is due to the layout reflow as a result of changing the document
 * selection. The .emojifyTiptap CSS is the culprit, but no tweaks I did improved it. @dschontz
 */
export const EmojiReplacer = Extension.create({
  name: 'EmojiReplacer',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        state: {
          init(_, { doc }) {
            return findEmojis(doc);
          },
          apply(transaction, oldState) {
            return transaction.docChanged ? findEmojis(transaction.doc) : oldState;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
