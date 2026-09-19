import { copyTextSelection } from '../CopyHandler/copyTextSelection';
import {
  CautionIcon,
  CopyIcon,
  DeleteIcon,
  DownloadIcon,
  EditIcon,
  EmojiIcon,
  InformationIcon,
  MailIcon,
  PopOutIcon,
  PopOverItem,
  PopOverSeparator,
  RetryIcon,
  ReturnIcon,
  StarIcon,
  TranslationIcon,
  SelectAllIcon,
  SaveToIcon,
  AvatarGroupIcon,
  MessageFilledIcon,
  DocumentIcon,
} from '@/componentlibrary';
import ForwardIcon from '@/componentlibrary/icons/Forward';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { WickrMessage } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import {
  selectActiveConvoNonGuestMembersCount,
  selectActiveConvoHasUnauthorizedMembers,
} from '@/store/slices/convos';
import { selectSelfUserIsGuest } from '@/store/slices/identity';
import { pushModal } from '@/store/slices/modal';
import { selectActiveConvoDebugOnly } from '@/store/slices/shared';
import { setActiveReplyOrEditMsg } from '@/store/slices/uiChat';
import { deleteMessage, resendMessage, starMessage } from '@/store/thunks/messages';
import { openModal, openAlertModal } from '@/store/thunks/modals';
import { pushToast } from '@/store/thunks/toasts';
import { showTranslationSettings, translateMessage } from '@/store/thunks/translation';
import {
  openFile,
  saveFile,
  saveFileToRoom,
  saveLinkToRoom,
  showMessageInfo,
} from '@/store/thunks/ui';
import { convertEmojiImgsToUnicode } from '@/utils/emoji/emojiHelpers';
import { copyTextToClipboard } from '@/utils/strings';
import { isEmailUrl, removeUrlMailto } from '@/utils/url';

export type ConvoMessageContextMenuItem =
  | 'open'
  | 'reactions'
  | 'starMessage'
  | 'unstarMessage'
  | 'copyLink'
  | 'saveAs'
  | 'saveLinkToRoom'
  | 'saveToRoom'
  | 'saveToFiles'
  | 'replyToMessage'
  | 'forwardMessage'
  | 'report'
  | 'delete'
  | 'copyImage'
  | 'selectAll'
  | 'editMessage'
  | 'copyMessage'
  | 'showMessageInfo'
  | 'translateMessage'
  | 'enableMessageTranslation'
  | 'resendMessage'
  | 'openFilePreview'
  | undefined;

interface ConvoMessageContextMenuItemsProps {
  message: WickrMessage;
  items?: ConvoMessageContextMenuItem[];
  onSelectAll?: () => void;
  onCopyImage?: () => void;
  textContentRef?: React.RefObject<HTMLDivElement>;
  contentsRef?: React.RefObject<HTMLDivElement>;
  onCopyWithoutFormatting?: () => void;
  linkUrl?: string;
}

const logger = new Logger('ConvoMessage');

