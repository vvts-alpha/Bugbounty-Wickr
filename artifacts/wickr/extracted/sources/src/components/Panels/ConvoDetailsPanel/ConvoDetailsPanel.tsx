import { clsx } from 'clsx';
import { FC, useMemo } from 'react';
import { ConvoExpandableMembersList } from '../EditConvoPanel/ConvoExpandableMembersList';
import {
  AddIcon,
  CaretIcon,
  ClockIcon,
  Button,
  FolderIcon,
  GridGlobeIcon,
  Heading,
  IconButton,
  List,
  Panel,
  PanelBody,
  PanelHeader,
  LinkIcon,
  CopyIcon,
  MailIcon,
} from '@/componentlibrary';
import MlsMigrationPanelButton from '@/components/MlsMigrationPanelButton';
import NotificationsPanelButton from '@/components/NotificationsPanelButton';
import Tag from '@/components/TdfTags/Tag';
import { UserRow } from '@/components/UserRow';
import useConvoExpirationTimes from '@/hooks/useConvoExpirationTimes';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSetting } from '@/store/hooks/useSetting';
import {
  selectActiveConvoBotMembers,
  selectActiveConvoDescription,
  selectActiveConvoExternalMembers,
  selectActiveConvoMembers,
  selectActiveConvoTitle,
  selectActiveConvoType,
  selectActiveConvoCanDeleteConvo,
  selectActiveConvoCanModifyEphemerality,
  selectActiveConvoCanModifyTitleDescription,
  selectActiveConvoCanModifyUserRole,
  selectActiveConvoCanLeaveConvo,
  selectActiveConvoCanRemoveUser,
  selectActiveConvoCanAddUser,
  selectActiveConvoModeratorIds,
  selectActiveConvoIsMLS,
  selectActiveConvoHasUnauthorizedMembers,
  selectActiveConvoShortenedTdfTags,
} from '@/store/slices/convos';
import { selectSelfUserEmail, selectSelfUserIsGuest } from '@/store/slices/identity';
import { selectActiveModal, pushModal } from '@/store/slices/modal';
import {
  clearPanelStack,
  ConvoDetailsPanelArgs,
  PANEL_SIDES,
  popPanel,
  pushPanel,
  selectIsActivePanel,
} from '@/store/slices/panels';
import { selectActiveConvoId } from '@/store/slices/shared';
import {
  copyConvoMemberEmailsToClipboard,
  copyConvoMemberNamesToClipboard,
} from '@/store/thunks/convos';
import { formatRelativeTime } from '@/utils/date';
import { contactSort } from '@/utils/sort';
import { copyTextToClipboard, raw } from '@/utils/strings';

import styles from './styles.module.less';
import panelButtonStyles from '../buttonStyles.module.less';

const MAX_MEMBERS_TO_SHOW = 10;

