import { Node, Editor, Range } from '@tiptap/core';
import { MentionOptions } from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import {
  SuggestionExtensionProps,
  SuggestionExtensionQuery,
  createSuggestionExtension,
} from '../SuggestionList/Suggestion';
import { IEmojiModel } from '@/utils/emoji/emojiSearch';
import EmojiList, { EMOJI_SUGGESTION_CHAR } from './EmojiList';

export function createEmojiSearchExtension(
  suggestions: SuggestionExtensionQuery<IEmojiModel>,
  customContainerRef?: React.RefObject<HTMLElement>
): Node<MentionOptions, any> {
  const suggestionOptions: SuggestionExtensionProps<IEmojiModel> = {
    suggestions,
    serializeMarkdown: (state, node) => {
      state.write(node.label);
    },
    listElement: EmojiList as any,
    customContainerRef,
    extendedConfig: {
      name: 'EmojiSearch',
      addKeyboardShortcuts() {
        return {
          Backspace: () => {
            // Override backspace behavior to prevent it from replacing the emoji with a colon
            return false;
          },
        };
      },
    },
    options: {
      renderLabel: ({ node }) => {
        return node.attrs.label;
      },
      suggestion: {
        pluginKey: new PluginKey('EmojiSearch'),
        char: EMOJI_SUGGESTION_CHAR,
        command: (props: { editor: Editor; range: Range; props: any }) => {
          props.editor
            .chain()
            .focus()
            .setTextSelection(props.range)
            // Include a space so the user can use :emoji again
            .insertText(`${props.props.label} `)
            .run();
        },
      },
    },
  };

  return createSuggestionExtension(suggestionOptions);
}
