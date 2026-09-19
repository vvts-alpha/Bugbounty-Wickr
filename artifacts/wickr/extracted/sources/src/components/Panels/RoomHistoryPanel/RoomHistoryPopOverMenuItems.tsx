import { PopOverItem } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { RoomHistoryFilterOption } from '@/store/slices/roomHistory';

interface RoomHistoryPopOverMenuItemsProps {
  onSelectFilter: (filterOption: RoomHistoryFilterOption) => void;
  selectedOption: RoomHistoryFilterOption;
}

const RoomHistoryPopOverMenuItems: React.FC<RoomHistoryPopOverMenuItemsProps> = ({
  onSelectFilter,
  selectedOption,
}) => {
  const { t } = useAppTranslation();

  return (
    <>
      <PopOverItem onClick={() => onSelectFilter('all')} checked={selectedOption === 'all'}>
        <>{t('All')}</>
      </PopOverItem>
      <PopOverItem onClick={() => onSelectFilter('members')} checked={selectedOption === 'members'}>
        <>{t('Members')}</>
      </PopOverItem>
      <PopOverItem
        onClick={() => onSelectFilter('settings')}
        checked={selectedOption === 'settings'}
      >
        <>{t('Settings')}</>
      </PopOverItem>
      <PopOverItem
        onClick={() => onSelectFilter('savedItems')}
        checked={selectedOption === 'savedItems'}
      >
        <>{t('Saved items')}</>
      </PopOverItem>
    </>
  );
};

export default RoomHistoryPopOverMenuItems;
