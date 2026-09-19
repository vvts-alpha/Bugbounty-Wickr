import { ContactBackup } from '@amzn/wickr-messaging-protocol-proto';
import { clsx } from 'clsx';
import { FC, useEffect } from 'react';
import { ConvoTimeSelector } from '../../ConvoSettingSelectors/ConvoTimeSelector';
import {
  IconButton,
  Panel,
  PanelBody,
  PanelHeader,
  StarIcon,
  MessageIcon,
  PresenceIcon,
  ExternalLink,
  GridGlobeIcon,
  MailIcon,
  CaretIcon,
  Button,
  VerifiedIcon,
  CopyIcon,
} from '@/componentlibrary';
import { Avatar } from '@/components/Avatar';
import MlsMigrationPanelButton from '@/components/MlsMigrationPanelButton';
import NotificationsPanelButton from '@/components/NotificationsPanelButton';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { useSetting } from '@/store/hooks/useSetting';
import { useUser } from '@/store/hooks/useUsers';
import {
  selectActiveConvoBor,
  selectActiveConvoCanDeleteConvo,
  selectActiveConvoIsDMWithContact,
  selectActiveConvoIsMLS,
  selectActiveConvoTtl,
} from '@/store/slices/convos';
import { selectSelfUser, selectSelfUserIsGuest } from '@/store/slices/identity';
import { selectActiveModal, pushModal } from '@/store/slices/modal';
import {
  clearPanelStack,
  ContactDetailsPanelArgs,
  PANEL_SIDES,
  popPanel,
  pushPanel,
  selectIsActivePanel,
} from '@/store/slices/panels';
import { selectActiveConvoId } from '@/store/slices/shared';
import { editConvo } from '@/store/thunks/convos';
import { fetchUserStatus } from '@/store/thunks/identity';
import { createDM } from '@/store/thunks/messages';
import { openModal } from '@/store/thunks/modals';
import { setUserAsFavorite } from '@/store/thunks/users';
import { getPresenceLabel, shouldShowPresenceIcon } from '@/utils/presence';
import { copyTextToClipboard, getContactDisplayName, isValidEmail, raw } from '@/utils/strings';
import { AmazonPhoneIcon } from './AmazonPhoneIcon';

import styles from './styles.module.less';
import panelButtonStyles from '../buttonStyles.module.less';
import buttonStyles from '@/componentlibrary/Button/Button.module.less';

