import { clsx } from 'clsx';
import React, { FC, ReactNode } from 'react';

import { IconButton, Tooltip } from '../../../componentlibrary';

import styles from './styles.module.less';

export interface ControlBarButtonProps {
  /** Indicates if the button is rendered in the FloatingMeetingControls portal rather than the main meeting window. */
  isFloatingControl?: boolean;
  /** Applies as an HTML title attribute in place of a tooltip, only when used in the FloatingMeetingControls. */
  title?: string;
  a11yLabel: string;
  buttonBadge?: ReactNode;
  buttonDisabled?: boolean;
  iconWithButton?: boolean;
  icon: JSX.Element;
  /** The callback fired when the item is clicked. */
  onClick: () => void;
  /** The label of an control bar item. */
  label: string;
  /**  Apply this prop to receive visual feedback that the button is 'active' */
  isSelected?: boolean;
  /** Use children to define an alternative to popOver prop with a custom set of elements to be rendered into the popover */
  children?: ReactNode | ReactNode[];
  className?: string;
  /** The type of Control Bar Button. */
  type: 'audio' | 'video' | 'callTones' | 'endMeeting' | 'screenshare';
}

export const ControlBarButton: FC<ControlBarButtonProps> = ({
  icon,
  onClick,
  label,
  a11yLabel,
  isSelected = false,
  children,
  isFloatingControl = false,
  buttonBadge,
  buttonDisabled,
  iconWithButton = true,
  className,
  type,
  ...rest
}) => {
  const handleButtonClick = (label: string) => {
    console.log(`${label} button clicked`); // TODO: Change to logger.info()
    onClick();
  };

  const WrapperEl = isFloatingControl ? React.Fragment : Tooltip;
  const wrapperProps = isFloatingControl ? ({} as any) : { tip: a11yLabel };

  return (
    <div
      {...rest}
      className={clsx(styles.controlBarItem, {
        [styles.isFloatingControl]: isFloatingControl,
      })}
    >
      <WrapperEl {...wrapperProps}>
        {iconWithButton ? (
          <IconButton
            onClick={() => handleButtonClick(label)}
            label={a11yLabel}
            badge={buttonBadge}
            aria-disabled={buttonDisabled}
            className={clsx(className, styles.controlBarItemIconButton, {
              [styles.selected]: isSelected,
            })}
            selected={isSelected}
            id={type}
          >
            {icon}
          </IconButton>
        ) : (
          icon
        )}
      </WrapperEl>
      {!isFloatingControl && (
        <label htmlFor={type} className={styles.itemLabel}>
          {label}
        </label>
      )}
    </div>
  );
};

export default ControlBarButton;
