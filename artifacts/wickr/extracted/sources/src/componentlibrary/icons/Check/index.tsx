import React from 'react';
import { Svg, SvgProps } from '../../Svg';

interface CheckProps extends SvgProps {
  variant?: 'default' | 'form';
}

export const CheckIcon: React.FC<CheckProps> = ({ variant = 'default', ...props }) => (
  <Svg {...props}>
    {variant === 'form' ? (
      <path
        d="M13.279 5.375L6.9933 11.775C6.69866 12.075 6.15848 12.075 5.86384 11.775L2.72098 8.575C2.42634 8.275 2.42634 7.725 2.72098 7.425C3.01562 7.125 3.5558 7.125 3.85045 7.425L6.45312 10.075L12.1496 4.225C12.4442 3.925 12.9844 3.925 13.279 4.225C13.5737 4.525 13.5737 5.075 13.279 5.375Z"
        fill="currentColor"
      />
    ) : (
      <>
        <g clipPath="url(#clip0_535_2899)">
          <path
            d="M13.8438 3.15625C14.0312 3.34375 14.0312 3.6875 13.8438 3.875L5.34375 12.375C5.15625 12.5625 4.8125 12.5625 4.625 12.375L0.125 7.875C-0.0625 7.6875 -0.0625 7.34375 0.125 7.15625C0.3125 6.96875 0.65625 6.96875 0.84375 7.15625L5 11.3125L13.125 3.15625C13.3125 2.96875 13.6562 2.96875 13.8438 3.15625Z"
            fill="currentColor"
          />
        </g>
        <defs>
          <clipPath id="clip0_535_2899">
            <rect width="16" height="16" fill="white" />
          </clipPath>
        </defs>
      </>
    )}
  </Svg>
);

export const CheckFormIcon = (props: Omit<CheckProps, 'variant'>) => (
  <CheckIcon {...props} variant="form" />
);
