import { clsx } from 'clsx';
import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { scrollIntoView } from '@/utils/dom';
import MentionListItem from './MentionListItem';
import { IMentionModel } from './MentionModel';

import styles from '../SuggestionList/SuggestionList.module.less';

export const AT_MENTION_PREFIX = '@';

export interface MentionListRef {
  onKeyDown: (props: Record<string, any>) => boolean;
}

export default forwardRef<MentionListRef, Record<string, any>>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedItemRef = useRef<HTMLSpanElement | null>();

  const selectItem = (item: IMentionModel | undefined) => {
    if (item) {
      // Remove any spaces in ID since Wickr highlights mentions simply based on username matches without spaces
      props.command({
        id: item.id,
        label: item.name ? `${item.name.replace(/\s/g, '')}` : `${item.label.replace(/\s/g, '')}`,
      });
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

  const spaceHandler = () => {
    const item = props.items[selectedIndex];
    const query: string = props.query;
    if (item.id === 'All' && query.toLowerCase() === 'all') {
      selectItem(item);
    }
  };

  useEffect(() => scrollSelectedItemIntoView(), [selectedIndex]);

  const scrollSelectedItemIntoView = () => {
    scrollIntoView(selectedItemRef.current, {
      block: 'center',
    });
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      // if there's no suggestion we should not prevent default behavior
      if (props.items.length === 0) {
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

      if (event.key === 'Enter' || event.key === 'Tab') {
        enterHandler();
        return true;
      }

      // Handle if @All is typed then followed by a space. In this case, we should automatically create the mention.
      // If we need to handle @All followed by a period, comma, or other characters, we can do that here.
      if (event.code === 'Space') {
        spaceHandler();
        return false;
      }

      return false;
    },
  }));

  return props.items.length !== 0 ? (
    <div className={styles.suggestion}>
      {props.items.map((item: IMentionModel, index: number) => (
        <MentionListItem
          item={item}
          className={clsx(styles.item, {
            [styles.isSelected]: index === selectedIndex,
          })}
          onClick={() => selectItem(item)}
          key={item.id}
          ref={(ref) => {
            if (index === selectedIndex) {
              selectedItemRef.current = ref;
            }
          }}
        />
      ))}
    </div>
  ) : null;
});
