import { useAppTranslation } from '@/lib/i18n';
import { ConvoEntity } from '@/store/slices/convos';
import ConvoGroup from './ConvoGroup';

interface BotsProps {
  convos: ConvoEntity[];
  collapsed: boolean;
  onConvoClick: (vgroupId: string) => void;
  onToggleCollapse: () => void;
}

export const Bots: React.FC<BotsProps> = ({
  convos,
  collapsed,
  onConvoClick,
  onToggleCollapse,
}) => {
  const { t } = useAppTranslation();

  return (
    <ConvoGroup
      title={t('ConvoList.Bots')}
      convos={convos}
      collapsed={collapsed}
      onConvoClick={onConvoClick}
      onToggleCollapse={onToggleCollapse}
      collapsedTip={t('ConvoList.ShowBots')}
      expandedTip={t('ConvoList.HideBots')}
    />
  );
};
