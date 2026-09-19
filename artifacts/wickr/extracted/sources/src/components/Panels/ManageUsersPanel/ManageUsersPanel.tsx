import { FC, useEffect, useState } from 'react';
import { ManageUserItem } from '@/apis/webChannel/BridgeWebChannel';
import { Button, Heading, List, Panel, PanelBody, PanelHeader } from '@/componentlibrary';
import { SpinnerIcon } from '@/componentlibrary/icons';
import { Avatar } from '@/components/Avatar';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import {
  selectActiveConvoType,
  selectActiveConvoShowModeratorActions,
  selectActiveConvoMembers,
} from '@/store/slices/convos';
import {
  clearPanelStack,
  ManageUsersPanelArgs,
  PANEL_SIDES,
  popPanel,
  selectIsActivePanel,
} from '@/store/slices/panels';

import { selectWickrAppName } from '@/store/slices/settings';
import { openAlertModal, openModal } from '@/store/thunks/modals';
import { notNowUnverifiedUser, verifyContact, viewContactDetails } from '@/store/thunks/ui';
import { getUsersToManage, userActionRemove } from '@/store/thunks/users';

import styles from './styles.module.less';

const logger = new Logger('ManageUsersPanel');

export const ManageUsersPanel: FC<ManageUsersPanelArgs> = ({ name, closeIcon }) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const abortableDispatch = useAbortableDispatch();
  const isActive = useAppSelectorExtra(selectIsActivePanel, name);
  const handleOutsideClick = () => isActive && dispatch(clearPanelStack());
  const activeConvoType = useAppSelector(selectActiveConvoType);
  const convoMembers = useAppSelector(selectActiveConvoMembers);
  // Rely on Moderator instead of RBAC because MLS conversations don't have the concept of verification
  const showModeratorActions = useAppSelector(selectActiveConvoShowModeratorActions);
  const appShortName = useAppSelector(selectWickrAppName);
  const [inactiveUsers, setInactiveUsers] = useState<ManageUserItem[]>([]);
  const [unverifiedUsers, setUnverifiedUsers] = useState<ManageUserItem[]>([]);
  const [messengerUsers, setMessengerUsers] = useState<ManageUserItem[]>([]);
  const [processingUserIds, setProcessingUserIds] = useState<Set<string>>(new Set());
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    setDisabled(!!processingUserIds.size);
  }, [processingUserIds]);

  const fetchUsers = async () => {
    const fetchedUsers = await dispatch(getUsersToManage()).unwrap();
    const inactive = fetchedUsers.users.filter((user) => user.status === 'inactive');
    const unverified = fetchedUsers.users.filter((user) => user.status === 'unverified');
    const messenger = fetchedUsers.users.filter((user) => user.status === 'messenger');

    setInactiveUsers(inactive);
    setUnverifiedUsers(unverified);
    setMessengerUsers(messenger);

    // Remove users no longer in any list
    setProcessingUserIds((prev) => {
      const allUserIds = new Set([
        ...inactive.map((u) => u.userId),
        ...unverified.map((u) => u.userId),
        ...messenger.map((u) => u.userId),
      ]);
      const newSet = new Set<string>();
      prev.forEach((id) => {
        if (allUserIds.has(id)) {
          newSet.add(id);
        }
      });
      return newSet;
    });
  };

  useEffect(() => {
    fetchUsers();
  }, [convoMembers]);

  const handleApprove = (id: string) => {
    setProcessingUserIds((prev) => new Set(prev).add(id));
    dispatch(
      notNowUnverifiedUser({
        manuallyUnverified: false,
        userId: id,
      })
    );
    dispatch(
      openAlertModal({
        title: t('SecurityStatusChangeWarning.Caution'),
        body: t('SecurityStatusChangeWarning.TrustThisContact'),
      })
    );
  };

  const handleVerify = (idHash: string) => {
    const id = unverifiedUsers.filter((u) => u.userHash === idHash)[0].userId;
    setProcessingUserIds((prev) => new Set(prev).add(id));
    dispatch(verifyContact(idHash));
  };

  const handleRemove = async (user: ManageUserItem) => {
    try {
      if (!showModeratorActions) {
        logger.warn('Attempted to remove a user from the convo without moderator status.');
        return;
      }
      const confirmed = await abortableDispatch(
        openModal({
          name: 'ConfirmModal',
          params: {
            title: t('Remove User'),
            body: t(
              'Removing a user will remove their membership from all rooms. Do you want to proceed?'
            ),
            confirmText: t('Remove'),
          },
        })
      );

      if (confirmed) {
        setProcessingUserIds((prev) => new Set(prev).add(user.userId));
        dispatch(userActionRemove(user));
      }
    } catch {
      // no-op
    }
  };

  return (
    <Panel
      onClose={() => dispatch(popPanel())}
      onOutsideClick={handleOutsideClick}
      side={PANEL_SIDES[name]}
      className={styles.panel}
      closeIcon={closeIcon}
    >
      <PanelHeader
        title={showModeratorActions ? t('Manage Users') : t('View Users')}
        closeLabel={t('Close')}
      >
        <Heading level={3} as="h3" className={styles.header}>
          {(inactiveUsers.length + unverifiedUsers.length + messengerUsers.length === 1
            ? t("The user's status below has changed.")
            : t("The users' statuses below have changed.")) +
            (showModeratorActions ? ' ' + t('Please take appropriate action.') : '')}
        </Heading>
      </PanelHeader>
      <PanelBody>
        {inactiveUsers.length > 0 && (
          <div>
            <div className={styles.section}>
              <p className={styles.title}>{t('Removed Users')}</p>
              <p className={styles.description}>
                {t('These users were removed from {{appShortName}}.', { appShortName }) +
                  (showModeratorActions
                    ? ''
                    : ' ' + t('Please contact your moderator to take action.'))}
              </p>
            </div>
            <List className={styles.removedUsersList}>
              {inactiveUsers.map((user) => (
                <div key={user.userId} className={styles.row}>
                  <Avatar
                    userIdHash={user.userHash}
                    name={user.getDisplayName}
                    onClick={() => dispatch(viewContactDetails({ userIdHash: user.userHash }))}
                  />
                  <div className={styles.userInfo}>
                    <span className={styles.name}>{user.getDisplayName}</span>
                    <span className={styles.id}>{user.userId}</span>
                  </div>
                  {showModeratorActions && activeConvoType === WickrConvoType.Room && (
                    <div className={styles.rightContent}>
                      {processingUserIds.has(user.userId) ? (
                        <SpinnerIcon className={styles.spinner} />
                      ) : (
                        <Button
                          color="red"
                          key={user.userId}
                          onClick={() => handleRemove(user)}
                          aria-disabled={disabled}
                        >
                          {t('Remove')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </List>
          </div>
        )}
        {unverifiedUsers.length > 0 && (
          <div>
            <div className={styles.section}>
              <p className={styles.title}>{t('Unverified Users')}</p>
              <p className={styles.description}>
                {showModeratorActions
                  ? t(
                      'The following users are currently not able to chat due to their security code changing. Please verify them now.'
                    )
                  : t(
                      'The following users are currently not able to chat due to their security code changing. Please contact your moderator to verify them now.'
                    )}
              </p>
            </div>
            <List>
              {unverifiedUsers.map((user) => (
                <div key={user.userId} className={styles.row}>
                  <Avatar
                    userIdHash={user.userHash}
                    name={user.getDisplayName}
                    onClick={() => dispatch(viewContactDetails({ userIdHash: user.userHash }))}
                  />
                  <div className={styles.userInfo}>
                    <span className={styles.name}>{user.getDisplayName}</span>
                    <span className={styles.id}>{user.userId}</span>
                  </div>
                  {showModeratorActions && (
                    <div className={styles.rightContent}>
                      {processingUserIds.has(user.userId) ? (
                        <SpinnerIcon className={styles.spinner} />
                      ) : (
                        <>
                          <Button color="primary" onClick={() => handleVerify(user.userHash)}>
                            {t('Verify')}
                          </Button>
                          <Button
                            color="secondary"
                            onClick={() => handleApprove(user.userId)}
                            aria-disabled={disabled}
                          >
                            {t('Approve')}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </List>
          </div>
        )}
        {messengerUsers.length > 0 && (
          <div>
            <div className={styles.section}>
              <p className={styles.title}>{t('Unavailable Users')}</p>
              <p className={styles.description}>
                {t('Wickr Me has been discontinued and this account is no longer available.') +
                  (showModeratorActions
                    ? ''
                    : ' ' + t('Please contact your moderator to take action.'))}
              </p>
            </div>
            <List>
              {messengerUsers.map((user) => (
                <div key={user.userId} className={styles.row}>
                  <Avatar
                    userIdHash={user.userHash}
                    name={user.getDisplayName}
                    onClick={() => dispatch(viewContactDetails({ userIdHash: user.userHash }))}
                  />
                  <div className={styles.userInfo}>
                    <span className={styles.name}>{user.getDisplayName}</span>
                    <span className={styles.id}>{user.userId}</span>
                  </div>
                  {showModeratorActions && activeConvoType === WickrConvoType.Room && (
                    <div className={styles.rightContent}>
                      {processingUserIds.has(user.userId) ? (
                        <SpinnerIcon className={styles.spinner} />
                      ) : (
                        <Button
                          color="red"
                          key={user.userId}
                          onClick={() => handleRemove(user)}
                          aria-disabled={disabled}
                        >
                          {t('Remove')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </List>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
};

export default ManageUsersPanel;
