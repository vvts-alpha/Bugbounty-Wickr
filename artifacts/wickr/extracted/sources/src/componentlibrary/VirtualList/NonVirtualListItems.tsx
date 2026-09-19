import { BaseVirtualListItems, BaseNonVirtualListItemsProps } from './BaseVirtualListItems';

export interface VirtualListSpaceProps extends Omit<BaseNonVirtualListItemsProps, 'type'> {
  className?: string;
}
/**
 * A space to wrap non-virtual items, it will help virtual list to calculate tops correctly
 * TODO: readme
 */
export const NonVirtualListItems: ReactFC<VirtualListSpaceProps> = ({ children, ...rest }) => {
  return (
    <BaseVirtualListItems type="nonVirtualListItems" {...rest}>
      {children}
    </BaseVirtualListItems>
  );
};
