import { MessageBody } from '@amzn/wickr-messaging-protocol-proto';
import {
  GearIcon,
  AvatarGroupIcon,
  FolderIcon,
  GridGlobeIcon,
  VerifiedIcon,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { WickrMessageType, WickrControlMessageSettingsIdentifier } from '@/lib/protobuf/messages';
import { useAppSelectorExtra } from '@/store';
import { useConvoMember } from '@/store/hooks/useConvoMembers';
import { useFeature } from '@/store/hooks/useFeature';
import { selectConvoMessage, selectConvoType } from '@/store/slices/convos';
import { getContactDisplayName } from '@/utils/strings';
import styles from '@/components/Convo/ConvoControlMessage.module.less';

export function useControlMessage(vGroupId: string, msgId: string) {
  const { t } = useAppTranslation();
  const message = useAppSelectorExtra(selectConvoMessage, vGroupId, msgId);
  const convoType = useAppSelectorExtra(selectConvoType, vGroupId);
  const sender = useConvoMember(vGroupId, message?.senderHash);
  const senderName = getContactDisplayName(sender);
  const fileManagementEnabled = useFeature('FileManagement');
  const changes = message?.control?.update?.changes;
  // only for MsgType_Ctrl_IdentityWarning, uname is passed as server hash from the SDK
  const warningUser = useConvoMember(vGroupId, message?.control?.identityWarning?.uname ?? '');

  // Return early if message is not found
  if (!message) {
    return { Icon: GearIcon, text: '' };
  }

  const externalIcon = () => (
    <div className={styles.externalIcon}>
      <GridGlobeIcon filled />
    </div>
  );

  const getFileManagementActionText = (action?: MessageBody.Control.IFileMgtAction): string => {
    if (!action) {
      return t('Conversations.ControlMessage.SavedItems', {
        senderName,
      });
    }

    const { name } = action;
    if (fileManagementEnabled) {
      switch (action.action) {
        case MessageBody.Control.FileMgtAction.ActionType.UPLOAD:
          return t('{{senderName}} uploaded {{name}}.', {
            senderName,
            name,
          });
        case MessageBody.Control.FileMgtAction.ActionType.SAVE:
          return t('{{senderName}} saved {{name}} from messages.', {
            senderName,
            name,
          });
        case MessageBody.Control.FileMgtAction.ActionType.UNKNOWN:
          // Unknown usually corresponds to a save link action
          return t('Conversations.ControlMessage.SavedItems', {
            senderName,
          });
        default:
          return '';
      }
    } else {
      switch (action.action) {
        case MessageBody.Control.FileMgtAction.ActionType.UPLOAD:
        case MessageBody.Control.FileMgtAction.ActionType.SAVE:
        case MessageBody.Control.FileMgtAction.ActionType.UNKNOWN:
          // Unknown usually corresponds to a save link action
          return t('Conversations.ControlMessage.SavedItems', {
            senderName,
          });
        default:
          return '';
      }
    }
  };

  let Icon = GearIcon;
  let text;
  switch (message.type) {
    case WickrMessageType.MsgType_Ctrl_CreateRoom:
      text = t('Conversations.ControlMessage.Created', {
        senderName,
        context: convoType,
      });
      break;
    case WickrMessageType.MsgType_Ctrl_ModifyRoomMembers:
      Icon = AvatarGroupIcon;
      text =
        convoType === WickrConvoType.Group
          ? t('{{senderName}} changed group members.', { senderName })
          : t('Conversations.ControlMessage.ChangedMembers', { senderName });
      break;
    case WickrMessageType.MsgType_Ctrl_LeaveRoom:
      Icon = AvatarGroupIcon;
      text = t('Conversations.ControlMessage.Left', { senderName, context: convoType });
      break;
    case WickrMessageType.MsgType_Ctrl_ModifyRoomParams:
      text =
        convoType === WickrConvoType.Group
          ? t('{{senderName}} changed group settings.', { senderName })
          : t('Conversations.ControlMessage.RoomSettings', { senderName });
      if (changes?.includes(WickrControlMessageSettingsIdentifier.FILEVAULT)) {
        Icon = FolderIcon;
        text = getFileManagementActionText(message.control?.update?.fileVaultInfo?.action?.[0]);
      } else if (changes?.includes(WickrControlMessageSettingsIdentifier.MASTERS)) {
        Icon = AvatarGroupIcon;
        text = t('Conversations.ControlMessage.RoomModerators', { senderName });
      }
      break;
    case WickrMessageType.MsgType_Ctrl_DeleteRoom:
      text = t('Conversations.ControlMessage.Deleted', {
        senderName,
        context: convoType,
      });
      break;
    case WickrMessageType.MsgType_KeyVerification:
      Icon = VerifiedIcon;
      if (message.keyVerify?.accept) {
        text = t('You marked {{targetName}} as verified.', {
          targetName: message.targetUsers?.[0],
        });
      } else if (message.keyVerify?.manuallyUnverified) {
        text = t('You marked {{targetName}} as not verified.', {
          targetName: message.targetUsers?.[0],
        });
      } else if (message.keyVerify?.manuallyUnverified === false) {
        text = t(
          "You've approved {{targetName}} without verifying {{targetName}}'s security code.",
          {
            targetName: message.targetUsers?.[0],
          }
        );
      }
      break;
    case WickrMessageType.MsgType_Ctrl_DataRetentionPolicy:
      Icon = externalIcon;
      text = t(
        "There are external members present. All messages sent here may be retained based on external organizations' policies."
      );
      break;
    case WickrMessageType.MsgType_File_FileShare:
      if (message.file?.imageMetadata?.screenshotMeta) {
        text = t('{{senderName}} took a screenshot.', { senderName });
      }
      break;
    case WickrMessageType.MsgType_Ctrl_IdentityWarning:
      Icon = AvatarGroupIcon;
      text = t('{{warningUserDisplayName}} public key has been changed.', {
        warningUserDisplayName: getContactDisplayName(warningUser),
      });
      break;
    default:
      text = '';
      break;
  }
  return { Icon, text };
}
