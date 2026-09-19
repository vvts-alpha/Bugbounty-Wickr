import { CameraIcon, IconButton } from '@/componentlibrary';
import { KeyboardShortcut } from '@/components/KeyboardShortcut';
import { useAppTranslation } from '@/lib/i18n';
import ControlBarButton from './ControlBarButton';

import styles from './styles.module.less';

interface VideoControlProps {
  isFloatingControl?: boolean;
}

const VideoControl: React.FC<VideoControlProps> = ({ isFloatingControl = false }) => {
  const { t } = useAppTranslation();
  const isLocalVideoTileStarted = false;
  const label = isLocalVideoTileStarted ? t('Stop video') : t('Start video');

  const toggleLocalVideo = () => {
    console.log('Toggle video');
  };

  return (
    <>
      <KeyboardShortcut shortcut="ToggleVideo" onShortcut={toggleLocalVideo} />
      <ControlBarButton
        isFloatingControl={isFloatingControl}
        type="video"
        label={label}
        onClick={toggleLocalVideo}
        a11yLabel={label}
        icon={
          <IconButton
            label={label}
            className={styles.controlButton}
            selected={isLocalVideoTileStarted}
          >
            <CameraIcon />
          </IconButton>
        }
      />
    </>
  );
};

export default VideoControl;
