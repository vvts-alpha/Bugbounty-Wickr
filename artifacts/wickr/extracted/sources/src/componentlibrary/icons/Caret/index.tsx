import { FC } from 'react';
import { Svg, SvgProps } from '../../Svg';
import { Direction } from '../../types';

interface CaretProps extends SvgProps {
  /** Defines the direction of the caret. */
  direction?: Direction;
}

export const CaretIcon: FC<CaretProps> = ({ direction = 'down', ...rest }) => {
  const renderIconPath = () => {
    switch (direction) {
      case 'up':
        return (
          <path
            d="M7.625 4.65625C7.8125 4.46875 8.15625 4.46875 8.34375 4.65625L13.3438 9.65625C13.5312 9.84375 13.5312 10.1875 13.3438 10.375C13.1562 10.5625 12.8125 10.5625 12.625 10.375L8 5.71875L3.34375 10.375C3.15625 10.5625 2.8125 10.5625 2.625 10.375C2.4375 10.1875 2.4375 9.84375 2.625 9.65625L7.625 4.65625Z"
            fill="currentColor"
          />
        );
      case 'left':
        return (
          <path
            d="M4.625 8.375C4.4375 8.1875 4.4375 7.84375 4.625 7.65625L9.625 2.65625C9.8125 2.46875 10.1562 2.46875 10.3438 2.65625C10.5312 2.84375 10.5312 3.1875 10.3438 3.375L5.6875 8L10.3438 12.6562C10.5312 12.8438 10.5312 13.1875 10.3438 13.375C10.1562 13.5625 9.8125 13.5625 9.625 13.375L4.625 8.375Z"
            fill="currentColor"
          />
        );
      case 'right':
        return (
          <path
            d="M11.3438 7.65625C11.5312 7.84375 11.5312 8.1875 11.3438 8.375L6.34375 13.375C6.15625 13.5625 5.8125 13.5625 5.625 13.375C5.4375 13.1875 5.4375 12.8438 5.625 12.6562L10.2812 8L5.625 3.375C5.4375 3.1875 5.4375 2.84375 5.625 2.65625C5.8125 2.46875 6.15625 2.46875 6.34375 2.65625L11.3438 7.65625Z"
            fill="currentColor"
          />
        );
      default:
        return (
          <path
            d="M7.625 10.375L2.625 5.375C2.4375 5.1875 2.4375 4.84375 2.625 4.65625C2.8125 4.46875 3.15625 4.46875 3.34375 4.65625L8 9.3125L12.625 4.65625C12.8125 4.46875 13.1562 4.46875 13.3438 4.65625C13.5312 4.84375 13.5312 5.1875 13.3438 5.375L8.34375 10.375C8.15625 10.5625 7.8125 10.5625 7.625 10.375Z"
            fill="currentColor"
          />
        );
    }
  };
  return <Svg {...rest}>{renderIconPath()}</Svg>;
};

export const CaretUpIcon = (props: Omit<CaretProps, 'direction'>) => (
  <CaretIcon {...props} direction="up" />
);
export const CaretRightIcon = (props: Omit<CaretProps, 'direction'>) => (
  <CaretIcon {...props} direction="right" />
);
export const CaretDownIcon = (props: Omit<CaretProps, 'direction'>) => (
  <CaretIcon {...props} direction="down" />
);
export const CaretLeftIcon = (props: Omit<CaretProps, 'direction'>) => (
  <CaretIcon {...props} direction="left" />
);
