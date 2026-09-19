import { clsx } from 'clsx';
import { IconButton, SortIcon } from '@/componentlibrary';
import { SortFilledPart } from '@/componentlibrary/icons/Sort';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveFilesSort, setFilesSort, SortCategory } from '@/store/slices/files';
import { selectActiveConvoId } from '@/store/slices/shared';

import styles from './SortButton.module.less';

interface SortButtonsProps {
  category: SortCategory;
}

const SortButtons: React.FC<SortButtonsProps> = ({ category }) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const currentSort = useAppSelector(selectActiveFilesSort);
  const activeConvoId = useAppSelector(selectActiveConvoId);

  const getFilledPart = (): SortFilledPart => {
    if (!currentSort || currentSort.category !== category) {
      return 'none';
    }

    return currentSort.direction === 'asc' ? 'top' : 'bottom';
  };

  const handleClick = () => {
    dispatch(
      setFilesSort({
        vgroupId: activeConvoId,
        sort: {
          category,
          // Defaults to descending when switching sort categories, otherwise flips it when category is the same
          direction:
            currentSort?.category !== category || currentSort?.direction !== 'desc'
              ? 'desc'
              : 'asc',
        },
      })
    );
  };

  return (
    <IconButton
      onClick={handleClick}
      label={t('Sort')}
      className={clsx({
        [styles.selected]: currentSort?.category === category,
      })}
    >
      <SortIcon filledPart={getFilledPart()} />
    </IconButton>
  );
};

export default SortButtons;
