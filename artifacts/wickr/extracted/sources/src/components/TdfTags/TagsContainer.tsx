import { useState, FC } from 'react';
import { logger } from '../CopyHandler';
import { getTdfTags } from '@/apis/webFetch';
import { Button, SpinnerIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import Tag from './Tag';

import styles from './styles.module.less';

export const mockResults = [
  'APPLES',
  'ORANGES',
  'BANANAS',
  'KIWIS',
  'PINEAPPLES',
  'PEARS',
  'BLUEBERRIES',
  'PAPAYAS',
  'DRAGONFRUIT',
  'GRAPES',
];

type Props = {
  description?: string;
  className?: string;
};
const TdfTagsContainer: FC<Props> = ({ description, className }) => {
  const { t } = useAppTranslation();
  const [tags, setTags] = useState<string[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handlePreviewTags = async () => {
    setTags(undefined);
    setError('');

    if (!description?.length) {
      return setError(t('No description entered'));
    }

    setLoading(true);

    try {
      const results = await getTdfTags(description);
      const { tdfTags, isSuccess } = results;
      if (!isSuccess) {
        return setError(t('Unable to get tags from service provider'));
      }
      setTags(tdfTags);
      if (tdfTags?.length === 0) {
        setError(t('No tags detected'));
      }
    } catch (error) {
      logger.error('Failed to get tags:', error);
      setError(t('Failed to get tags'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <div className={styles.previewBtnContainer}>
        <div>{loading && <SpinnerIcon />}</div>
        <Button onClick={handlePreviewTags} bordered compact>
          {t('Preview tags')}
        </Button>
      </div>
      {error && <p className={styles.tagsError}>{error}</p>}
      {tags && tags.length > 0 && (
        <div className={styles.tagsList}>
          {tags.map((tag) => (
            <Tag key={tag} name={tag} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TdfTagsContainer;
