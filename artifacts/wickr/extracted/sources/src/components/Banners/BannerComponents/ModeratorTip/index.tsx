import { FC, useEffect } from 'react';
import { EditConvoPayload } from '@/apis/webChannel/BridgeWebChannel';
import { LightBulbIcon, Button, Banner } from '@/componentlibrary';
import { ConvoMembersModalReturnValue } from '@/components/Modals/ConvoMembersModal';
import { useAppTranslation } from '@/lib/i18n';
import { useAppSelector, useAppDispatch } from '@/store';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { selectActiveConvoMembers, selectActiveConvoModeratorIds } from '@/store/slices/convos';
import { selectSelfUser, selectSelfUserIdHash } from '@/store/slices/identity';
import { selectActiveConvoId } from '@/store/slices/shared';
import { selectShouldShowModeratorTip } from '@/store/slices/uiChat';
import { editConvo } from '@/store/thunks/convos';
import { openModal } from '@/store/thunks/modals';
import { dismissModeratorTip } from '@/store/thunks/ui';

import styles from './styles.module.less';

const ModeratorTip: FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const convoMembers = useAppSelector(selectActiveConvoMembers);
  const moderatorIds = useAppSelector(selectActiveConvoModeratorIds);
  const selfUserId = useAppSelector(selectSelfUser)?.id || '';
  const modCount = moderatorIds.length;
  const memberCount = convoMembers.length;
  const shouldShowModeratorTip = useAppSelector((state) =>
    selectShouldShowModeratorTip(state, activeConvoId)
  );
  const abortableDispatch = useAbortableDispatch();
  const selfIdHash = useAppSelector(selectSelfUserIdHash);

  const renderTip =
    moderatorIds.includes(selfUserId) &&
    modCount === 1 &&
    memberCount >= 2 &&
    shouldShowModeratorTip;

  useEffect(() => {
    return () => {
      dispatch(dismissModeratorTip(activeConvoId));
    };
  }, [activeConvoId]);

  const handleIgnoreClick = () => {
    dispatch(dismissModeratorTip(activeConvoId));
  };

  const handleAddModeratorsClick = async () => {
    const convoMembersModelResult = (await abortableDispatch(
      openModal({
        name: 'ConvoMembersModal',
        params: {
          title: t('ModertorTip.AddModerators'),
          multiselect: true,
          submitButtonLabel: t('Add'),
          vGroupId: activeConvoId,
          isModeratorList: true,
        },
      })
    )) as ConvoMembersModalReturnValue | undefined;
    if (!convoMembersModelResult) return;
    if (!Array.isArray(convoMembersModelResult.members)) return;
    const membersArr: string[] = convoMembersModelResult.members;
    const membersWithoutSelf = membersArr.filter((m) => m !== selfIdHash);
    const payload: EditConvoPayload = { vgroupId: activeConvoId };
    payload.addedModerators = membersWithoutSelf;
    dispatch(editConvo(payload));
  };

  if (!renderTip) return null;

  return (
    <Banner className={styles.modTip} data-testid="add-mods-banner">
      <div className={styles.tipText}>
        <LightBulbIcon />
        <span>{t('Rooms with multiple moderators are easier to manage.')}</span>
      </div>
      <div className={styles.buttons}>
        <Button
          color="secondary"
          bordered
          onClick={handleAddModeratorsClick}
          className={styles.addModButton}
        >
          {t('ModertorTip.AddModerators')}
        </Button>
        <Button onClick={handleIgnoreClick}>{t('ModertorTip.Ignore')}</Button>
      </div>
    </Banner>
  );
};

export default ModeratorTip;
