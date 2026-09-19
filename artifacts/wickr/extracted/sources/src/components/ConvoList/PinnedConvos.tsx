import React from 'react';
import { useAppTranslation } from '@/lib/i18n';
import { ConvoEntity } from '@/store/slices/convos';
import ConvoGroup from './ConvoGroup';

interface PinnedConvosProps {
  convos: ConvoEntity[];
  collapsed: boolean;
  onConvoClick: (vgroupId: string) => void;
  onToggleCollapse: () => void;
  lastUnreadPinnedRef?: (node?: Element | null) => void;
}

export const PinnedConvos: React.FC<PinnedConvosProps> = ({
  convos,
  collapsed,
  onConvoClick,
  onToggleCollapse,
  lastUnreadPinnedRef,
}) => {
  const { t } = useAppTranslation();

  return (
    <ConvoGroup
      title={t('ConvoList.Pinned')}
      convos={convos}
      collapsed={collapsed}
      onConvoClick={onConvoClick}
      onToggleCollapse={onToggleCollapse}
      collapsedTip={t('ConvoList.ShowPinned')}
      expandedTip={t('ConvoList.HidePinned')}
      lastUnreadItemRef={lastUnreadPinnedRef}
      showBadges
    />
  );
};
