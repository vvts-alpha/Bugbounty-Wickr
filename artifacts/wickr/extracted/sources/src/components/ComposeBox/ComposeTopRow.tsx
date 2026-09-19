import { Editor } from '@tiptap/react';
import clsx from 'clsx';
import { FC } from 'react';
import { KeyboardShortcut } from '../KeyboardShortcut';
import {
  BoldIcon,
  CodeblockIcon,
  CodeIcon,
  IconButton,
  ItalicIcon,
  OrderedListIcon,
  QuoteIcon,
  StrikethroughIcon,
  Tooltip,
  UnorderedListIcon,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { metrics } from '@/lib/metrics';
import LinkFormatButton from './LinkFormatButton/LinkFormatButton';
import { TOOLBAR_ICON_SIZE } from './constants';
import { WithDivider } from './withDivider';

import styles from './ComposeBox.module.less';

// includes regular KeyboardEvent because KeyboardShortcut uses non-react tapkeys
type ClickEvent = React.MouseEvent | React.KeyboardEvent | KeyboardEvent;

export interface ComposeTopRowProps {
  editor: Editor;
  markdownControlsVisible: boolean;
  onClick: (event: ClickEvent, action: TopButtonAction) => void;
  simple?: boolean;
}

export type TopButtonAction =
  | 'blockquote'
  | 'bold'
  | 'bulletList'
  | 'code'
  | 'codeBlock'
  | 'italic'
  | 'link'
  | 'orderedList'
  | 'strike';

export const ComposeTopRow: FC<ComposeTopRowProps> = ({
  editor,
  markdownControlsVisible,
  onClick,
  simple,
}) => {
  const { t } = useAppTranslation();

  const createClickHandler =
    (action: TopButtonAction, inlineHandler?: (event: ClickEvent) => void) =>
    (event: ClickEvent) => {
      // make sure both handlers are called
      try {
        onClick(event, action);
      } finally {
        inlineHandler?.(event);
      }
    };

  return (
    <div
      className={clsx(styles.buttonRow, styles.inInput, {
        [styles.active]: markdownControlsVisible,
      })}
      onClick={(e) => {
        // prevent focus being stolen by compose input when a popover is opened
        if (
          e.target instanceof HTMLElement &&
          !(e.target as HTMLElement).closest('.popoverMenu') &&
          !(e.target as HTMLElement).closest('.popoverContentWrapper') &&
          !(e.target as HTMLElement).closest(`[data-blur-editor='true']`)
        ) {
          editor?.commands.focus();
        }
      }}
    >
      <Tooltip tip={t('Compose.Bold')}>
        <IconButton
          label={t('Compose.Bold')}
          selected={editor.isActive('bold')}
          onClick={createClickHandler('bold', () => {
            editor.chain().focus().toggleBold().run();
            if (editor.isActive('bold')) {
              metrics.addCount('Markdown:Bold');
            }
          })}
        >
          <BoldIcon size={TOOLBAR_ICON_SIZE} />
        </IconButton>
      </Tooltip>
      <Tooltip tip={t('Compose.Italic')}>
        <IconButton
          label={t('Compose.Italic')}
          selected={editor.isActive('italic')}
          onClick={createClickHandler('italic', () => {
            editor.chain().focus().toggleItalic().run();
            if (editor.isActive('italic')) {
              metrics.addCount('Markdown:Italics');
            }
          })}
        >
          <ItalicIcon size={TOOLBAR_ICON_SIZE} />
        </IconButton>
      </Tooltip>
      <Tooltip tip={t('Compose.Strikethrough')}>
        <IconButton
          label={t('Compose.Strikethrough')}
          selected={editor.isActive('strike')}
          onClick={createClickHandler('strike', () => {
            editor.chain().focus().toggleStrike().run();
            if (editor.isActive('strike')) {
              metrics.addCount('Markdown:Strikethrough');
            }
          })}
        >
          <StrikethroughIcon size={TOOLBAR_ICON_SIZE} />
        </IconButton>
      </Tooltip>
      <WithDivider>
        <Tooltip tip={t('Compose.OrderedList')}>
          <IconButton
            label={t('Compose.OrderedList')}
            selected={editor.isActive('orderedList')}
            onClick={createClickHandler('orderedList', () => {
              editor.chain().focus().toggleOrderedList().run();
              if (editor.isActive('orderedList')) {
                metrics.addCount('Markdown:OrderedList');
              }
            })}
          >
            <OrderedListIcon size={TOOLBAR_ICON_SIZE} />
          </IconButton>
        </Tooltip>
      </WithDivider>
      <Tooltip tip={t('Compose.BulletedList')}>
        <IconButton
          label={t('Compose.BulletedList')}
          selected={editor.isActive('bulletList')}
          onClick={createClickHandler('bulletList', () => {
            editor.chain().focus().toggleBulletList().run();
            if (editor.isActive('bulletList')) {
              metrics.addCount('Markdown:UnorderedList');
            }
          })}
        >
          <UnorderedListIcon size={TOOLBAR_ICON_SIZE} />
        </IconButton>
      </Tooltip>

      <WithDivider>
        <LinkFormatButton editor={editor} onClick={createClickHandler('link')} />
      </WithDivider>
      <Tooltip tip={t('Compose.Quote')}>
        <IconButton
          label={t('Compose.Quote')}
          selected={editor.isActive('blockquote')}
          onClick={createClickHandler('blockquote', () => {
            editor.chain().focus().toggleBlockquote().run();
            if (editor.isActive('blockquote')) {
              metrics.addCount('Markdown:Blockquote');
            }
          })}
        >
          <QuoteIcon size={TOOLBAR_ICON_SIZE} />
        </IconButton>
      </Tooltip>
      <WithDivider>
        <Tooltip tip={t('Compose.Code')}>
          <IconButton
            label={t('Compose.Code')}
            selected={editor.isActive('code')}
            onClick={createClickHandler('code', () => {
              editor.chain().focus().toggleCode().run();
              if (editor.isActive('code')) {
                metrics.addCount('Markdown:InlineCode');
              }
            })}
          >
            <CodeIcon size={TOOLBAR_ICON_SIZE} />
          </IconButton>
        </Tooltip>
      </WithDivider>
      <Tooltip tip={t('Compose.Codeblock')}>
        <IconButton
          label={t('Compose.Codeblock')}
          selected={editor.isActive('codeBlock')}
          onClick={createClickHandler('codeBlock')}
        >
          <CodeblockIcon size={TOOLBAR_ICON_SIZE} />
        </IconButton>
      </Tooltip>
      {!simple && (
        <KeyboardShortcut
          shortcut="CodeBlock"
          onShortcut={(event) => createClickHandler('codeBlock')(event)}
        />
      )}
    </div>
  );
};
