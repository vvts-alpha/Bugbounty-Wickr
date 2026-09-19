import { clsx } from 'clsx';
import { forwardRef } from 'react';
import { SpinnerIcon } from '@/componentlibrary';
import styles from './Convo.module.less';

export type PaginationMarkerType = 'leading' | 'trailing' | 'center';

type Props = {
  hidden?: boolean;
  /** leading and trailing are for additional messages, center is when no messages are loaded */
  markerType: PaginationMarkerType;
  playAnimation?: boolean;
};

const PaginationMarker = forwardRef(
  ({ hidden, markerType, playAnimation = true }: Props, ref: React.Ref<HTMLDivElement>) => {
    return (
      <div
        data-marker-type={markerType}
        className={
          !hidden
            ? clsx(styles.paginationMarker, {
                [styles.leading]: markerType === 'leading',
                [styles.center]: markerType === 'center',
              })
            : undefined
        }
        hidden={hidden}
        ref={ref}
      >
        {!hidden && (
          <span className={styles.loading} aria-hidden>
            <SpinnerIcon size="30px" playAnimation={playAnimation} />
          </span>
        )}
      </div>
    );
  }
);

export default PaginationMarker;
