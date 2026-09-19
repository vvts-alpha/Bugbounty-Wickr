import React from 'react';
import { Svg, SvgProps } from '../../Svg';

type MoreDirection = 'horizontal' | 'vertical';

export interface MoreProps extends SvgProps {
  direction?: MoreDirection;
}

export const MoreIcon: React.FC<MoreProps> = ({ direction = 'vertical', ...props }) => (
  <Svg {...props} style={direction === 'horizontal' ? { transform: 'rotate(90deg)' } : {}}>
    <path
      d="M8 12C8.53125 12 9 12.4688 9 13C9 13.5625 8.53125 14 8 14C7.4375 14 7 13.5625 7 13C7 12.4688 7.4375 12 8 12ZM8 7C8.53125 7 9 7.46875 9 8C9 8.5625 8.53125 9 8 9C7.4375 9 7 8.5625 7 8C7 7.46875 7.4375 7 8 7ZM9 3C9 3.5625 8.53125 4 8 4C7.4375 4 7 3.5625 7 3C7 2.46875 7.4375 2 8 2C8.53125 2 9 2.46875 9 3Z"
      fill="currentColor"
    />
  </Svg>
);

export const MoreHorizontalIcon = (props: SvgProps) => (
  <MoreIcon {...props} direction="horizontal" />
);
