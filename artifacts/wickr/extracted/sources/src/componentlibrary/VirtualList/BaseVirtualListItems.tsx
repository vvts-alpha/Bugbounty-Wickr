import { clsx } from 'clsx';
import React, { useLayoutEffect, ReactNode, useRef, useMemo } from 'react';
import { useOnResized } from '@/hooks/resizeObserver';
import { useChangeLayoutEffect } from '@/hooks/useChangeEffect';
import useConst from '@/hooks/useConst';
import useLatestCallback from '@/hooks/useLatestCallback';
import { Logger } from '@/lib/logger';
import { assignRef } from '@/utils/react';
import { safeStringify } from '@/utils/strings';
import { useListIdOrder } from './OrderingProvider';
import { useVirtualListContext } from './VirtualListContainer';
import { VirtualListItem } from './VirtualListItem';
import { ItemHeightType } from './types';

import styles from './styles.module.less';

interface SharedProps {
  /** Optional id for the list items component, a random unique id will be assigned if empty */
  id?: string;
  /**
   * Set correct height type for better performance and accurate scroll position
   *  - `static` item height will not change after being rendered
   *  - `dynamic` the item height is subject to change
   * @default 'static'
   */
  itemHeightType?: ItemHeightType;
  /** Optional dependencies array, set it if render functions use states other than data */
  dependencies?: any[];
  children?: ReactNode;
  className?: string;
  /** Optional flag for enabling extra logging */
  extraLoggingEnabled?: boolean;
}

export interface BaseVirtualListItemsProps<T> extends SharedProps {
  type: 'virtualListItems';
  /** Data for list items in an array */
  items: T[];
  /** Render function for each item in the list, should return a ReactNode */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** List item key selector, the key must be unique for each item in the list, when it's set there's no need to set key attribute in ReactNode */
  keySelector: (item: T, index: number, listId: string) => string;
  /** Set the initial height for each item, either a number or a function that returns the height based on the item,
   * required when fixedItemHeight is true, when it's a function, it will be called for each item in the list,
   * and the returned value will be the item height, you can use this to set different item height based on the item data.
   *
   * The closer the initial value is to the actual height, the better the performance will be.
   * */
  initialItemHeight?: number | ((item: T) => number);
}

export interface BaseNonVirtualListItemsProps extends SharedProps {
  type: 'nonVirtualListItems';
}

export type BaseListItemsProps<T> = BaseVirtualListItemsProps<T> | BaseNonVirtualListItemsProps;

export interface BaseVirtualListItemsRef {
  getIdOrder: () => [number, number];
}
const logger = new Logger('BaseVirtualListItems');

export const BaseVirtualListItems = <T,>(props: BaseListItemsProps<T>): React.ReactElement => {
  const {
    id: externalId,
    type,
    itemHeightType = 'static',
    dependencies,
    className,
    children,
    extraLoggingEnabled,
  } = props;
  const [internalId, order, registerOrderedList, unregisterOrderedList] = useListIdOrder();
  const virtualListContext = useVirtualListContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const items = props.type === 'virtualListItems' ? props.items : undefined;
  const height = virtualListContext.useListHeight(internalId);
  const renderableItems = virtualListContext.useRenderableListItems<T>(internalId);
  const onResize = useOnResized((entry) => {
    const newHeight = Math.round(entry.contentRect.height);
    // report list item height change for dynamic item height, used for nonVirtualListItems only
    virtualListContext.setListHeight(internalId, newHeight);
  });

  useConst(() => {
    // add list to context with both internalId (used for internal features) and externalId (used for external features like scrollTo)
    virtualListContext.addList(internalId, externalId, order);
  });

  useLayoutEffect(() => {
    // register and unregister list element in context, used for ordering lists
    registerOrderedList(internalId, containerRef);
    return () => {
      unregisterOrderedList(internalId);
      virtualListContext.removeList(internalId);
    };
  }, []);

  useLayoutEffect(() => {
    // for nonVirtualListItems, measure and report entire list height instead of individual list items
    if (containerRef.current && type === 'nonVirtualListItems') {
      const height = containerRef.current.clientHeight;
      virtualListContext.setListHeight(internalId, height);
    }
  }, []);

  useChangeLayoutEffect(() => {
    virtualListContext.updateListOrder(internalId, order);
  }, [order]);

  useMemo(() => {
    if (type === 'virtualListItems') {
      virtualListContext.setListItemKeys(
        internalId,
        props.items,
        props.keySelector,
        props.initialItemHeight ?? 100
      );
    }
  }, [items]);

  const renderedItems = useMemo(() => {
    if (type === 'nonVirtualListItems') return [];
    const elements = renderableItems
      .filter((item) => virtualListContext.hasListItem(internalId, item.key))
      .map((item) => {
        return (
          <VirtualListItem
            key={item.key}
            itemKey={item.key}
            listId={internalId}
            top={item.top}
            itemHeightType={itemHeightType}
          >
            {props.renderItem(item.item, item.index)}
          </VirtualListItem>
        );
      });

    if (extraLoggingEnabled && virtualListContext.id === 'convo-messages') {
      logger.info(
        '[Debug Missing Messages] current renderable messages',
        renderableItems.map((item) => item.key)
      );
      logger.info(
        '[Debug Missing Messages] current rendered messages',
        elements.map((item) => item.key)
      );
    }
    return elements;
  }, [
    items,
    itemHeightType,
    // there's no need to stringify item content
    safeStringify(renderableItems.map(({ item, ...rest }) => rest)),
    virtualListContext,
    extraLoggingEnabled,
    ...(dependencies ?? []),
  ]);

  const containerRefCallback = useLatestCallback((element: HTMLElement | null) => {
    // only attach resize observer to dynamic nonVirtualListItems
    if (type === 'nonVirtualListItems' && itemHeightType === 'dynamic') {
      assignRef(onResize, element);
    }
    assignRef(containerRef, element);
  });

  // data fields for debugging
  const data = __DEV__
    ? {
        'data-external-id': externalId,
        'data-internal-id': internalId,
        'data-order': order,
      }
    : {};

  return (
    <div
      ref={containerRefCallback}
      className={clsx(styles.baseVirtualListItems, className)}
      style={type === 'virtualListItems' ? { height } : undefined}
      {...data}
    >
      {type === 'virtualListItems' ? renderedItems : children}
    </div>
  );
};
