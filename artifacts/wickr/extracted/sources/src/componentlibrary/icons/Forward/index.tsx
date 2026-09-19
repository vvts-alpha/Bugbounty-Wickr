import { ReturnIcon } from '../Return';

const ForwardIcon = (props: any) => (
  <ReturnIcon
    style={{
      transform: 'scaleX(-1)',
      width: '18px',
      height: '18px',
      marginLeft: '6px',
      marginBottom: '4px',
    }}
    {...props}
  />
);

export default ForwardIcon;
