import { FC } from 'react';
import { Banner, Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppSelector, useAppDispatch } from '@/store';
import {
  selectActiveConvoOtherMembers,
  selectActiveConvoType,
  selectActiveConvoSelfMember,
  selectActiveConvoHasUnverifiedMembers,
  selectActiveConvoInactiveMembers,
} from '@/store/slices/convos';
import { pushPanel } from '@/store/slices/panels';
import { openAlertModal } from '@/store/thunks/modals';
import { notNowUnverifiedUser, verifyContact } from '@/store/thunks/ui';
import { getContactDisplayName } from '@/utils/strings';

import styles from './styles.module.less';

// TODO: Add unit tests
const SecurityStatusChangeWarning: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const selfMember = useAppSelector(selectActiveConvoSelfMember);
  const convoHasUnverifiedMembers = useAppSelector(selectActiveConvoHasUnverifiedMembers);
  const convoInactiveMembersCount = useAppSelector(selectActiveConvoInactiveMembers)?.length || 0;
  const convoHasInactiveMembers = convoInactiveMembersCount > 0;
  const convoType = useAppSelector(selectActiveConvoType);
  const isConvoTypeDM = convoType === WickrConvoType.DM;
  const otherMembers = useAppSelector(selectActiveConvoOtherMembers);

  if ((!convoHasUnverifiedMembers && !convoHasInactiveMembers) || !otherMembers?.length) {
    return null;
  }

  const handleManageOrView = () => {
    dispatch(pushPanel({ name: 'ManageUsersPanel' }));
  };

  const handleApprove = () => {
    dispatch(
      notNowUnverifiedUser({
        manuallyUnverified: false,
        userId: otherMembers[0].id,
      })
    );
    dispatch(
      openAlertModal({
        title: t('SecurityStatusChangeWarning.Caution'),
        body: t('SecurityStatusChangeWarning.TrustThisContact'),
      })
    );
  };

  const handleVerify = () => {
    dispatch(verifyContact(otherMembers[0].idHash));
  };

  const getTitle = () => {
    let title = '';
    if (isConvoTypeDM) {
      if (convoHasInactiveMembers) {
        title = t('SecurityStatusChangeWarning.UserRemoved');
      }

      if (convoHasUnverifiedMembers) {
        title = t('SecurityStatusChangeWarning.Attention');
      }
    } else {
      if (convoHasInactiveMembers) {
        title = t('SecurityStatusChangeWarning.UserStatusChange');
      }

      if (convoHasUnverifiedMembers) {
        title = t('SecurityStatusChangeWarning.Attention');
      }
    }

    return title;
  };

  const getSubtitle = () => {
    let subtitle = '';

    if (isConvoTypeDM) {
      if (convoHasInactiveMembers) {
        subtitle = t('SecurityStatusChangeWarning.NoLongerInWickr', {
          contactName: getContactDisplayName(otherMembers[0]),
        });
      }

      if (convoHasUnverifiedMembers) {
        subtitle = t('SecurityStatusChangeWarning.SecurityStateDM', {
          contactName: getContactDisplayName(otherMembers[0]),
        });
      }
    } else {
      subtitle = `${t('SecurityStatusChangeWarning.SecurityState')} ${
        selfMember?.moderator
          ? t('SecurityStatusChangeWarning.ManageNow')
          : t('SecurityStatusChangeWarning.ContactModerator')
      }`;
    }

    return subtitle;
  };

  const getButtons = () => {
    let buttons = <></>;

    if (isConvoTypeDM) {
      if (convoHasUnverifiedMembers) {
        buttons = (
          <>
            <Button bordered onClick={handleApprove}>
              {t('SecurityStatusChangeWarning.Approve')}
            </Button>
            <Button bordered onClick={handleVerify}>
              {t('SecurityStatusChangeWarning.Verify')}
            </Button>
          </>
        );
      }
    } else {
      buttons = (
        <Button bordered onClick={handleManageOrView}>
          {selfMember?.moderator
            ? t('SecurityStatusChangeWarning.Manage')
            : t('SecurityStatusChangeWarning.View')}
        </Button>
      );
    }
    return buttons;
  };

  return (
    <Banner className={styles.securityStatusChangeWarning}>
      <div className={styles.bannerText}>
        <h4 className={styles.title}>{getTitle()}</h4>
        <div className={styles.subtitle}>{getSubtitle()}</div>
      </div>
      {getButtons()}
    </Banner>
  );
};

export default SecurityStatusChangeWarning;
