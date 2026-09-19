import React, { useEffect } from 'react';
import { ProgressCircleIcon } from '@/componentlibrary';
import useDebouncedCallback from '@/hooks/useDebouncedCallback';
import useStateSafely from '@/hooks/useStateSafely';
import { useAppTranslation } from '@/lib/i18n';

import styles from './ProgressBar.module.less';

type CircleVariant = {
  variant: 'circle';
  isInProgress: boolean;
};

type LineVariant = {
  variant: 'line';
  isInProgress?: boolean;
};

type ProgressBarProps = {
  /**
   * Range from 0 to 100
   */
  progress: number;
} & (CircleVariant | LineVariant);

const ProgressBar: React.FC<ProgressBarProps> = ({ variant, progress, isInProgress }) => {
  const { t } = useAppTranslation();
  // limit progress betwen 0 and 100
  progress = Math.max(0, Math.min(100, progress));
  const [displayedProgress, setDisplayedProgress] = useStateSafely(progress);
  // limit displayedProgress to be updated at most once every 100ms
  const throttledUpdate = useDebouncedCallback(setDisplayedProgress, 100, {
    maxWait: 100,
    leading: true,
    trailing: true,
  });

  useEffect(() => {
    throttledUpdate(progress);
  }, [progress]);

  return (
    <div
      className={variant === 'line' ? styles.lineProgressContainer : styles.circleProgressContainer}
      role="progressbar"
      aria-label={t('Compose.VoiceRecordingBox.ProgressBar')}
      aria-valuenow={displayedProgress}
    >
      {variant === 'line' ? (
        <div className={styles.progressFill} style={{ width: `${displayedProgress}%` }}>
          <div
            className={styles.progressDot}
            style={{ left: `calc(${displayedProgress}% - 4px)` }}
          ></div>
        </div>
      ) : (
        <ProgressCircleIcon
          isInProgress={!!isInProgress}
          percentage={displayedProgress}
          size="3em"
        ></ProgressCircleIcon>
      )}
    </div>
  );
};
export default ProgressBar;