export const ContactDetailsPanel: FC<ContactDetailsPanelArgs> = ({
  userIdHash,
  name,
  closeIcon,
}) => {
  const { t } = useAppTranslation();
  const side = PANEL_SIDES[name];
  const dispatch = useAppDispatch();
  const panelIsActive = useAppSelectorExtra(selectIsActivePanel, name);
  const contact = useUser(userIdHash);
  const timeIdle = contact?.timeIdle ?? -1;
  const selfUser = useAppSelector(selectSelfUser);
  const convoId = useAppSelector(selectActiveConvoId);
  const activeModal = useAppSelector(selectActiveModal);
  const handleOutsideClick = () => panelIsActive && !activeModal && dispatch(clearPanelStack());
  const activeConvoIsDMWithContact = useAppSelectorExtra(
    selectActiveConvoIsDMWithContact,
    userIdHash ?? ''
  );
  const abortableDispatch = useAbortableDispatch();
  const richProfileCardEnabled = useSetting('richProfileCardEnabled');
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const activeConvoBOR = useAppSelector(selectActiveConvoBor) ?? 0;
  const activeConvoTTL = useAppSelector(selectActiveConvoTtl) ?? 0;
  const hasValidEmail = isValidEmail(contact?.id);
  const expirationTimerButtonId = 'ContactDetailsPanel-ExpirationButton';
  const burnOnReadButtonId = 'ContactDetailsPanel-BorButton';
  const notificationsEnabled = useSetting('enableNotifications');
  const mlsMigrationEnabled = useSetting('mlsMigrationEnabled');
  const isMLS = useAppSelector(selectActiveConvoIsMLS);
  const isProd = useSetting('isProduction');
  const canDeleteConvo = useAppSelector(selectActiveConvoCanDeleteConvo);
  const shouldShowMLSMigrationButton =
    mlsMigrationEnabled &&
    activeConvoIsDMWithContact &&
    !isProd &&
    ((isMLS && canDeleteConvo) || !isMLS);
  const shouldShowNotificationsButton = notificationsEnabled && activeConvoIsDMWithContact;
  const selfUserIsGuest = useAppSelector(selectSelfUserIsGuest);
  const developerModeEnabled = useSetting('developerModeEnabled');

  // Refresh user status when panel is opened
  useEffect(() => {
    if (contact?.id) {
      dispatch(fetchUserStatus({ userIds: [contact?.id] }));
    }
  }, [contact?.id]);

  const handleOpenDMClick = () => {
    if (!contact) {
      return;
    }

    dispatch(
      createDM({
        message: ' ',
        userHash: contact?.idHash,
        userId: contact?.id,
      })
    );
    dispatch(clearPanelStack());
  };

  const handleDeleteDMClick = () => {
    if (!contact) {
      return;
    }

    dispatch(pushModal({ name: 'DeleteConvoModal', params: { vGroupId: convoId } }));
  };

  const handleReportClick = () => {
    if (!contact) {
      return;
    }

    dispatch(pushModal({ name: 'ReportUserModal', params: { userId: contact.id } }));
  };

  const handleFavoriteClick = () => {
    if (!contact) {
      return;
    }

    dispatch(
      setUserAsFavorite({
        userHash: contact.idHash,
        favorite: !contact.starred,
      })
    );
  };

  const handleBlockUserClick = () => {
    if (!userIdHash) {
      return;
    }

    dispatch(pushModal({ name: 'BlockUserModal', params: { userIdHash } }));
  };

  const handleEditUserClick = () => {
    if (!contact) {
      return;
    }

    dispatch(
      pushPanel({
        name: 'EditContactPanel',
        currentName: getContactDisplayName(contact),
        userIdHash: contact.idHash,
      })
    );
  };

  const handleSubmitTTL = (time: number) => {
    dispatch(
      editConvo({
        vgroupId: activeConvoId,
        destructionTime: time,
      })
    );
  };

  const handleSubmitBOR = (time: number) => {
    dispatch(
      editConvo({
        vgroupId: activeConvoId,
        burnOnRead: time,
      })
    );
  };

  return (
    <Panel
      onClose={() => dispatch(popPanel())}
      onOutsideClick={handleOutsideClick}
      side={side}
      closeIcon={closeIcon}
    >
      <PanelHeader
        title={t('Contact Details')}
        closeLabel={t('Close')}
        trailingElement={
          !contact?.selfUser && (
            <IconButton
              label={t(contact?.starred ? 'Remove favorite' : 'Favorite')}
              onClick={handleFavoriteClick}
            >
              <StarIcon size="1.5rem" filled={contact?.starred} />
            </IconButton>
          )
        }
      ></PanelHeader>
      <PanelBody className={styles.body}>
        <Avatar
          size={82}
          className={styles.avatar}
          userIdHash={contact?.idHash ?? ''}
          name={getContactDisplayName(contact)}
        />
        <div className={styles.info}>
          <h1 className={styles.name}>
            {getContactDisplayName(contact)} {contact?.isGuest ? t('(guest)') : ''}
            {contact?.verificationStatus === ContactBackup.Contact.VerificationStatus.VERIFIED && (
              <VerifiedIcon size="16" />
            )}
          </h1>
          <div>
            {contact?.id} {!isProd && <AmazonPhoneIcon email={contact?.id} />}
          </div>
          <div>{contact?.inNetwork ? selfUser?.networkName : contact?.networkName}</div>
          {shouldShowPresenceIcon(timeIdle) && (
            <span className={styles.detailRow}>
              <PresenceIcon timeIdle={timeIdle} /> <span>{getPresenceLabel(timeIdle, t)}</span>
            </span>
          )}
          {!contact?.inNetwork && !selfUserIsGuest && (
            <div className={styles.detailRow}>
              <GridGlobeIcon filled className={styles.external} /> {t('External member')}
            </div>
          )}
        </div>
        <div>
          {hasValidEmail && richProfileCardEnabled && (
            <ExternalLink
              href={`mailto:${contact?.id}`}
              className={clsx(
                panelButtonStyles.fullWidthButton,
                panelButtonStyles.rowWithGap,
                buttonStyles.baseBtn
              )}
            >
              <MailIcon size="20px" />
              <span className={styles.email}>{contact?.id}</span>
            </ExternalLink>
          )}
          {activeConvoIsDMWithContact && (
            <ConvoTimeSelector
              convoId={convoId}
              convoType="dmOrGroup"
              expirationType="ttl"
              onChange={handleSubmitTTL}
              value={activeConvoTTL}
              id={expirationTimerButtonId}
              onClickCustom={async () => {
                try {
                  const value = await abortableDispatch(
                    openModal({
                      name: 'CustomConvoTimerModal',
                      params: {
                        type: 'ttl',
                        vGroupId: activeConvoId,
                        initialValue: activeConvoTTL,
                        originElementId: expirationTimerButtonId,
                      },
                    })
                  );

                  if (typeof value === 'number') {
                    handleSubmitTTL(value);
                  }
                } catch {
                  // no-op
                }
              }}
            />
          )}
          {activeConvoIsDMWithContact && (
            <ConvoTimeSelector
              convoId={convoId}
              convoType="dmOrGroup"
              expirationType="bor"
              onChange={handleSubmitBOR}
              value={activeConvoBOR}
              id={burnOnReadButtonId}
              currentTTL={activeConvoTTL}
              onClickCustom={async () => {
                try {
                  const value = await abortableDispatch(
                    openModal({
                      name: 'CustomConvoTimerModal',
                      params: {
                        type: 'bor',
                        vGroupId: activeConvoId,
                        initialValue: activeConvoBOR,
                        originElementId: burnOnReadButtonId,
                        currentTTL: activeConvoTTL,
                      },
                    })
                  );

                  if (typeof value === 'number') {
                    handleSubmitBOR(value);
                  }
                } catch {
                  // no-op
                }
              }}
            />
          )}
          {!contact?.isBot && !!contact?.idHash && !contact?.selfUser && (
            <Button
              onClick={() =>
                dispatch(pushPanel({ name: 'VerifyContactPanel', userIdHash: contact?.idHash }))
              }
              className={clsx(panelButtonStyles.fullWidthButton, panelButtonStyles.spaceBetween)}
            >
              <div className={panelButtonStyles.rowWithGap}>
                <VerifiedIcon size="20px" />
                <span>{t('Security Verification')}</span>
              </div>
              <CaretIcon direction="right" />
            </Button>
          )}
          {shouldShowNotificationsButton && <NotificationsPanelButton />}
          {!activeConvoIsDMWithContact && !contact?.selfUser && (
            <Button
              onClick={handleOpenDMClick}
              className={clsx(panelButtonStyles.fullWidthButton, panelButtonStyles.spaceBetween)}
            >
              <div className={panelButtonStyles.rowWithGap}>
                <MessageIcon size="1.25rem" />
                <span>{t('Direct Message')}</span>
              </div>
              <CaretIcon direction="right" />
            </Button>
          )}
          {shouldShowMLSMigrationButton && <MlsMigrationPanelButton />}
        </div>
        {!contact?.selfUser && (
          <div>
            <Button className={panelButtonStyles.fullWidthButton} onClick={handleEditUserClick}>
              {t('Edit User')}
            </Button>
            <Button className={panelButtonStyles.fullWidthButton} onClick={handleReportClick}>
              {t('Report')}
            </Button>
            <Button
              color="secondaryRed"
              className={clsx(panelButtonStyles.fullWidthButton)}
              onClick={handleBlockUserClick}
            >
              {t(contact?.blocked ? 'Unblock User' : 'Block User')}
            </Button>
            {activeConvoIsDMWithContact && (
              <Button
                color="secondaryRed"
                className={panelButtonStyles.fullWidthButton}
                onClick={handleDeleteDMClick}
              >
                {t('Delete Conversation')}
              </Button>
            )}
            {activeConvoIsDMWithContact && developerModeEnabled && (
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
          </div>
        )}
      </PanelBody>
    </Panel>
  );
};
