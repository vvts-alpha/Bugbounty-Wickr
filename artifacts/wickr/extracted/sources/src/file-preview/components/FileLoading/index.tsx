import { SpinnerIcon } from '@/componentlibrary';

import styles from './styles.module.less';

export const FileLoading = () => (
  <div className={styles.fileLoading}>
    <div className={styles.background}></div>
    <SpinnerIcon size="5rem" />
  </div>
);
