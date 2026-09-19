import React from 'react';
import { Svg, SvgProps } from '../../Svg';

export const MailIcon: React.FC<SvgProps> = (props) => (
  <Svg {...props}>
    <path
      d="M2 3C1.4375 3 1 3.46875 1 4V5.25L7.09375 9.75C7.625 10.125 8.34375 10.125 8.875 9.75L15 5.25V4C15 3.46875 14.5312 3 14 3H2ZM1 6.5V12C1 12.5625 1.4375 13 2 13H14C14.5312 13 15 12.5625 15 12V6.5L9.46875 10.5625C8.59375 11.1875 7.375 11.1875 6.5 10.5625L1 6.5ZM0 4C0 2.90625 0.875 2 2 2H14C15.0938 2 16 2.90625 16 4V12C16 13.125 15.0938 14 14 14H2C0.875 14 0 13.125 0 12V4Z"
      fill="currentColor"
    />
  </Svg>
);
