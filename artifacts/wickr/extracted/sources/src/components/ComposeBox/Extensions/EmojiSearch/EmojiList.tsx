import { SuggestionProps } from '@tiptap/suggestion';
import { clsx } from 'clsx';
import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { scrollIntoView } from '@/utils/dom';
import { IEmojiModel } from '@/utils/emoji/emojiSearch';
import EmojiListItem from './EmojiListItem';

import styles from '../SuggestionList/SuggestionList.module.less';

interface EmojiListRef {
  onKeyDown: (props: Record<string, any>) => boolean;
}

export const EMOJI_SUGGESTION_CHAR = ':';

export default forwardRef<EmojiListRef, SuggestionProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedItemRef = useRef<HTMLSpanElement | null>();

  const selectItem = (item: IEmojiModel | undefined) => {
    if (item) {
      // Remove any spaces in ID since Wickr highlights mentions simply based on username matches without spaces
      props.command({ label: item.emoji, id: item.shortcode });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(props.items[selectedIndex]);
  };

  useEffect(() => scrollSelectedItemIntoView(), [selectedIndex]);

  const scrollSelectedItemIntoView = () => {
    scrollIntoView(selectedItemRef.current, {
      block: 'center',
    });
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  const hasItems = props.items.length > 0;

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      // if there's no suggestion we should not prevent default behavior
      if (!hasItems) {
        return false;
      }

      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter' || event.key === 'Tab' || event.key === EMOJI_SUGGESTION_CHAR) {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (!hasItems) return null;

  return (
    <div className={styles.suggestion}>
      {props.items.map((item: IEmojiModel, index: number) => (
        <EmojiListItem
          item={item}
          className={clsx(styles.item, {
            [styles.isSelected]: index === selectedIndex,
          })}
          onClick={() => selectItem(item)}
          key={item.shortcode}
          ref={(ref) => {
            if (index === selectedIndex) {
              selectedItemRef.current = ref;
            }
          }}
        />
      ))}
    </div>
  );
});
