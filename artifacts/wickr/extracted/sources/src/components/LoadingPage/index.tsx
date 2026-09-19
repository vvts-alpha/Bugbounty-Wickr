import { SpinnerIcon } from '@/componentlibrary';

import styles from './LoadingPage.module.less';

export const LOADING_ROUTE = '/loading';

const LoadingPage: React.FC = () => {
  return (
    <div className={styles.root}>
      <SpinnerIcon size="30" />
    </div>
  );
};

export default LoadingPage;
