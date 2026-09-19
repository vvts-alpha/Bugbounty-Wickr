import { useAppTranslation } from '@/lib/i18n';
import { ConvoEntity } from '@/store/slices/convos';
import ConvoGroup from './ConvoGroup';
import { COMBINED_VLIST_ID } from './constants';

interface CombinedConvosProps {
  convos: ConvoEntity[];
  onConvoClick: (vgroupId: string) => void;
}

export const CombinedConvos: React.FC<CombinedConvosProps> = ({ convos, onConvoClick }) => {
  const { t } = useAppTranslation();

  return (
    <ConvoGroup
      vlistId={COMBINED_VLIST_ID}
      title={t('ConvoList.RoomsAndDMs')}
      collapsible={false}
      convos={convos}
      onConvoClick={onConvoClick}
    />
  );
};
