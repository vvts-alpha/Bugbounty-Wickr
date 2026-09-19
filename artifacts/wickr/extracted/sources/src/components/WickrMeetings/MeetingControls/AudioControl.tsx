import { IconButton, MicrophoneSolidIcon } from '@/componentlibrary';
import { KeyboardShortcut } from '@/components/KeyboardShortcut';
import { useAppTranslation } from '@/lib/i18n';
import ControlBarButton from './ControlBarButton';

import styles from './styles.module.less';

interface AudioControlProps {
  isFloatingControl?: boolean;
}

const AudioControl: React.FC<AudioControlProps> = ({ isFloatingControl = false }) => {
  const { t } = useAppTranslation();
  const isLocalAudioPresent = false;
  const isExternalAudioPresent = false;
  const device = 'microphone';
  const isMuted = false;
  const label =
    !isLocalAudioPresent && !isExternalAudioPresent
      ? t('Start audio')
      : device === 'microphone'
        ? isMuted
          ? t('Unmute mic')
          : t('Mute mic')
        : isMuted
          ? t('Unmute {{device}}', { device })
          : t('Mute {{device}}', { device });

  const toggleMute = () => {
    console.log('Toggle mute');
  };

  return (
    <>
      <KeyboardShortcut shortcut="ToggleMic" onShortcut={toggleMute} />
      <ControlBarButton
        isFloatingControl={isFloatingControl}
        type="audio"
        label={label}
        onClick={toggleMute}
        a11yLabel={label}
        icon={
          <IconButton label={label} className={styles.controlButton} selected={!isMuted}>
            {/* TODO: Replace with MicrophoneActivity */}
            <MicrophoneSolidIcon />
          </IconButton>
        }
      />
    </>
  );
};

export default AudioControl;
