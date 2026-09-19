import { Node } from '@tiptap/core';
import { MentionOptions } from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import { useState } from 'react';
import {
  SuggestionExtensionProps,
  SuggestionExtensionQuery,
  createSuggestionExtension,
} from '../SuggestionList/Suggestion';
import useLatestCallback from '@/hooks/useLatestCallback';
import MentionList, { AT_MENTION_PREFIX } from './MentionList';
import { IMentionModel } from './MentionModel';
import markdownStyles from '@/components/MarkdownText/MarkdownText.module.less';

export function createMentionExtension(
  queryHandler: SuggestionExtensionQuery<IMentionModel>,
  customContainerRef?: React.RefObject<HTMLElement>
): Node<MentionOptions, any> {
  const suggestionOptions: SuggestionExtensionProps<IMentionModel> = {
    suggestions: queryHandler,
    serializeMarkdown: (state, node) => {
      state.write(`${AT_MENTION_PREFIX}${node.label}`);
    },
    listElement: MentionList,
    customContainerRef,
    extendedConfig: {
      name: 'Mention',
    },
    options: {
      HTMLAttributes: {
        class: markdownStyles.mentionText,
      },
      suggestion: {
        pluginKey: new PluginKey('Mention'),
        char: AT_MENTION_PREFIX,
      },
    },
  };

  return createSuggestionExtension(suggestionOptions);
}

/** Creates a mention extension that uses the latest queryHandler */
export function useMentionExtension(queryHandler: SuggestionExtensionQuery<IMentionModel>) {
  const handler = useLatestCallback(queryHandler);
  const [extension] = useState(() => createMentionExtension(handler));
  return extension;
}
