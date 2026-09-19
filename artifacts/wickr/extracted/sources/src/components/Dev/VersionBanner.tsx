import { Tooltip } from '@/componentlibrary';
import { useAppDispatch } from '@/store';
import { copyTextToClipboard } from '@/utils/strings';

import styles from './Dev.module.less';

const VersionBanner: React.FC = () => {
  const dispatch = useAppDispatch();

  const buildDate = new Date(__BUILD_TIMESTAMP__);
  const dayMonth = `${buildDate.getMonth() + 1}/${buildDate.getDate()}`;
  const info = [dayMonth];
  if (__COMMIT_ID__) {
    info.push(__COMMIT_ID__);
  }
  const versionInfo = info.join(' ');

  return (
    <Tooltip tip="Date and commit ID of web assets; beta only. Click to copy.">
      <button
        onClick={() => copyTextToClipboard(__COMMIT_ID__)}
        data-testid="version-info"
        className={styles.versionInfo}
      >
        {versionInfo}
      </button>
    </Tooltip>
  );
};

export default VersionBanner;
