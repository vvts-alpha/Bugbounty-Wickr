import { Fragment, useEffect, useMemo } from 'react';
import { List, PanelOverlay, PrimaryButton } from '@/componentlibrary';
import { Avatar } from '@/components/Avatar';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { setOverlay } from '@/store/slices/overlay';
import { selectBlockedUsers } from '@/store/slices/users';
import { fetchBlockedUsers, setUserIsBlocked } from '@/store/thunks/users';
import { contactSort } from '@/utils/sort';
import { getContactDisplayName } from '@/utils/strings';

import styles from './styles.module.less';

const BlockedUsersOverlay = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const blockedUsers = useAppSelector(selectBlockedUsers);
  const letterHeaders: string[] = [];
  const sortedUsers = useMemo(() => blockedUsers.sort(contactSort), [blockedUsers]);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  return (
    <PanelOverlay
      onClose={() => dispatch(setOverlay('PrivacyAndSafety'))}
      closeLabel={t('Back')}
      title={t('Blocked Users')}
    >
      {blockedUsers.length > 0 ? (
        <List>
          {sortedUsers.map((user) => {
            let shouldAddHeader = false;
            const displayName = getContactDisplayName(user);
            const firstLetter = displayName[0].toUpperCase();
            if (letterHeaders.indexOf(firstLetter) === -1) {
              letterHeaders.push(firstLetter);
              shouldAddHeader = true;
            }

            // VoiceOver cannot read <li> tags in the QT WebEngine
            return (
              <Fragment key={user.idHash}>
                {shouldAddHeader && <div className={styles.letterHeader}>{firstLetter}</div>}
                <div className={styles.row}>
                  <div className={styles.avatarAndText}>
                    <Avatar userIdHash={user.idHash} />
                    <div className={styles.userInfo}>
                      <p>{displayName}</p>
                      <p className={styles.email}>{user.id}</p>
                    </div>
                  </div>
                  <PrimaryButton
                    onClick={() =>
                      dispatch(
                        setUserIsBlocked({
                          block: !user.blocked,
                          userHash: user.idHash,
                        })
                      )
                    }
                    className={styles.unblock}
                    label={t('Unblock')}
                  >
                    {t('Unblock')}
                  </PrimaryButton>
                </div>
              </Fragment>
            );
          })}
        </List>
      ) : (
        <p className={styles.empty}>{t('You have no blocked users')}</p>
      )}
    </PanelOverlay>
  );
};

export default BlockedUsersOverlay;
