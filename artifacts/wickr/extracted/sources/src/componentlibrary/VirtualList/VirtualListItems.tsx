import React from 'react';
import { BaseVirtualListItems, BaseVirtualListItemsProps } from './BaseVirtualListItems';
import { NonVirtualListItems } from './NonVirtualListItems';

export interface VirtualListItemsProps<T> extends Omit<BaseVirtualListItemsProps<T>, 'type'> {
  /** Optional header id for the list items header component, a random unique id will be assigned if empty */
  headerId?: string;
  /** Optional footer id for the list items footer component, a random unique id will be assigned if empty */
  footerId?: string;
  /** Optional header component to be rendered above the list items */
  header?: React.ReactNode;
  /** Optional footer component to be rendered below the list items */
  footer?: React.ReactNode;
}

export const VirtualListItems = <T,>(props: VirtualListItemsProps<T>): React.ReactElement => {
  const { header, footer, headerId, footerId, ...rest } = props;
  return (
    <>
      {header && (
        <NonVirtualListItems id={headerId} itemHeightType="dynamic">
          {header}
        </NonVirtualListItems>
      )}
      <BaseVirtualListItems type="virtualListItems" {...rest} />
      {footer && (
        <NonVirtualListItems id={footerId} itemHeightType="dynamic">
          {footer}
        </NonVirtualListItems>
      )}
    </>
  );
};
