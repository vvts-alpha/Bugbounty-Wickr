import React from 'react';

import { Svg, SvgProps } from '../../Svg';
import { Direction } from '../../types';

const dirTransform = {
  up: '0',
  right: '90',
  down: '180',
  left: '270',
};

interface ArrowProps extends SvgProps {
  /** Defines the direction of the arrow. */
  direction?: Direction;
}

function getTransform(dir: Direction) {
  return `rotate(${dirTransform[dir]}deg)`;
}

export const ArrowIcon: React.FC<ArrowProps> = ({ direction = 'up', ...rest }) => (
  <Svg {...rest} style={{ transform: getTransform(direction) }}>
    <path
      d="M8.28751 2.51253L12.6875 6.91744C12.8375 7.06761 12.8375 7.34292 12.6875 7.49309C12.5375 7.64325 12.2625 7.64325 12.1125 7.49309L8.41251 3.76392V13.1995C8.41251 13.4247 8.21251 13.5999 8.01251 13.5999C7.78751 13.5999 7.61251 13.4247 7.61251 13.1995V3.76392L3.88751 7.49309C3.73751 7.64325 3.46251 7.64325 3.31251 7.49309C3.16251 7.34292 3.16251 7.06761 3.31251 6.91744L7.71251 2.51253C7.86251 2.36236 8.13751 2.36236 8.28751 2.51253Z"
      fill="currentColor"
    />
  </Svg>
);

export const ArrowUpIcon = (props: Omit<ArrowProps, 'direction'>) => (
  <ArrowIcon {...props} direction="up" />
);
export const ArrowRightIcon = (props: Omit<ArrowProps, 'direction'>) => (
  <ArrowIcon {...props} direction="right" />
);
export const ArrowDownIcon = (props: Omit<ArrowProps, 'direction'>) => (
  <ArrowIcon {...props} direction="down" />
);
export const ArrowLeftIcon = (props: Omit<ArrowProps, 'direction'>) => (
  <ArrowIcon {...props} direction="left" />
);
