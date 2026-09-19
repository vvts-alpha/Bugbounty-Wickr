import { ForwardedRef, forwardRef } from 'react';
import {
  VirtualListContainer,
  VirtualListContainerProps,
  VirtualListMethods,
} from './VirtualListContainer';
import { VirtualListItems, VirtualListItemsProps } from './VirtualListItems';
import {
  DEFAULT_FOOTER_LIST_ITEMS_ID,
  DEFAULT_HEADER_LIST_ITEMS_ID,
  DEFAULT_LIST_ITEMS_ID,
  SingleVirtualListScrollTo,
} from './types';

export interface VirtualListProps<T>
  extends Omit<VirtualListContainerProps, 'scrollTo'>,
    VirtualListItemsProps<T> {
  scrollTo?: SingleVirtualListScrollTo;
  ref?: ForwardedRef<VirtualListMethods<SingleVirtualListScrollTo>>;
}

// @ts-expect-error forwardRef and generics cause issues in TS 5
export const VirtualList: <T>(props: VirtualListProps<T>) => JSX.Element | null = forwardRef(
  (
    {
      preloadOffset,
      enableOverlayScrollbar,
      scrollAnchor,
      scrollTo,
      id,
      className,
      innerClassName,
      onScrollPositionStateChange,
      ...props
    },
    ref
  ) => {
    return (
      <VirtualListContainer
        ref={ref}
        id={id}
        className={className}
        innerClassName={innerClassName}
        preloadOffset={preloadOffset}
        enableOverlayScrollbar={enableOverlayScrollbar}
        scrollAnchor={scrollAnchor}
        scrollTo={
          scrollTo && typeof scrollTo !== 'number'
            ? {
                listItemsId: DEFAULT_LIST_ITEMS_ID,
                itemKey: scrollTo.itemKey,
                offset: scrollTo.offset,
              }
            : scrollTo
        }
        onScrollPositionStateChange={onScrollPositionStateChange}
      >
        <VirtualListItems
          id={DEFAULT_LIST_ITEMS_ID}
          headerId={DEFAULT_HEADER_LIST_ITEMS_ID}
          footerId={DEFAULT_FOOTER_LIST_ITEMS_ID}
          {...props}
        ></VirtualListItems>
      </VirtualListContainer>
    );
  }
);
