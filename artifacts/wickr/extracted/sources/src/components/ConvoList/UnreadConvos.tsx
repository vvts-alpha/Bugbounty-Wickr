import { IconButton, MoreIcon, PopOver, PopOverItem } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { ConvoEntity } from '@/store/slices/convos';
import { clearAllUnreadConvos } from '@/store/thunks/convos';
import ConvoGroup from './ConvoGroup';

import styles from './styles.module.less';

interface UnreadConvosProps {
  convos: ConvoEntity[];
  lastUnreadItemRef: (node?: Element | null) => void;
  onConvoClick: (vgroupId: string) => void;
}

export const UnreadConvos: React.FC<UnreadConvosProps> = ({
  convos,
  lastUnreadItemRef,
  onConvoClick,
}) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();

  return (
    <ConvoGroup
      title={t('ConvoList.Unread')}
      lastUnreadItemRef={lastUnreadItemRef}
      titlePopOver={
        <PopOver
          popoverContent={
            <PopOverItem onClick={() => dispatch(clearAllUnreadConvos())}>
              {t('ConvoList.ClearAll')}
            </PopOverItem>
          }
          contentWrapperClassName={styles.titlePopoverBtn}
        >
          <IconButton label={t('MoreOptions')}>
            <MoreIcon />
          </IconButton>
        </PopOver>
      }
      convos={convos}
      collapsible={false}
      onConvoClick={onConvoClick}
      trailingEl={<div className={styles.unreadDivider} />}
    />
  );
};
