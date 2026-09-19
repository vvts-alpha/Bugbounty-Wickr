import { clsx } from 'clsx';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { v4 } from 'uuid';
import { MarkdownText } from '../MarkdownText';
import { IconButton, PopOver, Button, CaretIcon } from '@/componentlibrary';
import { useOnResized } from '@/hooks/resizeObserver';
import useConst from '@/hooks/useConst';
import { useAppTranslation } from '@/lib/i18n';
import { asForwardedMessage, isForwardedMessage, WickrMessage } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectActiveConvoHasUnauthorizedMembers,
  selectActiveConvoSelfMember,
} from '@/store/slices/convos';
import { viewContactDetails } from '@/store/thunks/ui';
import ConvoMessageLinkContent from './ConvoMessageLinkContent';
import { MessagePreview } from './MessagePreview';
import { MessageQuote } from './MessagePreview/MessageQuote';
import MessageTranslation from './MessageTranslation';

// Add styles for rendering messages with syntax highlighting
// We used to import languages individually, but it seems to infer them without it
import 'highlight.js/styles/a11y-light.css';
import styles from './ConvoMessageTextContent.module.less';

type Props = {
  message: WickrMessage;
  isInteractive?: boolean;
};

const ConvoMessageTextContent = forwardRef<HTMLDivElement, Props>(
  ({ message, isInteractive = true }, ref) => {
    const { t } = useAppTranslation();
    const dispatch = useAppDispatch();
    const selfMember = useAppSelector(selectActiveConvoSelfMember);
    const uuid = useConst(v4);

    const hasMessageTranslation = !!message?.msgTranslation || message.msgTranslationPending;
    const [collapseText, setCollapseText] = useState(hasMessageTranslation);
    const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);

    useEffect(() => {
      setCollapseText(hasMessageTranslation);
    }, [hasMessageTranslation]);

    // handles showing collapsed text toggle button & applies fade out styling
    const [showCollapsibleTextUI, setShowCollapsibleTextUI] = useState(false);

    const links = message.text?.links ?? [];

    const handleToggleCollapseText = () => {
      setCollapseText(!collapseText);
    };

    const collapsibleTextRef = useOnResized((entry) => {
      const offsetHeight = entry.contentRect.height;
      const scrollHeight = entry.target.scrollHeight;

      if (hasMessageTranslation && offsetHeight < scrollHeight) {
        setShowCollapsibleTextUI(true);
      }
    });

    const renderMessageText = () => {
      // Don't render the forwarded content in the body of the message
      if (isForwardedMessage(message)) return;
      return (
        <MarkdownText
          className={clsx(styles.messageText)}
          ref={ref}
          text={message.textContent}
          mentions={message.text?.mentionList}
          onMentionClick={(userId) => dispatch(viewContactDetails({ userId }))}
          id={uuid}
        />
      );
    };

    const renderLinkPreviews = () => {
      if (isForwardedMessage(message) || hasUnauthorizedMembers) return;
      return links.map((link, index) => (
        <ConvoMessageLinkContent
          /** Apply tabIndex={-1} to single links since they will be rendered in the message itself */
          tabIndex={links.length === 1 ? -1 : undefined}
          link={link}
          vgroupId={message.vGroupID}
          messageId={message.msgId}
          // link.url isn't unique, use index instead
          key={index}
          // if originallySentTimestamp is populated then we recieved link preview data. we don't want to save empty link previews
          showSaveToRoom={
            !selfMember?.isGuest && !!selfMember?.moderator && !!link.originallySentTimestamp
          }
        />
      ));
    };

    const previewBtnRef = useRef(null);
    const [previewMenuIsOpen, setPreviewMenuIsOpen] = useState(false);
    const renderLinkPreviewMenu = () => {
      if (isForwardedMessage(message)) return;
      const width =
        previewBtnRef.current && previewMenuIsOpen
          ? getComputedStyle(previewBtnRef.current).width
          : '';
      const maxWidth = width ? 'unset' : '';
      const number = links.length;
      return (
        <PopOver
          placement="top-start"
          popoverContent={renderLinkPreviews()}
          menuClassName={styles.linkPreviewsMenu}
          style={{ width, maxWidth, marginLeft: '3px' }}
          onOpen={() => setPreviewMenuIsOpen(true)}
          onClose={() => setPreviewMenuIsOpen(false)}
        >
          <Button ref={previewBtnRef} className={styles.linkPreviewsTarget}>
            {`${t('See link previews')} (${number})`}
          </Button>
        </PopOver>
      );
    };

    const forwardedMessage = asForwardedMessage(message);

    return (
      // An aria-label is required here for screen reader functionality. Markdown text is composed of various elements like ol, ul, li, and code required for styling.
      // But in the QT WebView, these elements are not able to be read by a screen reader. This allows the whole message to be read by a screen reader. Buttons and links
      // inside the message are still reachable.
      <div className={styles.convoMessageTextContent} aria-labelledby={uuid}>
        {message.inReplyTo && !isForwardedMessage(message) && (
          <MessageQuote msgId={message.inReplyTo} />
        )}
        {forwardedMessage && (
          <MessagePreview
            type="incoming-forward"
            message={message}
            isInteractive={isInteractive}
            ref={ref}
          />
        )}

        {
          // Don't show link previews for forwarded messages
          links.length
            ? links.length === 1
              ? renderLinkPreviews()
              : renderLinkPreviewMenu()
            : undefined
        }
        {hasMessageTranslation ? (
          <>
            <div className={styles.textWrapper}>
              <div
                ref={collapsibleTextRef}
                className={clsx(styles.collapsibleText, {
                  [styles.collapsedText]: collapseText,
                  [styles.outgoingFade]: showCollapsibleTextUI && collapseText && message.outbox,
                  [styles.incomingFade]: showCollapsibleTextUI && collapseText && !message.outbox,
                })}
              >
                {renderMessageText()}
              </div>
              {showCollapsibleTextUI && (
                <IconButton
                  onClick={handleToggleCollapseText}
                  className={styles.toggleCollapseTextButton}
                  label={t('Toggle text button')}
                >
                  <CaretIcon direction={collapseText ? 'down' : 'up'} />
                </IconButton>
              )}
            </div>
            <MessageTranslation message={message} />
          </>
        ) : (
          renderMessageText()
        )}
      </div>
    );
  }
);

if (__DEV__) ConvoMessageTextContent.displayName = 'ConvoMessageTextContent';

export default ConvoMessageTextContent;
