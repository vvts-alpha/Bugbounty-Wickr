import { clsx } from 'clsx';
import { forwardRef, HTMLAttributes, useMemo } from 'react';
import { Tooltip } from '@/componentlibrary';
import { Emojify } from '@/components/Emojify';
import { WickrMessageMentions } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppStore } from '@/store';
import { selectUserByIdHash } from '@/store/slices/users';
import { copyTextToClipboard, getContactDisplayName } from '@/utils/strings';
import { jsonContentToElement, markdownToJSON } from '@/utils/tiptap/markdown';

import styles from './MarkdownText.module.less';

export interface MarkdownTextProps extends HTMLAttributes<HTMLDivElement> {
  /** The markdown plain text to be rendered */
  text: string;
  /** Optional list of mentions to be rendered if it is a chat message. */
  mentions?: WickrMessageMentions;
  onMentionClick?: (userId: string) => void;
  isPreview?: boolean;
  textToHighlight?: string;
  /** Optional bool if true adds a copy button to code blocks (default false) */
  copyCodeBtn?: boolean;
}

export const MarkdownText = forwardRef<HTMLDivElement, MarkdownTextProps>(
  (
    {
      text,
      mentions,
      onMentionClick,
      onClick,
      isPreview,
      textToHighlight,
      copyCodeBtn = false,
      className,
      ...props
    },
    ref
  ) => {
    const dispatch = useAppDispatch();
    const store = useAppStore();
    const displayNames = mentions
      ?.map(({ userid }) => userid)
      .filter((uid): uid is string => Boolean(uid && uid !== '@all'))
      .map((userid) => getContactDisplayName(selectUserByIdHash(store.getState(), userid)))
      .join('|');
    const element = useMemo(() => {
      if (text.length > 0) {
        const jsonContent = markdownToJSON(text, mentions);
        return jsonContentToElement(jsonContent, isPreview, textToHighlight, copyCodeBtn);
      }
    }, [text, mentions, textToHighlight, displayNames, isPreview, copyCodeBtn]);

    const handleClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;

      const { target } = event;
      if (target instanceof HTMLAnchorElement && target.dataset.mentionId) {
        onMentionClick?.(target.dataset.mentionId);
      } else if (target instanceof HTMLButtonElement && target.dataset.copyCodeValue) {
        copyTextToClipboard(target.dataset.copyCodeValue);
      }
    };

    return (
      <Tooltip
        tip={(e) => {
          if (e.target instanceof HTMLAnchorElement && e.target.textContent !== e.target.href) {
            return e.target.href.replace(/^mailto:/i, '');
          }
        }}
        delay
        inline
        position="auto"
      >
        <Emojify
          {...props}
          onClick={handleClick}
          ref={ref}
          className={clsx(styles.markdownText, className)}
        >
          {element}
        </Emojify>
      </Tooltip>
    );
  }
);

if (__DEV__) MarkdownText.displayName = 'MarkdownText';
