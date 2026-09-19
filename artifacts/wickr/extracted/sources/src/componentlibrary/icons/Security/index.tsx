import { FC } from 'react';
import { Svg, SvgProps } from '../../Svg';

export const SecurityIcon: FC<SvgProps> = (props) => (
  <Svg {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 3.83329L8 1.16663L14 3.83329V7.83329C14 11.5333 11.44 14.9933 8 15.8333C4.56 14.9933 2 11.5333 2 7.83329V3.83329ZM12.6667 8.49329H8V2.62663L3.33333 4.69996V8.49996H8V14.4533C10.48 13.6866 12.3133 11.24 12.6667 8.49329Z"
      fill="currentColor"
    />
  </Svg>
);