export const ConvoDetailsPanel: FC<ConvoDetailsPanelArgs> = ({ name, closeIcon }) => {
  const { t } = useAppTranslation();
  const side = PANEL_SIDES[name];
  const dispatch = useAppDispatch();
  const panelIsActive = useAppSelectorExtra(selectIsActivePanel, name);
  const activeModal = useAppSelector(selectActiveModal);
  const isFileManagementEnabled = useFeature('FileManagement');
  const handleOutsideClick = () => panelIsActive && !activeModal && dispatch(clearPanelStack());
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const activeConvoType = useAppSelector(selectActiveConvoType);
  const activeConvoTitle = useAppSelector(selectActiveConvoTitle);
  const activeConvoDescription = useAppSelector(selectActiveConvoDescription);
  const activeConvoContainsExternal = !!useAppSelector(selectActiveConvoExternalMembers).length;
  const { displayedBOR, displayedTTL } = useConvoExpirationTimes(activeConvoId);
  const formattedTTL = formatRelativeTime(displayedTTL);
  const formattedBOR = formatRelativeTime(displayedBOR);
  const activeConvoMembersNonBots = useAppSelector(selectActiveConvoMembers).filter(
    (m) => !m.isBot
  );
  const isGuest = useAppSelector(selectSelfUserIsGuest);
  const notificationsEnabled = useSetting('enableNotifications');
  const onlyShow1To1Notifications = useSetting('onlyShow1To1Notifications');
  const shouldShowNotificationsButton = !onlyShow1To1Notifications && notificationsEnabled;
  const canDeleteConvo = useAppSelector(selectActiveConvoCanDeleteConvo);
  const activeConvoBots = useAppSelector(selectActiveConvoBotMembers);
  const canModifyEphemerality = useAppSelector(selectActiveConvoCanModifyEphemerality);
  const canModifyTitleDescription = useAppSelector(selectActiveConvoCanModifyTitleDescription);
  const canModifyUserRole = useAppSelector(selectActiveConvoCanModifyUserRole);
  const canAddUser = useAppSelector(selectActiveConvoCanAddUser);
  const canRemoveUser = useAppSelector(selectActiveConvoCanRemoveUser);
  const canLeaveConvo = useAppSelector(selectActiveConvoCanLeaveConvo);
  const moderatorIds = useAppSelector(selectActiveConvoModeratorIds);
  const selfUserId = useAppSelector(selectSelfUserEmail);
  const selfUserIsTheOnlyMod = moderatorIds.length === 1 && moderatorIds.includes(selfUserId);
  const isProd = useSetting('isProduction');
  const mlsMigrationEnabled = useSetting('mlsMigrationEnabled');
  const isMLS = useAppSelector(selectActiveConvoIsMLS);
  const shouldShowMlsMigrationButton =
    mlsMigrationEnabled && !isProd && ((isMLS && canDeleteConvo) || !isMLS);
  const canCopyMembers = useFeature('CopyRoomMembers') && !isGuest;
  const tdfEnabled = useSetting('tdfEnabled');
  const shortenedTdfTags = useAppSelector(selectActiveConvoShortenedTdfTags);
  const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);
  const developerModeEnabled = useSetting('developerModeEnabled');

  const activeConvoMembersListItems = useMemo(
    () =>
      activeConvoMembersNonBots
        .sort(contactSort)
        .slice(0, MAX_MEMBERS_TO_SHOW)
        .map((member) => (
          <UserRow
            key={member.id}
            member={member}
            vGroupId={activeConvoId}
            showContextMenuItems={true}
          />
        )),
    [activeConvoMembersNonBots, activeConvoId]
  );

  if (!activeConvoId) {
    return null;
  }

  const viewAllLabel = t('View All {{count}} Members', {
    count: activeConvoMembersNonBots.length,
  });

  const showEditButton =
    !hasUnauthorizedMembers &&
    (canModifyEphemerality || canModifyTitleDescription || canModifyUserRole);
  const editMembersLabel =
    canRemoveUser && canAddUser
      ? t('Add or Remove Members')
      : canAddUser
      ? t('Add Members')
      : t('Remove Members');

  return (
    <Panel
      onClose={() => dispatch(popPanel())}
      onOutsideClick={handleOutsideClick}
      side={side}
      closeIcon={closeIcon}
    >
      <PanelHeader
        title={t(activeConvoType === WickrConvoType.Room ? 'Room Details' : 'Group Details')}
        closeLabel={t('Close')}
        trailingElement={
          showEditButton && (
            <Button
              className={styles.editButton}
              onClick={() =>
                dispatch(
                  pushPanel({
                    name: 'EditConvoPanel',
                    convoId: activeConvoId,
                  })
                )
              }
            >
              {t('Edit')}
            </Button>
          )
        }
      />
      <PanelBody className={styles.body}>
        <div>
          <div className={styles.header}>
            <Heading level={3} className={styles.title}>
              {activeConvoTitle}
            </Heading>
            {!!activeConvoDescription && (
              <div className={styles.description}>{activeConvoDescription}</div>
            )}
            <div className={styles.expiration}>
              {t(`Expiration: {{time, number}}`, {
                time: formattedTTL.amount,
                formatParams: {
                  time: {
                    unit: formattedTTL.unit,
                    style: 'unit',
                    unitDisplay: 'long',
                  },
                },
              })}
            </div>
            {tdfEnabled && (
              <div className={styles.tags}>
                {shortenedTdfTags.map((tag) => (
                  <Tag key={tag} name={tag} />
                ))}
              </div>
            )}
            {!!formattedBOR.amount && (
              <div className={styles.expiration}>
                {t(`Burn-On-Read: {{time, number}}`, {
                  time: formattedBOR.amount,
                  formatParams: {
                    time: {
                      unit: formattedBOR.unit,
                      style: 'unit',
                      unitDisplay: 'long',
                    },
                  },
                })}
              </div>
            )}
          </div>
          <Button
            className={clsx(panelButtonStyles.fullWidthButton, panelButtonStyles.spaceBetween)}
            onClick={() =>
              dispatch(
                pushPanel({
                  name: 'RoomHistoryPanel',
                  convoId: activeConvoId,
                  highlightedMsgId: undefined,
                })
              )
            }
          >
            <div className={panelButtonStyles.rowWithGap}>
              <ClockIcon size="20px" />
              <span className={panelButtonStyles.buttonLabel}>
                {t(activeConvoType === WickrConvoType.Group ? 'Group History' : 'Room History')}
              </span>
            </div>
            <CaretIcon direction="right" />
          </Button>
          <Button
            className={clsx(panelButtonStyles.fullWidthButton, panelButtonStyles.spaceBetween)}
            onClick={() => dispatch(pushPanel({ name: 'SavedLinksPanel' }))}
          >
            <div className={panelButtonStyles.rowWithGap}>
              {isFileManagementEnabled ? <LinkIcon size="20px" /> : <FolderIcon size="20px" />}
              <span className={panelButtonStyles.buttonLabel}>
                {t(
                  isFileManagementEnabled ? 'Conversations.ConvoHeader.SavedLinks' : 'Saved Items'
                )}
              </span>
            </div>
            <CaretIcon direction="right" />
          </Button>
          {shouldShowNotificationsButton && <NotificationsPanelButton />}
          {shouldShowMlsMigrationButton && <MlsMigrationPanelButton />}
        </div>
        <div className={styles.memberList}>
          <Heading className={styles.listHeading} level={2}>
            {t(activeConvoType === WickrConvoType.Room ? 'Room Members' : 'Group Members')}
            {!hasUnauthorizedMembers && (canAddUser || canRemoveUser) && (
              <IconButton
                label={editMembersLabel}
                onClick={() =>
                  dispatch(
                    pushModal({
                      name: 'ConvoMembersModal',
                      params: {
                        title: editMembersLabel,
                        multiselect: true,
                        vGroupId: activeConvoId,
                        submitButtonLabel: t('Save'),
                        allowRemove: canRemoveUser,
                        allowAdd: canAddUser,
                      },
                    })
                  )
                }
              >
                <AddIcon size="18px" />
              </IconButton>
            )}
          </Heading>
          {activeConvoContainsExternal && (
            <div className={styles.subtextWithIcon}>
              {!isGuest && (
                <>
                  <GridGlobeIcon className={styles.externalBadge} filled size="16px" />
                  <div className={styles.listSubtext}>
                    {t(
                      activeConvoType === WickrConvoType.Room
                        ? 'One or more members of this room may not be part of your network.'
                        : 'One or more members of this group may not be part of your network.'
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <List className={styles.items}>{activeConvoMembersListItems}</List>
          {activeConvoMembersNonBots.length > MAX_MEMBERS_TO_SHOW && (
            <Button
              className={clsx(panelButtonStyles.fullWidthButton, panelButtonStyles.spaceBetween)}
              onClick={() =>
                dispatch(pushPanel({ name: 'AllConvoMembersPanel', convoId: activeConvoId }))
              }
            >
              {viewAllLabel}
              <CaretIcon direction="right" />
            </Button>
          )}
          {canCopyMembers && (
            <Button
              className={clsx(panelButtonStyles.fullWidthButton, panelButtonStyles.spaceBetween)}
              onClick={() => dispatch(copyConvoMemberNamesToClipboard(activeConvoId))}
            >
              <div className={panelButtonStyles.rowWithGap}>
                <CopyIcon size={20} />
                {t('Copy member names')}
              </div>
            </Button>
          )}
          {canCopyMembers && (
            <Button
              className={clsx(panelButtonStyles.fullWidthButton, panelButtonStyles.spaceBetween)}
              onClick={() => dispatch(copyConvoMemberEmailsToClipboard(activeConvoId))}
            >
              <div className={panelButtonStyles.rowWithGap}>
                <MailIcon size={20} />
                {t('Copy member email addresses')}
              </div>
            </Button>
          )}
        </div>
        {activeConvoBots.length > 0 && (
          <ConvoExpandableMembersList
            label={t('Bots')}
            subtext={t(
              activeConvoType === WickrConvoType.Room
                ? 'Bots may be able to see your messages and record activity in this room.'
                : 'Bots may be able to see your messages and record activity in this group.'
            )}
            members={activeConvoBots}
            showAddButton={false}
            vGroupId={activeConvoId}
          />
        )}
        {developerModeEnabled && (
          <Button
            className={clsx(
              panelButtonStyles.fullWidthButton,
              panelButtonStyles.spaceBetween,
              styles.convoIdBtn
            )}
            onClick={() => copyTextToClipboard(activeConvoId)}
          >
            <div className={panelButtonStyles.rowWithGap}>
              <CopyIcon size="20" />
              {t('Copy conversation ID')} {raw(' (vgroupId)')}
            </div>
            <div className={styles.convoId}>{activeConvoId}</div>
          </Button>
        )}
        <div>
          {canDeleteConvo && (
            <Button
              color="secondaryRed"
              className={panelButtonStyles.fullWidthButton}
              onClick={() =>
                dispatch(
                  pushModal({
                    name: 'DeleteConvoModal',
                    params: { vGroupId: activeConvoId },
                  })
                )
              }
            >
              {t('Delete Room')}
            </Button>
          )}
          {canLeaveConvo && !selfUserIsTheOnlyMod && (
            <Button
              color="secondaryRed"
              className={panelButtonStyles.fullWidthButton}
              onClick={() =>
                dispatch(
                  pushModal({
                    name: 'LeaveConvoModal',
                    params: { vGroupId: activeConvoId },
                  })
                )
              }
            >
              {t(activeConvoType === WickrConvoType.Group ? 'Leave Group' : 'Leave Room')}
            </Button>
          )}
        </div>
      </PanelBody>
    </Panel>
  );
};
