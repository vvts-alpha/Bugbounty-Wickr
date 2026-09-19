import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';

export interface ByteCountOptions {
  /**
   * The maximum number of characters that should be allowed. Defaults to `0`.
   */
  limit: number | null | undefined;
}

export interface ByteCountStorage {
  byteCount: number;
  charCount: number;
}

/**
 * An extention to count how many bytes of current input content, and stop it from adding more content when exceeds
 */
export const ByteCount = Extension.create<ByteCountOptions, ByteCountStorage>({
  name: 'byteCount',

  addOptions() {
    return {
      limit: null,
      mode: 'textSize',
    };
  },

  addStorage() {
    return {
      byteCount: 0,
      charCount: 0,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('byteCount'),
        filterTransaction: (transaction, _state) => {
          const limit = this.options.limit;

          // Nothing has changed or no limit is defined. Ignore it.
          if (!transaction.docChanged || !limit) {
            return true;
          }

          const node = transaction.doc || this.editor.state.doc;
          // https://prosemirror.net/docs/ref/#model.Node
          // get plain text from current input editor
          const text = node.textBetween(0, node.content.size, undefined, ' ');

          const byteCount = encodeURI(text).split(/%..|./).length - 1;
          this.storage.byteCount = byteCount;
          this.storage.charCount = text.length;

          // Everything is in the limit. Good.
          if (byteCount <= limit) {
            return true;
          }

          return false;
        },
      }),
    ];
  },
});