const ConvoMessageContextMenuItems: React.FC<ConvoMessageContextMenuItemsProps> = ({
  items = [],
  message,
  contentsRef,
  onCopyImage,
  textContentRef,
  linkUrl = '',
}) => {
  const { t } = useAppTranslation();
  const store = useAppStore();
  const dispatch = useAppDispatch();
  const nonGuestMembersCount = useAppSelector(selectActiveConvoNonGuestMembersCount);
  const isProd = useSetting('isProduction');
  const itemsSet = new Set(items);
  const enableFileDownload = useSetting('enableFileDownload');
  const messageForwardingEnabled = useSetting('messageForwardingEnabled');
  const selfUserIsGuest = useAppSelector(selectSelfUserIsGuest);
  const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);

  const handleSelectAll = () => {
    if (!contentsRef?.current) {
      return;
    }

    const selection = document.getSelection();
    if (!selection) {
      return;
    }

    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(contentsRef.current);
    selection.addRange(range);
  };

  const handleCopyMessage = () => {
    const selection = window.getSelection();

    // Check if highlighted text is available before attempting to copy the selection.
    // If no selection is found, we will copy the full textContentsRef.current value
    if (!selection || selection?.rangeCount === 0 || selection?.isCollapsed) {
      if (!textContentRef?.current) {
        logger.info('handleCopyMessage:: No textContentRef node available to copy from');
        return;
      }

      const textEl = convertEmojiImgsToUnicode(textContentRef.current);
      let copyText = '';
      const copyHtml = textEl.innerHTML;

      textEl.childNodes[0].childNodes.forEach((n, i) => {
        if (i > 0) copyText += '\n';
        copyText += n.textContent;
      });

      if (!copyText) {
        logger.info('handleCopyMessage:: No text available to copy');
        return;
      }

      copyTextToClipboard(copyText, copyHtml);
      textEl.remove();
    } else {
      copyTextSelection();
    }
  };

  // If we have contextual items that are specific to a target,
  // add a separator after them to give a visual grouping
  const hasImageLinkFile = (
    [
      'copyLink',
      'open',
      'saveAs',
      'saveLinkToRoom',
      'saveToRoom',
      'saveToFiles',
      'copyImage',
    ] satisfies ConvoMessageContextMenuItem[]
  ).some((name) => itemsSet.has(name));

  const handleDeleteMessage = async () => {
    if (hasUnauthorizedMembers) return;
    try {
      const body = message.outbox
        ? t("The message/file will be deleted from all participants' devices.")
        : t('The message/file will be deleted from only your devices.');
      const confirmed = await dispatch(
        openModal({ name: 'ConfirmModal', params: { title: t('Are you sure?'), body } })
      ).unwrap();
      if (confirmed) {
        dispatch(
          deleteMessage({
            messageId: message.msgId,
            vgroupId: message.vGroupID,
          })
        );
      }
    } catch {
      // no-op
    }
  };

  const showLimitedGuestAccessDialog = () => {
    dispatch(
      openAlertModal({
        title: t('Limited guest access'),
        body: t('Wickr network users must be present in the group.'),
      })
    );
  };

  const openTranslationSettings = () => {
    dispatch(showTranslationSettings());
  };

  return (
    <>
      {itemsSet.has('copyLink') && (
        <PopOverItem
          icon={isEmailUrl(linkUrl) ? <MailIcon /> : <CopyIcon />}
          onClick={() => {
            copyTextToClipboard(removeUrlMailto(linkUrl));
          }}
        >
          {isEmailUrl(linkUrl) ? t('Copy email address') : t('Message.Menu.CopyLink')}
        </PopOverItem>
      )}
      {itemsSet.has('open') && !hasUnauthorizedMembers && (
        <PopOverItem
          icon={<PopOutIcon />}
          onClick={() => {
            dispatch(openFile({ vgroupId: message.vGroupID, messageId: message.msgId }));
          }}
        >
          {t('Message.Menu.Open')}
        </PopOverItem>
      )}
      {itemsSet.has('saveAs') && enableFileDownload && !hasUnauthorizedMembers && (
        <PopOverItem
          icon={<DownloadIcon />}
          onClick={() => {
            dispatch(saveFile({ vgroupId: message.vGroupID, messageId: message.msgId }));
          }}
        >
          {t('Message.Menu.SaveAs')}
        </PopOverItem>
      )}
      {itemsSet.has('saveLinkToRoom') && (
        <PopOverItem
          icon={<SaveToIcon />}
          onClick={() => {
            dispatch(
              saveLinkToRoom({
                link: linkUrl,
                vgroupId: message.vGroupID,
                messageId: message.msgId,
              })
            );
          }}
        >
          {t('Message.Link.SaveToRoom')}
        </PopOverItem>
      )}
      {itemsSet.has('saveToFiles') && (
        <PopOverItem
          icon={<SaveToIcon />}
          onClick={() => {
            dispatch(
              saveFileToRoom({
                vgroupId: message.vGroupID,
                messageId: message.msgId,
              })
            );
          }}
        >
          {t('Message.Menu.SaveToFiles')}
        </PopOverItem>
      )}
      {itemsSet.has('copyImage') && enableFileDownload && (
        <PopOverItem icon={<CopyIcon />} onClick={onCopyImage}>
          {t('Message.Menu.CopyImage')}
        </PopOverItem>
      )}
      {hasImageLinkFile && <PopOverSeparator />}
      {itemsSet.has('reactions') && (
        <PopOverItem
          icon={<EmojiIcon />}
          onClick={() => {
            dispatch(
              openModal({
                name: 'ReactionsModal',
                params: {
                  vgroupId: message.vGroupID,
                  msgId: message.msgId,
                },
              })
            );
          }}
        >
          {t('Message.Menu.Reactions')}
        </PopOverItem>
      )}
      {itemsSet.has('starMessage') && (
        <PopOverItem
          icon={<StarIcon />}
          onClick={() => {
            dispatch(
              starMessage({
                messageId: message.msgId,
                star: !message.starred,
                vgroupId: message.vGroupID,
              })
            );
            dispatch(
              pushToast({
                label: t(message.starred ? 'Unstarred message' : 'Starred message'),
                icon: message.starred ? 'star' : 'star-filled',
                color: 'primary',
                id: `star-${message.msgId}`,
              })
            );
          }}
        >
          {message.starred ? t('Message.Menu.Unstar') : t('Message.Menu.Star')}
        </PopOverItem>
      )}
      {itemsSet.has('enableMessageTranslation') && (
        <PopOverItem icon={<TranslationIcon />} onClick={openTranslationSettings}>
          {t('Message.Menu.EnableMessageTranslation')}
        </PopOverItem>
      )}
      {itemsSet.has('translateMessage') && (
        <PopOverItem
          icon={<TranslationIcon />}
          onClick={() => {
            dispatch(
              translateMessage({
                vgroupId: message.vGroupID,
                messageId: message.msgId,
              })
            );
          }}
        >
          {t('Message.Menu.TranslateMessage')}
        </PopOverItem>
      )}
      {itemsSet.has('copyMessage') && (
        <PopOverItem icon={<CopyIcon />} onClick={handleCopyMessage}>
          {t('Message.Menu.CopyMessage')}
        </PopOverItem>
      )}
      {itemsSet.has('resendMessage') && (
        <PopOverItem
          icon={<RetryIcon />}
          onClick={() =>
            dispatch(resendMessage({ vgroupId: message.vGroupID, messageId: message.msgId }))
          }
        >
          {t('Message.Menu.ResendMessage')}
        </PopOverItem>
      )}
      {itemsSet.has('selectAll') && (
        <PopOverItem icon={<SelectAllIcon />} onClick={handleSelectAll}>
          {t('Message.Menu.SelectAll')}
        </PopOverItem>
      )}
      {itemsSet.has('editMessage') && (
        <PopOverItem
          icon={<EditIcon />}
          onClick={() => {
            if (nonGuestMembersCount === 0) {
              showLimitedGuestAccessDialog();
            } else {
              dispatch(
                setActiveReplyOrEditMsg({
                  msgId: message.msgId,
                  type: 'edit',
                })
              );
            }
          }}
        >
          {t('Message.Menu.Edit')}
        </PopOverItem>
      )}
      {itemsSet.has('replyToMessage') && (
        <PopOverItem
          icon={<ReturnIcon />}
          onClick={() => {
            if (nonGuestMembersCount === 0) {
              showLimitedGuestAccessDialog();
            } else {
              dispatch(
                setActiveReplyOrEditMsg({
                  msgId: message.msgId,
                  type: 'reply',
                })
              );
            }
          }}
        >
          {t('Message.Menu.Reply')}
        </PopOverItem>
      )}
      {itemsSet.has('forwardMessage') && messageForwardingEnabled && !selfUserIsGuest && (
        <PopOverItem
          icon={<ForwardIcon />}
          onClick={() => {
            dispatch(
              openModal({
                name: 'ForwardMessageModal',
                params: { message },
              })
            );
          }}
        >
          {t('Forward')}
        </PopOverItem>
      )}
      {itemsSet.has('report') && (
        <PopOverItem
          variant="alert"
          icon={<CautionIcon />}
          onClick={() =>
            dispatch(
              pushModal({ name: 'ReportUserModal', params: { userId: message.senderUserName } })
            )
          }
        >
          {t('Message.Menu.Report')}
        </PopOverItem>
      )}
      {itemsSet.has('showMessageInfo') && (
        <PopOverItem
          icon={<InformationIcon />}
          onClick={() => {
            dispatch(showMessageInfo(message));
          }}
        >
          {t('Message.Menu.ShowMessageInfo')}
        </PopOverItem>
      )}
      {itemsSet.has('delete') && (
        <PopOverItem icon={<DeleteIcon />} onClick={handleDeleteMessage} variant="alert">
          {t('Message.Menu.Delete')}
        </PopOverItem>
      )}
      {!isProd && (
        <>
          <PopOverSeparator />
          <PopOverItem
            icon={<AvatarGroupIcon />}
            onClick={async () => {
              const convo = selectActiveConvoDebugOnly(store.getState());
              const body = Object.entries(convo)
                .map(
                  ([key, value]) =>
                    `- **${key}:** ${
                      Array.isArray(value)
                        ? `Array<${value.length}>`
                        : value && typeof value == 'object'
                        ? '<Object>'
                        : value === ''
                        ? '""'
                        : value
                    }`
                )
                .sort()
                .join('\n');
              const value = await dispatch(
                openModal({
                  name: 'ConfirmModal',
                  params: {
                    title: 'Convo Debug Info (alpha/beta only)',
                    body,
                    bodyType: 'markdown',
                    confirmText: 'Copy & Close',
                    size: 'lg',
                  },
                })
              ).unwrap();
              if (value) {
                copyTextToClipboard(body);
              }
            }}
          >
            Convo Debug Info
          </PopOverItem>
          <PopOverItem
            icon={<MessageFilledIcon />}
            onClick={async () => {
              const body = `
- **vGroupId:** ${message.vGroupID}
- **msgId:** ${message.msgId}
- **senderHash:** ${message.senderHash}
- **inReplyTo:** ${message.inReplyTo ?? ''}
- **isOutbox:** ${message.outbox}
- **content:** \`${message.textContent.substring(0, 90).replace(/`/gm, 'ʼ')}\`${
                message.textContent.length > 90 ? '...' : ''
              }
- **mentions:** ${JSON.stringify(
                (message.text?.mentionList ?? []).map(({ startIndex, endIndex }) =>
                  message.textContent.substring(startIndex!, endIndex!)
                )
              )}
- **msgTimestamp:** ${message.timeStamp}
- **msgTime:** ${new Date(message.timeStamp).toLocaleString()}
- **currentTime:** ${new Date().toLocaleString()}
`.trim();

              const value = await dispatch(
                openModal({
                  name: 'ConfirmModal',
                  params: {
                    title: 'Message Debug Info (alpha/beta only)',
                    body,
                    bodyType: 'markdown',
                    confirmText: 'Copy & Close',
                    size: 'lg',
                  },
                })
              ).unwrap();
              if (value) {
                copyTextToClipboard(body);
              }
            }}
          >
            Message Debug Info
          </PopOverItem>
        </>
      )}
      {__DEV__ && Boolean(message.file?.fileMetadata?.name) && (
        <PopOverItem
          icon={<DocumentIcon />}
          onClick={() =>
            dispatch(
              pushModal({
                name: 'FilePreviewModal',
                params: {
                  msgId: message.msgId,
                  vgroupId: message.vGroupID,
                },
              })
            )
          }
        >
          Open File Preview (dev)
        </PopOverItem>
      )}
    </>
  );
};

export default ConvoMessageContextMenuItems;
