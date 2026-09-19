import { clsx } from 'clsx';
import { useOverlayScrollbars, UseOverlayScrollbarsParams } from 'overlayscrollbars-react';
import {
  PropsWithChildren,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { useOnResized } from '@/hooks/resizeObserver';
import useChangeEffect from '@/hooks/useChangeEffect';
import useConst from '@/hooks/useConst';
import useLatestCallback from '@/hooks/useLatestCallback';
import useMergeRefs from '@/hooks/useMergeRefs';
import { Logger } from '@/lib/logger';
import { doubleRequestAnimationFrame } from '@/utils/dom';
import { debounceEndOfTickCallback, requestEndOfTickCallback } from '@/utils/function';
import { assignRef } from '@/utils/react';
import { safeStringify } from '@/utils/strings';
import { CombinedListManager } from './CombinedListManager';
import { OrderingProvider } from './OrderingProvider';
import { VirtualListContext, VirtualListContextType } from './VirtualListContext';
import {
  AnchorType,
  VirtualListHeight,
  VirtualListItem,
  VirtualListScrollTo,
  VirtualListScrollToLocation,
} from './types';

import 'overlayscrollbars/overlayscrollbars.css';
import styles from './styles.module.less';

export interface VirtualListContainerProps {
  /** Optional but strongly recommended if there are more than one virtual list, used for dubugging and creating unique ids for anchor items */
  id?: string;
  /** Number of pixels to preload before and after the visible area */
  preloadOffset?: number;
  /** Enable scroll anchoring, use it for dynamic data or content */
  scrollAnchor?:
    | boolean
    | {
        /** Select another anchor inside current anchor for more precise control, this is a CSS selector */
        insideAnchorSelector: string;
      };
  /** Use custom scroll bar */
  enableOverlayScrollbar?: boolean | UseOverlayScrollbarsParams['options'];
  /** Scroll to a specific list item by key, or scroll to container bottom */
  scrollTo?: VirtualListScrollTo;
  /** Set CSS class for the virtual list container */
  className?: string;
  /** Set the CSS class for the inner DIV within the container that defines scrollbar behavior */
  innerClassName?: string;
  /**
   * Triggered when the scroll position changes and enters or leaves the top or the bottom of the container
   * @param atTop true if the container is currently scrolled to the top, false otherwise
   * @param atBottom true if the container is currently scrolled to the bottom, false otherwise
   */
  onScrollPositionStateChange?: (states: { atTop: boolean; atBottom: boolean }) => void;
}

export interface VirtualListMethods<ScrollTo = VirtualListScrollTo> {
  /** Scroll anchor is managed by virtual list, but we can also set it manually here */
  setScrollAnchor: (anchorScrollId: ScrollTo | undefined, type?: AnchorType | undefined) => void;
}

const VirtualListContainerInternal = forwardRef<
  VirtualListMethods,
  PropsWithChildren<VirtualListContainerProps>
>(
  (
    {
      children,
      id = 'no-name',
      preloadOffset = 200,
      // prefer native scrollbar for better performance
      enableOverlayScrollbar = false,
      scrollAnchor = false,
      scrollTo,
      className,
      innerClassName,
      onScrollPositionStateChange,
    },
    ref
  ) => {
    const logger = useConst(() => new Logger(`VirtualList[${id}] Container`));
    const containerRef = useRef<HTMLElement>(null);
    const [scroller, setScroller] = useState<HTMLElement | null>(null);
    const setContainerRef = useMergeRefs([containerRef, setScroller]);
    const combinedListManager = useConst(() => new CombinedListManager(id, containerRef));
    const data = useRef<{
      containerHeight: number;
      prevIsAtTop?: boolean;
      prevIsAtBottom?: boolean;
      pendingScrollTo?: VirtualListScrollTo;
      suppressScrollEventAnchorUpdate: boolean;
    }>({
      containerHeight: 0,
      // setting scrollTop programmably may trigger 'scroll' event
      // and causing secondary anchor (used for scrollTo anchor) to be cleared unexpectedly
      // as we only want to clear the anchor when user scrolls, so here's the flag
      suppressScrollEventAnchorUpdate: false,
    }).current;
    const resizerRef = useOnResized((entry) => {
      const clientHeight = entry.contentRect.height;
      if (clientHeight === data.containerHeight) return;
      data.containerHeight = clientHeight;
      // pause rendering related calculation when container is hidden
      // so that we can restore correct scroll position after container is shown
      combinedListManager.setIsUpdateEnabled(clientHeight !== 0);
      if (
        containerRef.current &&
        combinedListManager.getScrollAnchor() === VirtualListScrollToLocation.Bottom
      ) {
        // when anchor is set to bottom, scroll to bottom on container height change
        setContainerScrollTop(containerRef.current.scrollHeight);
      }
      debounceUpdateRenderableKeys();
    });
    const [renderableListItems, setRenderableListItems] = useState<VirtualListItem<any>[]>([]);
    const [listHeights, setListHeights] = useState<VirtualListHeight[]>([]);
    // we only need to calculate renderable keys once per tick, this will debounce and group updateRenderableKeys to the end of event loop
    const updateRenderableKeysDebouncer = useConst(debounceEndOfTickCallback);
    // use useLatestCallback to get latest scrollTo
    const latestUpdateRenderableKeys = useLatestCallback((recalculateListItemsTops = true) => {
      // render renderable keys immediately, otherwise it will be scheduled to next tick
      flushSync(() => {
        setListHeights(combinedListManager.listHeights);
        const container = containerRef.current;
        const scrollTo = data.pendingScrollTo;
        data.pendingScrollTo = undefined;
        if (container && scrollTo) {
          let scrollTop: number | undefined;
          if (scrollTo === VirtualListScrollToLocation.Top) {
            scrollTop = 0;
          } else if (scrollTo === VirtualListScrollToLocation.Bottom) {
            scrollTop = combinedListManager.height - data.containerHeight;
          } else {
            const internalId = combinedListManager.getListInternalId(scrollTo.listItemsId);
            if (internalId) {
              scrollTop = combinedListManager.getListItemTop(internalId, scrollTo.itemKey);
              if (scrollTop !== undefined && scrollTo.offset) {
                scrollTop += scrollTo.offset;
              }
            }
          }
          updateRenderableKeys(scrollTop, recalculateListItemsTops);
          if (scrollTop !== undefined) {
            requestEndOfTickCallback(() => {
              setContainerScrollTop(scrollTop!);
            });
          }
        } else {
          updateRenderableKeys(undefined, recalculateListItemsTops);
        }
      });
    });

    const emitPositionChangeEvents = useLatestCallback(
      (scrollTop: number, scrollHeight: number, clientHeight: number) => {
        logger.debug('emitPositionChangeEvents', scrollTop, scrollHeight, clientHeight);
        if (!onScrollPositionStateChange) return;

        const isAtTop = scrollTop === 0;
        const isAtBottom = scrollHeight - clientHeight - scrollTop < 1;
        const { prevIsAtTop, prevIsAtBottom } = data;
        if (isAtTop !== prevIsAtTop || isAtBottom !== prevIsAtBottom) {
          logger.debug('emitPositionChangeEvents', isAtTop, isAtBottom);
          onScrollPositionStateChange({ atTop: isAtTop, atBottom: isAtBottom });
        }
      }
    );
    // make it a stable fn so the context wouldn't change on each rendering
    const debounceUpdateRenderableKeys = useLatestCallback((recalculateListItemsTops = true) =>
      updateRenderableKeysDebouncer(() => latestUpdateRenderableKeys(recalculateListItemsTops))
    );

    useImperativeHandle(
      ref,
      () => ({
        setScrollAnchor: combinedListManager.setScrollAnchor,
      }),
      [combinedListManager]
    );

    useMemo(() => {
      logger.info('scrollTo', scrollTo);
      if (scrollTo) {
        if (typeof scrollTo === 'object') {
          combinedListManager.setScrollAnchor(scrollTo, AnchorType.Primary);
        }
        data.pendingScrollTo = scrollTo;
        debounceUpdateRenderableKeys();
      }
    }, [safeStringify(scrollTo)]);

    useLayoutEffect(() => {
      const container = containerRef.current;
      assignRef(resizerRef, container);
      if (!container) return;
      const height = container.clientHeight;
      data.containerHeight = height;
      const callback = () => {
        debounceUpdateRenderableKeys(false);
        if (!data.suppressScrollEventAnchorUpdate) {
          combinedListManager.setScrollAnchor(undefined, AnchorType.Primary);
        }
      };
      container.addEventListener('scroll', callback);

      return () => {
        container.removeEventListener('scroll', callback);
      };
    }, []);

    const updateRenderableKeys = useLatestCallback(
      (targetScrollTop?: number, recalculateListItemsTops = true) => {
        const container = containerRef.current;
        if (container) {
          const anchorOffset = combinedListManager.calculateRenderableKeys(
            targetScrollTop === undefined ? container.scrollTop : targetScrollTop,
            data.containerHeight,
            preloadOffset,
            recalculateListItemsTops
          );

          if (onScrollPositionStateChange) {
            // if targetScrollTop is not given, we get the actual scrollTop
            // why can't we always use the actual scrollTop?
            //  sometimes we do calculation based on virtual position (e.g. scroll to a message not in view),
            //  so actual position is delayed, using delayed position will result in delayed position change event, which isn't
            //  acceptable for some use cases
            emitPositionChangeEvents(
              targetScrollTop !== undefined
                ? targetScrollTop
                : container.scrollTop + Math.round(anchorOffset),
              combinedListManager.height,
              data.containerHeight
            );
          }
          setRenderableListItems(combinedListManager.renderableItems);
          if (anchorOffset) {
            const anchor = combinedListManager.getScrollAnchor();
            // don't adjust scroll top when anchor is the list bottom and anchor offset is negative (when anchor is an object, it means the anchor is a list item, not list bottom or top)
            // since deleting items above list bottom doesn't affect at bottom state, but adding items does
            if (typeof anchor === 'object' || anchorOffset > 0) {
              const scrollTop = container.scrollTop;
              logger.debug('adjust scrollTop by', anchorOffset, 'current scrollTop', scrollTop);
              requestEndOfTickCallback(() => {
                setContainerScrollTop(scrollTop + Math.round(anchorOffset));
              });
            }
          }

          if (scrollAnchor) {
            doubleRequestAnimationFrame(() => {
              // select first fully visible item
              //   1. if there is one visible item, just select it
              //   2. if there are two visible item, simply select the first one as we don't know which one is fully visible
              //   3. if there are 3 or more visible items, the second one must be fully visible, select second one instead
              const visibleItems = combinedListManager.visibleItems;
              const anchorItem = visibleItems.length < 3 ? visibleItems[0] : visibleItems[1];
              combinedListManager.setScrollAnchor(
                anchorItem
                  ? { listItemsId: anchorItem.listInternalId, itemKey: anchorItem.key }
                  : undefined,
                AnchorType.Tertiary
              );
            });
          }
        }
      }
    );

    const setContainerScrollTop = (scrollTop: number) => {
      const container = containerRef.current;
      if (!container) return;
      data.suppressScrollEventAnchorUpdate = true;
      container.scrollTop = scrollTop;
      doubleRequestAnimationFrame(() => {
        data.suppressScrollEventAnchorUpdate = false;
      });
    };

    useChangeEffect(() => {
      debounceUpdateRenderableKeys(false);
    }, [preloadOffset]);

    useMemo(() => {
      combinedListManager.setIsScrollAnchorEnabled(!!scrollAnchor);
      if (typeof scrollAnchor === 'object') {
        combinedListManager.insideAnchorSelector = scrollAnchor.insideAnchorSelector;
      }
    }, [safeStringify(scrollAnchor)]);

    const useRenderableListItems = useCallback(
      (listInternalId: string) => {
        return renderableListItems.filter((item) => item.listInternalId === listInternalId);
      },
      [renderableListItems]
    );

    const useListHeight = useCallback(
      (listInternalId: string) => {
        return listHeights.find((list) => list.listInternalId === listInternalId)?.height ?? 0;
      },
      [safeStringify(listHeights)]
    );

    const contextValue = useMemo<VirtualListContextType>(
      () => ({
        id,
        addList: combinedListManager.addList,
        removeList: (internalId: string) => {
          combinedListManager.removeList(internalId);
          debounceUpdateRenderableKeys();
        },
        updateListOrder: (internalId, order) => {
          combinedListManager.updateListOrder(internalId, order);
          debounceUpdateRenderableKeys();
        },
        setListItemKeys: <T,>(
          internalId: string,
          items: T[],
          keySelector: (item: T, index: number, listId: string) => string,
          initialHeight: number | ((item: T) => number)
        ) => {
          combinedListManager.setListItemKeys(internalId, items, keySelector, initialHeight);
          debounceUpdateRenderableKeys();
        },
        hasListItem: combinedListManager.hasListItem,
        getListItem: combinedListManager.getListItem,
        setListHeight: (internalId: string, height: number) => {
          combinedListManager.setListHeight(internalId, height);
          debounceUpdateRenderableKeys();
        },
        setListItemHeight: (internalId: string, key: string, height: number) => {
          combinedListManager.setListItemHeight(internalId, key, height);
          debounceUpdateRenderableKeys();
        },
        useRenderableListItems: useRenderableListItems,
        useListHeight: useListHeight,
      }),
      [
        id,
        safeStringify(renderableListItems),
        combinedListManager,
        debounceUpdateRenderableKeys,
        useListHeight,
        useRenderableListItems,
      ]
    );

    const customScrollerRootRef = useRef<HTMLDivElement>(null);
    const osOptions =
      enableOverlayScrollbar && typeof enableOverlayScrollbar === 'object'
        ? enableOverlayScrollbar
        : {};
    const [initialize, osInstance] = useOverlayScrollbars({
      options: {
        paddingAbsolute: false,
        showNativeOverlaidScrollbars: false,
        ...osOptions,
        update: {
          debounce: 0, // disable debounce to avoid timing issue
          ignoreMutation: () => true, // performance optimization, we don't need to track mutations in virtual list
          ...osOptions.update,
        },
        // TODO: styling
        scrollbars: {
          theme: 'os-theme-dark',
          visibility: 'auto',
          autoHide: 'move',
          autoHideDelay: 1300,
          dragScroll: true,
          clickScroll: 'instant',
          ...osOptions.scrollbars,
        },
      },
    });

    useEffect(() => {
      if (!enableOverlayScrollbar) return;
      const { current: root } = customScrollerRootRef;

      if (root) {
        initialize({
          target: root,
          elements: {
            viewport: scroller,
          },
        });
      }
      return () => osInstance()?.destroy();
    }, [scroller, initialize, osInstance, safeStringify(enableOverlayScrollbar)]);

    return (
      <OrderingProvider>
        <VirtualListContext.Provider value={contextValue}>
          <div
            // show the data prop for 3rd party overlay scrollbar if it's enabled
            data-overlayscrollbars-initialize={enableOverlayScrollbar ? '' : null}
            ref={customScrollerRootRef}
            className={className}
            style={{ height: '100%', width: '100%' }}
          >
            <div
              ref={setContainerRef}
              tabIndex={0} // make the list focusable so we can scroll it with arrow keys continously
              className={clsx(innerClassName, styles.list, {
                [styles.hideNativeScrollBar]: !!enableOverlayScrollbar,
              })}
            >
              {children}
            </div>
          </div>
        </VirtualListContext.Provider>
      </OrderingProvider>
    );
  }
);

export const VirtualListContainer = forwardRef<
  VirtualListMethods,
  PropsWithChildren<VirtualListContainerProps>
>(({ children, ...props }, ref) => {
  return (
    <VirtualListContainerInternal ref={ref} {...props}>
      {children}
    </VirtualListContainerInternal>
  );
});

export const useVirtualListContext = () => {
  const context = useContext(VirtualListContext);
  if (!context) {
    throw new Error('useVirtualListContext must be used within a VirtualListProvider');
  }
  return context;
};
