import { FC } from 'react';
import { Svg } from '../../Svg';
import { InnerIconProps } from '../Org';

export const GuestIcon: FC<InnerIconProps> = ({ innerIconColor = 'white', ...rest }) => {
  return (
    <Svg {...rest} viewBox="0 0 40 40">
      <rect width="40" height="40" rx="2" fill="currentColor" />
      <path
        d="M20 20C16.6719 20 14 17.3281 14 14C14 10.7188 16.6719 8 20 8C23.2812 8 26 10.7188 26 14C26 17.3281 23.2812 20 20 20ZM24.1719 21.5C27.6406 21.5 30.5 24.3594 30.5 27.8281V29.75C30.5 31.0156 29.4688 32 28.25 32H11.75C10.4844 32 9.5 31.0156 9.5 29.75V27.8281C9.5 24.3594 12.3125 21.5 15.7812 21.5H16.5781C17.6094 22.0156 18.7812 22.25 20 22.25C21.2188 22.25 22.3438 22.0156 23.375 21.5H24.1719Z"
        fill={innerIconColor}
      />
    </Svg>
  );
};
