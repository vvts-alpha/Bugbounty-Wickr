// Adapted from https://github.com/Doist/typist/blob/main/src/extensions/rich-text/rich-text-link.ts
// MIT license
import { InputRule, markInputRule, markPasteRule, Node, PasteRule } from '@tiptap/core';
import { Link } from '@tiptap/extension-link';

import type { LinkOptions } from '@tiptap/extension-link';

type LinkMark = {
  attrs: {
    href: string;
    target?: string | null;
    rel?: string | null;
    title: string;
    class?: string | null;
  };
  type: typeof Link;
};

/**
 * The input regex for Markdown links with title support, and multiple quotation marks (required
 * in case the `Typography` extension is being included). The link must start with http(s)://.
 */
const inputRegex = /(?:^|\s)\[([^\]]*)?\]\((https{0,1}:\/\/\S+)(?: ["“](.+)["”])?\)$/i;

/**
 * The paste regex for Markdown links with title support, and multiple quotation marks (required
 * in case the `Typography` extension is being included). The link must start with http(s)://.
 */
const pasteRegex = /(?:^|\s)\[([^\]]*)?\]\((https{0,1}:\/\/\S+)(?: ["“](.+)["”])?\)/gi;

/**
 * Input rule built specifically for the `Link` extension, which ignores the auto-linked URL in
 * parentheses (e.g., `(https://amazon.com)`).
 *
 * @see https://github.com/ueberdosis/tiptap/discussions/1865
 */
function linkInputRule(config: Parameters<typeof markInputRule>[0]) {
  const defaultMarkInputRule = markInputRule(config);

  return new InputRule({
    find: config.find,
    handler(props) {
      const { tr } = props.state;

      defaultMarkInputRule.handler(props);
      tr.setMeta('preventAutolink', true);
    },
  });
}

/**
 * Paste rule built specifically for the `Link` extension, which ignores the auto-linked URL in
 * parentheses (e.g., `(https://amazon.com)`). This extension was inspired from the multiple
 * implementations found in a Tiptap discussion at GitHub.
 *
 * @see https://github.com/ueberdosis/tiptap/discussions/1865
 */
function linkPasteRule(config: Parameters<typeof markPasteRule>[0]) {
  const defaultMarkPasteRule = markPasteRule(config);

  return new PasteRule({
    find: config.find,
    handler(props) {
      const { tr } = props.state;

      defaultMarkPasteRule.handler(props);
      tr.setMeta('preventAutolink', true);
    },
  });
}

/**
 * Custom extension that extends the built-in `Link` extension to add additional input/paste rules
 * for converting the Markdown link syntax (i.e. `[Amazon](https://amazon.com)`) into links, and also
 * adds support for the `title` attribute.
 */
export const RichTextLink = Link.extend({
  // Links with auto-markdown parsing support
  inclusive: false,
  addAttributes() {
    return {
      ...this.parent?.(),
      title: {
        default: null,
      },
    };
  },
  addInputRules() {
    return [
      linkInputRule({
        find: inputRegex,
        type: this.type,

        // We need to use `pop()` to remove the last capture groups from the match to
        // satisfy Tiptap's `markPasteRule` expectation of having the content as the last
        // capture group in the match (this makes the attribute order important)
        getAttributes(match) {
          return {
            title: match.pop()?.trim(),
            href: match.pop()?.trim(),
          };
        },
      }),
    ];
  },
  addPasteRules() {
    return [
      linkPasteRule({
        find: pasteRegex,
        type: this.type,

        // We need to use `pop()` to remove the last capture groups from the match to
        // satisfy Tiptap's `markInputRule` expectation of having the content as the last
        // capture group in the match (this makes the attribute order important)
        getAttributes(match) {
          return {
            title: match.pop()?.trim(),
            href: match.pop()?.trim(),
          };
        },
      }),
    ];
  },
  addStorage() {
    return {
      markdown: {
        /**
         * Link serialization that always outputs desired format: [title](url),
         * even when they are the same (the regular parser converts them to <url> when matching)
         */
        serialize: {
          open: (_state: any, mark: LinkMark, _parent: Node, _index: number) => {
            if (!mark.attrs.href) return '';
            return '[';
          },
          close: (_state: any, mark: LinkMark, _parent: Node, _index: number) => {
            if (!mark.attrs.href) return '';
            return `](${mark.attrs.href})`;
          },
        },
      },
    };
  },
}).configure({
  openOnClick: false,
  autolink: true,
  validate: (url) => /^https{0,1}:\/\//i.test(url),
  linkOnPaste: true,
});

export type { LinkOptions as RichTextLinkOptions };
