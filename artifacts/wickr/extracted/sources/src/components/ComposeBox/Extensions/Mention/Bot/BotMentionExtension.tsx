import { Node } from '@tiptap/core';
import { MentionOptions } from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import { useState } from 'react';
import { ExtendedSuggestion } from '../../SuggestionList/ExtendedSuggestion';
import {
  SuggestionExtensionProps,
  SuggestionExtensionQuery,
  createSuggestionExtension,
} from '../../SuggestionList/Suggestion';
import MentionList, { AT_MENTION_PREFIX } from '../MentionList';
import { IMentionModel } from '../MentionModel';
import useLatestCallback from '@/hooks/useLatestCallback';
import { findBotSuggestionMatch } from './FindBotSuggestionMatch';
import markdownStyles from '@/components/MarkdownText/MarkdownText.module.less';

export const BotMentionExtensionName = 'BotMention';

export function createBotMentionExtension(
  queryHandler: SuggestionExtensionQuery<IMentionModel>
): Node<MentionOptions, any> {
  const suggestionOptions: SuggestionExtensionProps<IMentionModel> = {
    suggestions: queryHandler,
    serializeMarkdown: (state, node) => {
      state.write(`${AT_MENTION_PREFIX}${node.label}`);
    },
    listElement: MentionList,
    extendedConfig: {
      name: BotMentionExtensionName,
      addProseMirrorPlugins() {
        return [
          ExtendedSuggestion({
            editor: this.editor,
            ...this.options.suggestion,
            suggestionMatch: findBotSuggestionMatch,
          }),
        ];
      },
    },
    options: {
      HTMLAttributes: {
        class: markdownStyles.mentionText,
      },
      suggestion: {
        pluginKey: new PluginKey(BotMentionExtensionName),
        char: AT_MENTION_PREFIX,
      },
    },
  };

  return createSuggestionExtension(suggestionOptions);
}

/** Creates a bot mention extension that uses the latest queryHandler */
export function useBotMentionExtension(queryHandler: SuggestionExtensionQuery<IMentionModel>) {
  const handler = useLatestCallback(queryHandler);
  const [extension] = useState(() => createBotMentionExtension(handler));
  return extension;
}
