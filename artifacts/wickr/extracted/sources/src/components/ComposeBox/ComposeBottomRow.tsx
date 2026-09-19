import { Editor } from '@tiptap/react';
import clsx from 'clsx';
import { FC } from 'react';
import EmojiPopper, { EmojiPopperRef, Emoji } from '../Convo/EmojiPicker/EmojiPopper';
import { KeyboardShortcut } from '../KeyboardShortcut';
import {
  IconButton,
  FormattingIcon,
  MentionIcon,
  EmojiIcon,
  Tooltip,
  SendIcon,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { metrics } from '@/lib/metrics';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectIsMessagesTabActive } from '@/store/slices/uiChat';
import { updateMarkdownControlsVisible } from '@/store/thunks/settings';
import { AddButton } from './AddButton/AddButton';
import { NewLineHint } from './NewLineHint/NewLineHint';
import { ACTIONS_ICON_SIZE } from './constants';
import { WithDivider } from './withDivider';

import styles from './ComposeBox.module.less';

export interface ComposeBottomRowProps {
  editor: Editor;
  emojiPopperRef: React.RefObject<EmojiPopperRef>;
  markdownControlsVisible: boolean;
  onClick: (event: React.MouseEvent, action: BottomButtonAction) => void;
  onEmojiSelection: (emoji: Emoji, _emojiSystemType: string) => void;
  sendDisabled: boolean;
  shouldEnableMentions: boolean | undefined;
  showAddbutton: boolean;
  showNewlineHint: boolean;
  simple: boolean | undefined;
}

export type BottomButtonAction = 'mention' | 'send';

export const ComposeBottomRow: FC<ComposeBottomRowProps> = ({
  editor,
  emojiPopperRef,
  markdownControlsVisible,
  onClick,
  onEmojiSelection,
  sendDisabled = false,
  shouldEnableMentions,
  showAddbutton,
  showNewlineHint = false,
  simple,
}) => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();

  const isMessagesActive = useAppSelector(selectIsMessagesTabActive);

  const createClickHandler =
    (action: BottomButtonAction, inlineHandler?: (event: React.MouseEvent) => void) =>
    (event: React.MouseEvent) => {
      // make sure both handlers are called
      try {
        onClick(event, action);
      } finally {
        inlineHandler?.(event);
      }
    };

  return (
    <div className={clsx(styles.buttonRow, styles.bottom)}>
      {!simple && showAddbutton && <AddButton />}
      <WithDivider showDivider={!simple && showAddbutton}>
        <Tooltip
          tip={markdownControlsVisible ? t('Compose.HideFormatting') : t('Compose.ShowFormatting')}
        >
          <IconButton
            label={
              markdownControlsVisible ? t('Compose.HideFormatting') : t('Compose.ShowFormatting')
            }
            selected={markdownControlsVisible}
            onClick={() => {
              if (!markdownControlsVisible) {
                metrics.addCount('Markdown:FormatToolbar');
              }

              dispatch(updateMarkdownControlsVisible(!markdownControlsVisible));
              editor.commands.focus();
            }}
          >
            <FormattingIcon size={ACTIONS_ICON_SIZE} />
          </IconButton>
        </Tooltip>
      </WithDivider>
      {shouldEnableMentions && (
        <Tooltip tip={t('Compose.Mention')}>
          <IconButton
            label={t('Compose.Mention')}
            onClick={createClickHandler('mention')}
            aria-disabled={editor.isActive('codeBlock')}
          >
            <MentionIcon size={ACTIONS_ICON_SIZE} />
          </IconButton>
        </Tooltip>
      )}
      <EmojiPopper
        ref={emojiPopperRef}
        buttonIcon={<EmojiIcon size={ACTIONS_ICON_SIZE} />}
        useQuickSelect={false}
        tooltip={t('Compose.Emoji')}
        placement={simple ? 'top-start' : undefined}
        onEmojiSelection={onEmojiSelection}
      />
      {!simple && (
        <>
          <KeyboardShortcut
            shortcut="EmojiMenu"
            onShortcut={() => emojiPopperRef.current?.toggle()}
            disabled={!isMessagesActive}
          />
          <div className={styles.sendButtonWrapper}>
            <NewLineHint visible={showNewlineHint} />
            <Tooltip tip={t('Compose.Send')}>
              <IconButton
                label={t('Compose.Send')}
                className={styles.sendButton}
                onClick={createClickHandler('send')}
                aria-disabled={sendDisabled}
              >
                <SendIcon size="20px" />
              </IconButton>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
};
