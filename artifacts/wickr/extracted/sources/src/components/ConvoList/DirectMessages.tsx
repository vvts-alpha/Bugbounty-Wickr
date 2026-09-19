import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectIsAdmin, selectNetworkInvitesAllowed } from '@/store/slices/account';
import { ConvoEntity } from '@/store/slices/convos';
import { selectSelfUserIsGuest } from '@/store/slices/identity';
import { pushModal } from '@/store/slices/modal';
import ConvoGroup from './ConvoGroup';
import { TrailingAddButton } from './TrailingAddButton';
import { DMS_VLIST_ID } from './constants';

import styles from './styles.module.less';

interface DirectMessagesProps {
  convos: ConvoEntity[];
  collapsed: boolean;
  onConvoClick: (vgroupId: string) => void;
  onToggleCollapse: () => void;
}

export const DirectMessages: React.FC<DirectMessagesProps> = ({
  convos,
  collapsed,
  onConvoClick,
  onToggleCollapse,
}) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const isAdmin = useAppSelector(selectIsAdmin);
  const invitesAllowed = useAppSelector(selectNetworkInvitesAllowed);
  const isEnterprise = useSetting('isEnterprise');
  const isGovCloudAdc = useSetting('isGovCloudAdcEnabled');

  // Use strict "self user isGuest" check so we don't show guest fallback while loading
  const isGuest = useAppSelector(selectSelfUserIsGuest);

  return (
    <ConvoGroup
      vlistId={DMS_VLIST_ID}
      title={t('ConvoList.DirectMessages')}
      collapsible={convos.length > 0}
      convos={convos}
      collapsed={collapsed}
      onConvoClick={onConvoClick}
      onToggleCollapse={onToggleCollapse}
      collapsedTip={t('ConvoList.ShowDirectMessages')}
      expandedTip={t('ConvoList.HideDirectMessages')}
      emptyListEl={
        isGuest ? (
          <div className={styles.guestEmptyMessage}>
            <p>{t("You don't have any direct messages yet")}</p>
            <p>{t('When you do, they will show up here.')}</p>
          </div>
        ) : undefined
      }
      trailingEl={
        !isEnterprise && !isGuest && isAdmin && invitesAllowed && !isGovCloudAdc ? (
          <TrailingAddButton
            text={t('Invite to Team')}
            onClick={() => dispatch(pushModal('ReferAFriendModal'))}
          />
        ) : undefined
      }
    />
  );
};
