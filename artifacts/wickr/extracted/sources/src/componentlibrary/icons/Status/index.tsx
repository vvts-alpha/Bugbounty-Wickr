import React from 'react';
import { Svg, SvgProps } from '../../Svg';

export type StatusIconFilledAmount = 'empty' | 'full' | 'three-quarters' | 'half' | 'one-quarter';

interface StatusIconProps extends SvgProps {
  filledAmount: StatusIconFilledAmount;
}

export const StatusIcon: React.FC<StatusIconProps> = ({ filledAmount, ...props }) => {
  const getIcon = () => {
    switch (filledAmount) {
      case 'empty':
        return (
          <>
            <g clipPath="url(#clip0_76_2062)">
              <path
                d="M8 1C5.46875 1 3.1875 2.34375 1.9375 4.5C0.65625 6.6875 0.65625 9.34375 1.9375 11.5C3.1875 13.6875 5.46875 15 8 15C10.5 15 12.7812 13.6875 14.0312 11.5C15.3125 9.34375 15.3125 6.6875 14.0312 4.5C12.7812 2.34375 10.5 1 8 1ZM8 16C5.125 16 2.5 14.5 1.0625 12C-0.375 9.53125 -0.375 6.5 1.0625 4C2.5 1.53125 5.125 0 8 0C10.8438 0 13.4688 1.53125 14.9062 4C16.3438 6.5 16.3438 9.53125 14.9062 12C13.4688 14.5 10.8438 16 8 16Z"
                fill="currentColor"
              />
            </g>
            <defs>
              <clipPath id="clip0_76_2062">
                <rect width="16" height="16" fill="white" />
              </clipPath>
            </defs>
          </>
        );
      case 'full':
        return (
          <>
            <g clipPath="url(#clip0_76_2064)">
              <path
                d="M8 16C5.125 16 2.5 14.5 1.0625 12C-0.375 9.53125 -0.375 6.5 1.0625 4C2.5 1.53125 5.125 0 8 0C10.8438 0 13.4688 1.53125 14.9062 4C16.3438 6.5 16.3438 9.53125 14.9062 12C13.4688 14.5 10.8438 16 8 16Z"
                fill="currentColor"
              />
            </g>
            <defs>
              <clipPath id="clip0_76_2064">
                <rect width="16" height="16" fill="white" />
              </clipPath>
            </defs>
          </>
        );
      case 'half':
        return (
          <>
            <g clipPath="url(#clip0_76_2065)">
              <path
                d="M15 8C15 4.3125 12.125 1.28125 8.5 1.03125V15C12.125 14.75 15 11.7188 15 8ZM0 8C0 5.15625 1.5 2.53125 4 1.09375C6.46875 -0.34375 9.5 -0.34375 12 1.09375C14.4688 2.53125 16 5.15625 16 8C16 10.875 14.4688 13.5 12 14.9375C9.5 16.375 6.46875 16.375 4 14.9375C1.5 13.5 0 10.875 0 8Z"
                fill="currentColor"
              />
            </g>
            <defs>
              <clipPath id="clip0_76_2065">
                <rect width="16" height="16" fill="white" />
              </clipPath>
            </defs>
          </>
        );
      case 'one-quarter':
        return (
          <>
            <g clipPath="url(#clip0_76_2066)">
              <path
                d="M15 8C15 4.15625 11.8438 1 8 1V6.5C8 7.34375 7.3125 8 6.5 8H1C1 11.875 4.125 15 8 15C11.8438 15 15 11.875 15 8ZM0 8C0 5.15625 1.5 2.53125 4 1.09375C6.46875 -0.34375 9.5 -0.34375 12 1.09375C14.4688 2.53125 16 5.15625 16 8C16 10.875 14.4688 13.5 12 14.9375C9.5 16.375 6.46875 16.375 4 14.9375C1.5 13.5 0 10.875 0 8Z"
                fill="currentColor"
              />
            </g>
            <defs>
              <clipPath id="clip0_76_2066">
                <rect width="16" height="16" fill="white" />
              </clipPath>
            </defs>
          </>
        );
      case 'three-quarters':
        return (
          <>
            <g clipPath="url(#clip0_76_2067)">
              <path
                d="M15 8C15 4.15625 11.8438 1 8 1V7.5C8 7.78125 8.21875 8 8.5 8H15ZM0 8C0 5.15625 1.5 2.53125 4 1.09375C6.46875 -0.34375 9.5 -0.34375 12 1.09375C14.4688 2.53125 16 5.15625 16 8C16 10.875 14.4688 13.5 12 14.9375C9.5 16.375 6.46875 16.375 4 14.9375C1.5 13.5 0 10.875 0 8Z"
                fill="currentColor"
              />
            </g>
            <defs>
              <clipPath id="clip0_76_2067">
                <rect width="16" height="16" fill="white" />
              </clipPath>
            </defs>
          </>
        );
    }
  };

  return <Svg {...props}>{getIcon()}</Svg>;
};

export default StatusIcon;

export const StatusEmptyIcon = (props: Omit<SvgProps, 'children'>) => (
  <StatusIcon {...props} filledAmount="empty" />
);
export const StatusFullIcon = (props: Omit<SvgProps, 'children'>) => (
  <StatusIcon {...props} filledAmount="full" />
);
export const StatusHalfIcon = (props: Omit<SvgProps, 'children'>) => (
  <StatusIcon {...props} filledAmount="half" />
);
export const StatusOneQuarterIcon = (props: Omit<SvgProps, 'children'>) => (
  <StatusIcon {...props} filledAmount="one-quarter" />
);
export const StatusThreeQuartersIcon = (props: Omit<SvgProps, 'children'>) => (
  <StatusIcon {...props} filledAmount="three-quarters" />
);
