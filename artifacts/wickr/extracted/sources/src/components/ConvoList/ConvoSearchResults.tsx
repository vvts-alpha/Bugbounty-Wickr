import { List } from '@/componentlibrary';
import { VirtualList } from '@/componentlibrary/VirtualList/VirtualList';
import { useAppTranslation } from '@/lib/i18n';
import { ConvoEntity } from '@/store/slices/convos';
import { CONVO_LIST_ITEM_HEIGHT } from './ConvoGroup';
import ConvoListItem from './ConvoListItem';

import styles from './styles.module.less';

interface ConvoSearchResultsProps {
  convos?: ConvoEntity[];
  onConvoClick: (vgroupId: string) => void;
}

export const ConvoSearchResults: React.FC<ConvoSearchResultsProps> = ({ convos, onConvoClick }) => {
  const { t } = useAppTranslation();

  return (
    <List>
      {convos && convos.length ? (
        <VirtualList
          id="convo-list-search"
          items={convos}
          keySelector={(convo) => convo.vGroupID}
          initialItemHeight={CONVO_LIST_ITEM_HEIGHT}
          renderItem={(convo) => (
            <ConvoListItem key={convo.vGroupID} convo={convo} onConvoClick={onConvoClick} />
          )}
        />
      ) : (
        // VoiceOver cannot read <li> tags in the QT WebEngine
        <div className={styles.noResults}>{t('ConvoList.Header.Search.NoResultsFound')}</div>
      )}
    </List>
  );
};
