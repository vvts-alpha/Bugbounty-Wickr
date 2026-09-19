import { clsx } from 'clsx';
import React, { forwardRef } from 'react';
import { ListItemButton } from '@/componentlibrary';
import { Emojify } from '@/components/Emojify';
import { IEmojiModel } from '@/utils/emoji/emojiSearch';

import styles from './EmojiList.module.less';
import suggestionStyles from '../SuggestionList/SuggestionList.module.less';

export interface MentionListItemProps {
  item: IEmojiModel;
  onClick: () => void;
  className?: string;
}

const EmojiListItem = forwardRef(
  ({ item, onClick, className }: MentionListItemProps, ref: React.Ref<HTMLSpanElement>) => {
    return (
      <ListItemButton onClick={onClick} className={clsx(className, suggestionStyles.item)}>
        <div className={styles.emoji}>
          <Emojify>{item.emoji}</Emojify>
        </div>
        <span ref={ref} className={suggestionStyles.label}>
          {item.shortcode}
        </span>
      </ListItemButton>
    );
  }
);

export default EmojiListItem;
