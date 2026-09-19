import React from 'react';
import { Svg, SvgProps } from '../../Svg';

export const PauseIcon: React.FC<SvgProps> = (props) => (
  <Svg {...props}>
    <g clipPath="url(#clip0_76_2076)">
      <path
        d="M8.75 16C5.875 16 3.25 14.5 1.8125 12C0.375 9.53125 0.375 6.5 1.8125 4C3.25 1.53125 5.875 0 8.75 0C11.5938 0 14.2188 1.53125 15.6562 4C17.0938 6.5 17.0938 9.53125 15.6562 12C14.2188 14.5 11.5938 16 8.75 16ZM7.75 6C7.75 5.46875 7.28125 5 6.75 5C6.1875 5 5.75 5.46875 5.75 6V10C5.75 10.5625 6.1875 11 6.75 11C7.28125 11 7.75 10.5625 7.75 10V6ZM11.75 6C11.75 5.46875 11.2812 5 10.75 5C10.1875 5 9.75 5.46875 9.75 6V10C9.75 10.5625 10.1875 11 10.75 11C11.2812 11 11.75 10.5625 11.75 10V6Z"
        fill="currentColor"
      />
    </g>
    <defs>
      <clipPath id="clip0_76_2076">
        <rect width="16" height="16" fill="white" transform="translate(0.75)" />
      </clipPath>
    </defs>
  </Svg>
);
