import { FC } from 'react';
import { Svg, SvgProps } from '../../Svg';

export const ConnectivityIcon: FC<SvgProps> = (props) => (
  <Svg {...props}>
    <path
      d="M11.3333 11.1667L8.66667 8.5V6.38C9.44 6.1 10 5.36667 10 4.5C10 3.39333 9.10667 2.5 8 2.5C6.89333 2.5 6 3.39333 6 4.5C6 5.36667 6.56 6.1 7.33333 6.38V8.5L4.66667 11.1667H2V14.5H5.33333V12.4667L8 9.66667L10.6667 12.4667V14.5H14V11.1667H11.3333Z"
      fill="currentColor"
    />
  </Svg>
);
