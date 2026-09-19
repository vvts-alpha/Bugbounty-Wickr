import clsx from 'clsx';
import { useState } from 'react';
import { Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { ConvoEntity } from '@/store/slices/convos';
import { selectSelfUser } from '@/store/slices/identity';
import { pushModal } from '@/store/slices/modal';
import ConvoGroup from './ConvoGroup';
import { TrailingAddButton } from './TrailingAddButton';
import { ROOMS_VLIST_ID, SHOW_LESS_ROOM_COUNT } from './constants';

import styles from './styles.module.less';

interface RoomsProps {
  convos: ConvoEntity[];
  alwaysHiddenConvos: Set<string>;
  showAll: boolean;
  onConvoClick: (vgroupId: string) => void;
  onShowAllClick: (showAll: boolean) => void;
}

export const Rooms: React.FC<RoomsProps> = ({
  convos,
  alwaysHiddenConvos,
  showAll,
  onConvoClick,
  onShowAllClick,
}) => {
  const { t } = useAppTranslation();
  const selfUser = useAppSelector(selectSelfUser);
  const [collapsed, setCollapsed] = useState(false);
  const shouldRenderShowMoreorShowLess = !collapsed && convos.length > SHOW_LESS_ROOM_COUNT;
  const dispatch = useAppDispatch();

  // Treat undefined user as guest so that the Add Room button isn't shown until we know for sure
  const isGuest = !selfUser || selfUser?.isGuest;

  return (
    <ConvoGroup
      vlistId={ROOMS_VLIST_ID}
      title={t('ConvoList.Rooms')}
      collapsible={convos.length > 0}
      convos={convos}
      collapsed={collapsed}
      onConvoClick={onConvoClick}
      onToggleCollapse={() => {
        if (collapsed) {
          onShowAllClick(false);
        }
        setCollapsed(!collapsed);
      }}
      collapsedTip={t('ConvoList.ShowRooms')}
      expandedTip={t('ConvoList.HideRooms')}
      alwaysHiddenConvos={alwaysHiddenConvos}
      trailingEl={
        convos.length === 0 && !isGuest ? (
          <TrailingAddButton
            text={t('Create a Room')}
            onClick={() => dispatch(pushModal('NewRoomModal'))}
          />
        ) : shouldRenderShowMoreorShowLess ? (
          <Button
            onClick={() => onShowAllClick(!showAll)}
            className={clsx(styles.showMoreOrLessButton, styles.trailingBtn)}
          >
            {showAll ? t('Show less') : t('Show more')}
          </Button>
        ) : undefined
      }
    />
  );
};
