import { Button } from '@/componentlibrary';
import { LockInCircleIcon } from '@/componentlibrary/icons/LockInCircle';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectActiveConvoModerators,
  selectActiveConvoSelfMember,
} from '@/store/slices/convos/convosSelectors';
import { pushModal } from '@/store/slices/modal';
import { selectActiveConvoId } from '@/store/slices/shared';

import styles from './styles.module.less';

// This component display like a modal except it is not a real stateful modal
// It does not live in our modal stack and does not use the modal component
// which covers the whole window. This is a convo-only decoration.
const UnauthorizedConvoMemberOverlay = () => {
  const dispatch = useAppDispatch();
  const vGroupId = useAppSelector(selectActiveConvoId);
  const moderators = useAppSelector(selectActiveConvoModerators);
  const selfMember = useAppSelector(selectActiveConvoSelfMember);
  const { t } = useAppTranslation();

  const isSelfLastModerator = selfMember?.moderator && moderators.length === 1;

  const handleButtonClick = () => {
    if (isSelfLastModerator) {
      dispatch(pushModal({ name: 'DeleteConvoModal', params: { vGroupId } }));
    } else {
      dispatch(pushModal({ name: 'LeaveConvoModal', params: { vGroupId } }));
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3>{t('You are not able to access this room')}</h3>
        <LockInCircleIcon size="120px" className={styles.icon} />
        <p>{t('You do not have the correct entitlements to access this room')}</p>
        <Button
          color="red"
          onClick={handleButtonClick}
          wrapperClassName={styles.btnWrapper}
          className={styles.btn}
        >
          {isSelfLastModerator ? t('Delete room') : t('Leave room')}
        </Button>
      </div>
    </div>
  );
};

export default UnauthorizedConvoMemberOverlay;
