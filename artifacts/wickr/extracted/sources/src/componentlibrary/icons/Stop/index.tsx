import React from 'react';
import { Svg, SvgProps } from '../../Svg';

export const StopIcon: React.FC<SvgProps> = (props) => (
  <Svg {...props}>
    <g clipPath="url(#clip0_76_2081)">
      <path
        d="M8 16C5.125 16 2.5 14.5 1.0625 12C-0.375 9.53125 -0.375 6.5 1.0625 4C2.5 1.53125 5.125 0 8 0C10.8438 0 13.4688 1.53125 14.9062 4C16.3438 6.5 16.3438 9.53125 14.9062 12C13.4688 14.5 10.8438 16 8 16ZM6 5C5.4375 5 5 5.46875 5 6V10C5 10.5625 5.4375 11 6 11H10C10.5312 11 11 10.5625 11 10V6C11 5.46875 10.5312 5 10 5H6Z"
        fill="currentColor"
      />
    </g>
    <defs>
      <clipPath id="clip0_76_2081">
        <rect width="16" height="16" fill="white" />
      </clipPath>
    </defs>
  </Svg>
);
