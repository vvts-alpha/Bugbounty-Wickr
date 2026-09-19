import { DeviceManagementIcon, IconButton } from '@/componentlibrary';
import { KeyboardShortcut } from '@/components/KeyboardShortcut';
import { useAppTranslation } from '@/lib/i18n';
import ControlBarButton from './ControlBarButton';

import styles from './styles.module.less';

interface ScreenShareControlProps {
  isFloatingControl?: boolean;
}

const ScreenShareControl: React.FC<ScreenShareControlProps> = ({ isFloatingControl = false }) => {
  const { t } = useAppTranslation();
  const isLocalScreenShared = false;
  const label = isLocalScreenShared ? t('Stop screen') : t('Start screen');

  const toggleScreenShare = () => {
    console.log('Toggle Screen Share');
  };

  return (
    <>
      <KeyboardShortcut shortcut="ToggleScreenShare" onShortcut={toggleScreenShare} />
      <ControlBarButton
        isFloatingControl={isFloatingControl}
        type="video"
        label={label}
        onClick={toggleScreenShare}
        a11yLabel={label}
        icon={
          <IconButton label={label} className={styles.controlButton} selected={isLocalScreenShared}>
            <DeviceManagementIcon />
          </IconButton>
        }
      />
    </>
  );
};

export default ScreenShareControl;
