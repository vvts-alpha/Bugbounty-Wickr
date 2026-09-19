import { useEffect, useRef } from 'react';

import { PopOverItem } from '@/componentlibrary';
import useEventListener from '@/hooks/useEventListener';
import { useAppSelector } from '@/store';
import { selectQuickResponses } from '@/store/slices/account';
import styles from './QuickResponses.module.less';

export interface QuickResponsesProps {
  onSelect: (response: string) => void;
}

export const QuickResponses: ReactFC<QuickResponsesProps> = ({ onSelect }) => {
  const quickResponses = useAppSelector(selectQuickResponses);
  const firstItemRef = useRef<HTMLElement>(null);

  useEffect(() => {
    firstItemRef.current?.focus();
  }, []);

  useEventListener(document, 'keydown', (e) => {
    const key = parseInt(e.key);
    if (isNaN(key)) {
      return;
    }

    // Key 1-9 -> maps to index 0-8, key 0 -> maps to index 9 (10th response)
    const index = key === 0 ? 9 : key - 1;
    const response = quickResponses[index];
    if (response) {
      onSelect(response);
    }
  });

  return (
    <>
      {...quickResponses.map((response, i) => (
        <PopOverItem
          ref={i === 0 ? firstItemRef : null}
          key={response}
          onClick={() => onSelect(response)}
        >
          <div className={styles.itemContent}>
            <span>
              {`${i + 1}. `}
              {response}
            </span>
          </div>
        </PopOverItem>
      ))}
    </>
  );
};
