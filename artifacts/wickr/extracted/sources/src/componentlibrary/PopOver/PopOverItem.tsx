import { clsx } from 'clsx';
import React, {
  useRef,
  ReactNode,
  useContext,
  HTMLAttributes,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Link, RelativeRoutingType } from 'react-router-dom';
import { CheckIcon } from '../icons';
import { PopOverContext } from './PopOverContext';

import styles from './PopOver.module.less';

export type PopOverItemType = 'a' | 'button';
type Variant = 'default' | 'alert';

export interface PopOverItemProps extends HTMLAttributes<HTMLElement> {
  /** The callback fired when the item is clicked. */
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /** Whether or not the item is checked. */
  checked?: boolean;
  /** Whether or not the item is disabled. */
  disabled?: boolean;
  /** Defines the href attribute if the item is rendered as an `a` tag. */
  href?: string;
  /** The target for an href, _blank if opening a new window */
  target?: string;
  /** Defines which tag will the item be rendered as, it defaults to `button`. */
  as?: PopOverItemType;
  /** Whether or not the item has a border. */
  border?: boolean;
  /** Unique identifier to target element */
  testId?: string;
  /** Provides a semantic role for the item. Defaults to menuitem. If the checked prop is being used, the role should be specified as a checkbox or radio. */
  role?: React.AriaRole;
  /** An icon placed to the left of the text. Only visible if the parent PopOver has gutter=true prop. */
  icon?: ReactNode;
  /** Provides a path to the React Router Link component */
  linkTo?: string;
  /** Change the relative routing type for the linkTo property. */
  relative?: RelativeRoutingType;
  /** Custom className applied to the button, anchor, or Link element */
  contentClassName?: string;
  /** Custom className applied to the list item wrapper element */
  listItemClassName?: string;
  /** When true, pop over item is automatically focused. We should set it to false when we don't want the items to take focus once the pop over menu renders */
  enableMouseOverFocus?: boolean;
  /** The label used for accessibility. */
  a11yLabel?: string;
  /** Variant: Provides styling for defined types of content */
  variant?: Variant;
}

export const PopOverItem = forwardRef<HTMLElement, PopOverItemProps>(
  (
    {
      as = 'button',
      children,
      checked,
      testId = 'popover-item',
      role = 'menuitem',
      icon,
      linkTo,
      relative,
      contentClassName,
      listItemClassName,
      enableMouseOverFocus = true,
      a11yLabel,
      disabled,
      variant = 'default',
      ...rest
    },
    forwardedRef
  ) => {
    const Tag = as;
    const ref = useRef<HTMLElement>(null);

    useImperativeHandle(forwardedRef, () => ref.current!);

    const focus = () => {
      if (document.activeElement !== ref.current) {
        ref.current?.focus();
      }
    };

    const popOverCtx = useContext(PopOverContext);

    // Always render the div so the gutter styling can be applied
    const renderIcon = () => (
      <div className={clsx(styles.iconContainer, { isLink: as === 'a' })}>{icon}</div>
    );

    const handleClick = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
      if (disabled) return;
      return rest.onClick?.(e);
    };

    const contents = linkTo ? (
      <Link
        to={linkTo}
        relative={relative}
        className={clsx(styles.content, contentClassName, 'notSelectable')}
        ref={ref as any}
        role={role}
        aria-disabled={disabled}
        onClick={handleClick}
        {...rest}
        aria-label={a11yLabel}
        onMouseDown={popOverCtx.handleItemMouseDown}
        onMouseUp={popOverCtx.handleItemMouseUp}
        onMouseEnter={enableMouseOverFocus ? focus : undefined}
      >
        {renderIcon()}
        {children}
      </Link>
    ) : (
      <Tag
        className={clsx(styles.content, contentClassName, 'notSelectable')}
        {...rest}
        role={role}
        ref={ref as any}
        aria-checked={checked}
        aria-label={a11yLabel}
        onClick={handleClick}
        onMouseDown={popOverCtx.handleItemMouseDown}
        onMouseUp={popOverCtx.handleItemMouseUp}
        onMouseEnter={enableMouseOverFocus ? focus : undefined}
        aria-disabled={disabled}
      >
        {renderIcon()}
        {children}
        {checked && <CheckIcon className={styles.check} data-testid="popover-check" />}
      </Tag>
    );

    // VoiceOver cannot read <li> tags in the QT WebEngine
    return (
      <div
        className={clsx(styles.popOverItem, listItemClassName, {
          [styles.disabled]: disabled,
          [styles.alert]: variant === 'alert',
        })}
        data-testid={testId}
      >
        {contents}
      </div>
    );
  }
);

export default PopOverItem;
