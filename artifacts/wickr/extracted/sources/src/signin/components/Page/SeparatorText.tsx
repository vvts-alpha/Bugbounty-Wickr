import { FC } from 'react';

import styles from './styles.module.less';

interface SeparatorTextProps {
  text: string;
}

const SeparatorText: FC<SeparatorTextProps> = ({ text }) => {
  return (
    <div className={styles.separatorTextContainer}>
      <div className={styles.separatorLine}></div>
      <div className={styles.separatorTextContent}>{text}</div>
      <div className={styles.separatorLine}></div>
    </div>
  );
};

export default SeparatorText;
