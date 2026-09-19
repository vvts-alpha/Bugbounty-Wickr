import { Editor } from '@tiptap/core';
import { FC } from 'react';
import { TOOLBAR_ICON_SIZE } from '../constants';
import { IconButton, LinkIcon, Tooltip } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { metrics } from '@/lib/metrics';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { AddLinkModalParams } from '@/store/slices/modal';
import { openModal } from '@/store/thunks/modals';
import { ensureLinkHasProtocol } from '@/utils/path';

interface LinkFormatButtonProps {
  editor: Editor;
  onClick?: (event: React.MouseEvent) => void;
}

export const LinkFormatButton: FC<LinkFormatButtonProps> = ({ editor, onClick, ...rest }) => {
  const abortableDispatch = useAbortableDispatch();
  const getPreviousUrl = () => editor.getAttributes('link').href || '';
  const { t } = useAppTranslation();

  //  WITH SELECTION
  //      TEXT + LINK = REPLACE WITH TEXT + SET LINK
  //      TEXT ONLY = REPLACE TEXT AND UNSET LINK
  //      LINK ONLY = JUST SET LINK

  //  WITHOUT SELECTION
  //      TEXT + LINK = ADD WITH TEXT + SET LINK
  //      TEXT ONLY = ADD TEXT AND UNSET LINK
  //      LINK ONLY = ADD LINK TEXT + SET LINK

  const updateLink = (text: string, link: string) => {
    if (!link && !editor.state.selection.empty) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    // add text/link text and set link text
    // break the command chain into two parts to link the markdown input
    const { from } = editor.state.selection;
    const to = from + text.length;

    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertText(text || link)
      .run();

    editor
      .chain()
      .setTextSelection({ from, to })
      .setLink({ href: ensureLinkHasProtocol(link || text) })
      .setTextSelection(to)
      .run();
  };

  const getSelectedText = () => {
    const { from, to, empty } = editor.state.selection;

    if (empty) {
      return null;
    }

    return editor.state.doc.textBetween(from, to, ' ');
  };

  const handleOnOpen = () => {
    metrics.addCount('Markdown:Hyperlink');
    const previousUrl = getPreviousUrl();
    if (previousUrl && editor.state.selection.empty) {
      editor.commands.extendMarkRange('link');
    }
    const selectedText = getSelectedText();

    const text = selectedText || '';
    const link = previousUrl;

    return [text, link];
  };

  return (
    <Tooltip tip={t('Compose.Link')}>
      <IconButton
        onClick={async (event) => {
          onClick?.(event);
          const [text, link] = handleOnOpen();
          try {
            const value = (await abortableDispatch(
              openModal({
                name: 'AddLinkModal',
                params: { text, link },
              })
            )) as AddLinkModalParams;

            if (!value) {
              // Focus editor on cancel
              editor.commands.focus();
            } else if (typeof value.link === 'string' && typeof value.text === 'string') {
              updateLink(value.text, value.link);
            }
          } catch {
            // no-op
          }
        }}
        label={t('Compose.Link')}
        {...rest}
      >
        <LinkIcon size={TOOLBAR_ICON_SIZE} />
      </IconButton>
    </Tooltip>
  );
};

export default LinkFormatButton;
