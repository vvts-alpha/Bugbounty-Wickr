import { useCallback, useLayoutEffect, useRef } from 'react';
import { useOnResized } from '@/hooks/resizeObserver';
import { assignRef } from '@/utils/react';
import { useVirtualListContext } from './VirtualListContainer';
import { getDataScrollId, ItemHeightType } from './types';

import styles from './styles.module.less';

export const VirtualListItem: ReactFC<{
  listId: string;
  itemKey: string;
  itemHeightType: ItemHeightType;
  top: number;
}> = ({ listId, itemKey, itemHeightType, top, children }) => {
  const virtualListContext = useVirtualListContext();
  const itemRef = useRef<HTMLDivElement>(null);

  const onResize = useOnResized((entry) => {
    const listItem = virtualListContext.getListItem(listId, itemKey);
    // fractional pixels given by resize observer are not respected by Chrome and will be truncated
    // so we round it to get closer value to its actual height
    const newHeight = Math.round(entry.contentRect.height);
    // skip if height isn't changed
    if (listItem?.height === newHeight) return;
    // report list item height change for dynamic item height
    virtualListContext.setListItemHeight(listId, itemKey, newHeight);
  });

  useLayoutEffect(() => {
    if (!itemRef.current) return;
    // save initial item height
    // use client height for better performance
    // https://measurethat.net/Benchmarks/Show/20159/1/get-precise-height-getcomputedstyle-vs-getboundingclien#latest_results_block
    const listItem = virtualListContext.getListItem(listId, itemKey);
    // skip if height is measured for a static item
    if (itemHeightType === 'static' && listItem?.height !== undefined) return;
    const height = itemRef.current.clientHeight;
    virtualListContext.setListItemHeight(listId, itemKey, height);
  }, []);

  const containerRefCallback = useCallback(
    (element: HTMLElement | null) => {
      // attach resize observer for dynamic item height
      assignRef(onResize, itemHeightType === 'dynamic' ? element : null);
      assignRef(itemRef, element);
    },
    [itemHeightType]
  );

  // VoiceOver cannot read <li> tags in the QT WebEngine
  return (
    <div
      data-scroll-id={getDataScrollId(listId, itemKey)}
      ref={containerRefCallback}
      className={styles.virtualListItem}
      style={{ top }}
    >
      {children}
    </div>
  );
};
