import { ContactBackup } from '@amzn/wickr-messaging-protocol-proto';
import { clsx } from 'clsx';
import { FC, useMemo } from 'react';
import { EditConvoPayload } from '@/apis/webChannel/BridgeWebChannel';
import {
  Button,
  GridGlobeIcon,
  PopOver,
  Checkbox,
  PopOverItem,
  IconButton,
  MoreIcon,
  MakeModeratorIcon,
  RemoveModeratorIcon,
  RemoveUserIcon,
  VerifiedIcon,
} from '@/componentlibrary';
import { Avatar } from '@/components/Avatar';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoMember } from '@/lib/protobuf/contacts';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import {
  selectActiveConvoHasUnauthorizedMembers,
  selectConvoCanModifyUserRole,
  selectConvoCanRemoveUser,
  selectConvoType,
} from '@/store/slices/convos';
import { selectSelfUserEmail, selectSelfUserIsGuest } from '@/store/slices/identity';
import { editConvo } from '@/store/thunks/convos';
import { viewContactDetails } from '@/store/thunks/ui';
import { copyTextToClipboard, getContactDisplayName } from '@/utils/strings';

import styles from './styles.module.less';

interface UserRowProps {
  /** The member or contact to display */
  member: WickrConvoMember;
  /** Optional vGroupId of the associated convo, if any */
  vGroupId?: string;
  /** Set this to true to show checkboxes */
  showCheck?: boolean;
  /** Set this to true if the checkbox should be checked (showCheck must be true to display them) */
  checked?: boolean;
  /** Set this to true if the checkbox is disabled */
  checkDisabled?: boolean;
  /** Set to true to show the context menu items, default false */
  showContextMenuItems?: boolean;
  /** Optional callback when a checkbox is selected (showCheck must be true) */
  onSelectCheckbox?: (checked: boolean) => void;
  /** Set to true to hide the BOT tag for bots. Default false. */
  hideBotTag?: boolean;
  /** Set to true to hide the external icon and subtitle if the user is external. Default false. */
  hideExternal?: boolean;
  /** Optional callback when the user row is clicked. If nothing is provided, it will open their
   * contact details panel by default. */
  onClick?: () => void;
  /** Optional element to be absolutely positioned at the end of the user row. */
  trailingPopover?: JSX.Element;
  /** Set to true to render as a non-interactive div instead of button */
  readOnly?: boolean;
}

