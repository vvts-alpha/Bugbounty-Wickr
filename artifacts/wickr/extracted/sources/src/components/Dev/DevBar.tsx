import DevMenu from './DevMenu';

import styles from './Dev.module.less';

const DevBar: React.FC = () => {
  if (!__DEV__) {
    return null;
  }

  return (
    <div className={styles.devBar} data-testid="dev-bar" aria-hidden="true">
      <DevMenu />
    </div>
  );
};

export default DevBar;
