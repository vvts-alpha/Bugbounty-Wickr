import { FC } from 'react';
import { Svg, SvgProps } from '../../Svg';

type Props = SvgProps & {
  outlineColor?: string;
};

export const LockInCircleIcon: FC<Props> = (props) => {
  return (
    <Svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 125 125" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M124 62.5C124 96.4637 96.4622 124 62.4968 124C28.5378 124 1 96.4637 1 62.5C1 28.5363 28.5378 1 62.4968 1C96.4622 1 124 28.5363 124 62.5Z"
        stroke={props.outlineColor ?? '#CDCDCD'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M38.1436 55H86.8564C86.9374 55 87 55.0647 87 55.1426V90.2891C87 92.8853 84.8837 95 82.2822 95H42.7178C40.1163 95 38 92.8853 38 90.2891V55.1426C38 55.0647 38.0626 55 38.1436 55Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M62.5 24C72.6312 24 81 32.9036 81 44.0068V54.7676C81 54.8561 80.9676 54.9212 80.9326 54.959C80.8988 54.9954 80.8708 55 80.8555 55H44.4053C44.3372 54.958 44.2598 54.9077 44.1865 54.8506C44.0955 54.7796 44.0352 54.717 44 54.6729V44.0068C44 32.9036 52.3688 24 62.5 24Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M62.5 76C59.4675 76 57 73.5336 57 70.5C57 67.4664 59.4675 65 62.5 65C65.5325 65 68 67.4664 68 70.5C68 73.5336 65.5325 76 62.5 76Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path d="M62.6667 76V85" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
};