export const UserRow: FC<UserRowProps> = ({
  member,
  showCheck = false,
  checked = false,
  checkDisabled = false,
  onSelectCheckbox = () => {},
  showContextMenuItems = false,
  vGroupId,
  hideBotTag = false,
  hideExternal = false,
  onClick,
  trailingPopover,
  readOnly = false,
}) => {
  // NOTE: This component is used in convos and in the Contacts panel. It must not use an active conversation selectors!!!
  // NOTE: This component is used in convos and in the Contacts panel. It must not use an active conversation selectors!!!
  // NOTE: This component is used in convos and in the Contacts panel. It must not use an active conversation selectors!!!
  // NOTE: This component is used in convos and in the Contacts panel. It must not use an active conversation selectors!!!
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const displayName = getContactDisplayName(member);
  const convoType = useAppSelectorExtra(selectConvoType, vGroupId ?? '');
  const isGuest = useAppSelector(selectSelfUserIsGuest);
  const shouldHideExternal = hideExternal || isGuest;
  const isSelfUser = useAppSelector(selectSelfUserEmail) === member.id;
  const canRemoveUser = useAppSelectorExtra(selectConvoCanRemoveUser, vGroupId ?? '');
  const canModifyUserRole = useAppSelectorExtra(selectConvoCanModifyUserRole, vGroupId ?? '');
  const isVerified =
    member.verificationStatus === ContactBackup.Contact.VerificationStatus.VERIFIED && !isSelfUser;
  const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);

  const getMemberSubtitle = (member: WickrConvoMember) => {
    if (!member.inNetwork) {
      return !shouldHideExternal ? t('External member') : '';
    }

    return member.isBot ? '' : member.id;
  };

  const handleRemoveFromRoomClick = () => {
    if (!vGroupId) {
      return;
    }

    dispatch(
      editConvo({
        vgroupId: vGroupId,
        deletedUsers: [member.idHash],
      })
    );
  };

  const handleCopyClick = () => {
    let textToCopy = `${displayName} <${member.id}>`;
    if (displayName === member.id) {
      textToCopy = member.id;
    }
    copyTextToClipboard(textToCopy);
  };

  const handleModeratorClick = () => {
    if (!vGroupId) {
      return;
    }

    const payload: EditConvoPayload = { vgroupId: vGroupId };

    if (member.moderator) {
      payload.deletedModerators = [member.idHash];
    } else {
      payload.addedModerators = [member.idHash];
    }

    dispatch(editConvo(payload));
  };

  const contextMenuItems = useMemo(
    () =>
      !showCheck && showContextMenuItems
        ? [
            <PopOverItem key="copy" onClick={handleCopyClick}>
              {t('Copy')}
            </PopOverItem>,
            canModifyUserRole && !hasUnauthorizedMembers && !member.isGuest && !isSelfUser && (
              <PopOverItem
                icon={member.moderator ? <RemoveModeratorIcon /> : <MakeModeratorIcon />}
                variant={member.moderator ? 'alert' : 'default'}
                key="mod"
                onClick={handleModeratorClick}
              >
                {t(member.moderator ? 'Remove Moderator' : 'Make Moderator')}
              </PopOverItem>
            ),
            canRemoveUser && !isSelfUser && (
              <PopOverItem
                icon={<RemoveUserIcon />}
                variant="alert"
                key="remove"
                onClick={handleRemoveFromRoomClick}
              >
                {t('Remove from Room')}
              </PopOverItem>
            ),
          ]
        : [],
    [member, showCheck, canRemoveUser, canModifyUserRole, showContextMenuItems]
  );

  const handleClick = () => {
    if (readOnly) return; // Don't handle clicks in readonly mode

    if (showCheck && !checkDisabled) {
      onSelectCheckbox(!checked);
    } else if (!showCheck) {
      onClick ? onClick() : dispatch(viewContactDetails({ userIdHash: member.idHash }));
    }
  };

  const memberInfoElement = useMemo(() => {
    return (
      <div className={clsx(styles.infoContainer, { [styles.extraPadding]: !!trailingPopover })}>
        <div className={styles.avatarWrapper}>
          <Avatar userIdHash={member.idHash} name={displayName} />
          {!member.inNetwork && !shouldHideExternal && (
            <GridGlobeIcon className={clsx(styles.externalBadge, styles.abs)} filled size="16px" />
          )}
        </div>
        <div className={styles.info}>
          <div className={styles.nameWrapper}>
            <span className={styles.name}>{displayName}</span>
            {isVerified && <VerifiedIcon />}
            {member.isGuest && <span>{t('Conversations.Guest')}</span>}
          </div>
          <div className={styles.id}>{getMemberSubtitle(member)}</div>
        </div>
        <div className={styles.rightContent}>
          {!hideBotTag && member.isBot && <div className={styles.tag}>{t('Bot')}</div>}
          {convoType === WickrConvoType.Room && member.moderator && (
            <div className={styles.tag}>{t('Moderator')}</div>
          )}
        </div>
      </div>
    );
  }, [member, convoType, displayName]);

  const renderAbsolutelyPositionedContent = () => (
    <div className={styles.absolutelyPositionedContent}>
      {contextMenuItems?.length > 0 && (
        <PopOver
          iconGutter
          contentWrapperClassName={styles.popoverWrapper}
          popoverContent={contextMenuItems}
          triggerType="click"
        >
          <IconButton iconSize="sm" label={t('ConvoList.Header.OpenMenu')}>
            <MoreIcon />
          </IconButton>
        </PopOver>
      )}
      {trailingPopover}
    </div>
  );

  if (!member.id) {
    return null;
  }

  // VoiceOver cannot read <li> tags in the QT WebEngine
  return (
    <div key={member.idHash}>
      <PopOver
        contentWrapperClassName={styles.popoverWrapper}
        popoverContent={readOnly ? [] : contextMenuItems} // No context menu in readonly
        triggerType="contextmenu"
      >
        {showCheck ? (
          <div onClick={handleClick} className={clsx(styles.checkboxRow, styles.item)}>
            <Checkbox
              checked={checked}
              aria-label={displayName}
              aria-disabled={checkDisabled}
              className={styles.checkbox}
            />
            {memberInfoElement}
            {renderAbsolutelyPositionedContent()}
          </div>
        ) : readOnly ? (
          <div className={clsx(styles.item)}>{memberInfoElement}</div>
        ) : (
          <div className={styles.buttonRow}>
            <Button onClick={handleClick} className={styles.item}>
              {memberInfoElement}
            </Button>
            {renderAbsolutelyPositionedContent()}
          </div>
        )}
      </PopOver>
    </div>
  );
};
