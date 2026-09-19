import { clsx } from 'clsx';
import React, { useEffect, useRef, useState } from 'react';
import { useAudioPlayer } from '../../Audio/useAudioPlayer';
import { useAudioRecorder } from '../../Audio/useAudioRecorder';
import { CancelIcon, IconButton, PauseIcon, PlayIcon, StopIcon, Tooltip } from '@/componentlibrary';
import useSafeInterval from '@/hooks/useSafeInterval';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  promptForMediaDevicePermission,
  selectAudioInputDeviceId,
  selectAudioInputDevicePermission,
  selectAudioOutputDeviceId,
} from '@/store/slices/media';
import { setVoiceMessage } from '@/store/slices/uiChat';
import { openAlertModal } from '@/store/thunks/modals';
import { toDurationString } from '@/utils/date';
import InProgressIndicator from './InProgressIndicator';
import ProgressBar from './ProgressBar';

import styles from './VoiceRecordingBox.module.less';

const MIN_VOICE_MESSAGE_LENGTH = 2_000;
const MAX_VOICE_MESSAGE_LENGTH = 60_000;

interface VoiceRecordingBoxProps {
  onClose?: () => void;
  onDurationChange?: (seconds: number) => void;
  onRecordingStatusChange?: (isVoiceRecording: boolean) => void;
}
const VoiceRecordingBox: React.FC<VoiceRecordingBoxProps> = ({
  onClose,
  onDurationChange,
  onRecordingStatusChange,
}) => {
  const audioPermission = useAppSelector(selectAudioInputDevicePermission);
  const audioInputDeviceId = useAppSelector(selectAudioInputDeviceId);
  const audioOutputDeviceId = useAppSelector(selectAudioOutputDeviceId);
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();

  const recorder = useAudioRecorder();
  const player = useAudioPlayer();

  const [audioTime, setAudioTime] = useState(0);
  const [playingProgress, setPlayingProgress] = useState(0);

  const prevDurationSecondsRef = useRef(0);

  recorder.onTimeUpdate((timeMs: number) => {
    setAudioTime(timeMs);

    if (timeMs >= MAX_VOICE_MESSAGE_LENGTH) {
      dispatch(
        openAlertModal({
          title: t('Compose.VoiceRecordingBox.MaxLengthDialog.Title'),
          body: t('Compose.VoiceRecordingBox.MaxLengthDialog.Message'),
        })
      );
      recorder.stop();
    }

    if (onDurationChange) {
      const seconds = Math.floor(timeMs * 1000);
      if (prevDurationSecondsRef.current !== seconds) {
        onDurationChange(seconds);
        prevDurationSecondsRef.current = seconds;
      }
    }
  });

  player.onTimeUpdate((time: number, duration: number) => {
    const progress = duration !== 0 ? (time * 100) / duration : 0;
    setPlayingProgress(Math.round(progress));
    setAudioTime(time);
  });

  useEffect(() => {
    if (audioPermission === 'GRANTED') {
      recorder.start(audioInputDeviceId);
    }
  }, [audioPermission]);

  useEffect(() => {
    dispatch(promptForMediaDevicePermission({ audio: true, video: false }));
  }, []);

  useEffect(() => {
    dispatch(
      setVoiceMessage({
        duration: recorder.duration,
        data: recorder.data,
      })
    );

    return () => {
      dispatch(setVoiceMessage());
    };
  }, [recorder.duration, recorder.data]);

  useEffect(() => {
    // Recorder is stopped with data but recording is too short
    if (!recorder.isRecording && recorder.data && recorder.duration < MIN_VOICE_MESSAGE_LENGTH) {
      dispatch(
        openAlertModal({
          title: t('Compose.VoiceRecordingBox.TooShortDialog.Title'),
          body: t('Compose.VoiceRecordingBox.TooShortDialog.Message'),
        })
      );
      onClose?.();
    }
  }, [recorder.isRecording, recorder.duration, recorder.data]);

  useEffect(() => {
    onRecordingStatusChange?.(recorder.isRecording);
  }, [recorder.isRecording]);

  const handleRecorderStop = () => {
    recorder.stop();
  };

  // Blink minutes/seconds separator so you can tell when you are recording before 1s elapses
  const [minutes, seconds] = toDurationString(audioTime, { showHour: false }).split(':');
  const [showColon, setShowColon] = useState(false);
  useSafeInterval(() => setShowColon((show) => !show), 500);

  return (
    <div className={styles.voiceRecordingBox}>
      {!recorder.data && !recorder.error ? (
        <>
          <span>{t('Compose.VoiceRecordingBox.Recording')}</span>
          <div className={styles.statusContainer}>
            <InProgressIndicator />
          </div>
          <Tooltip tip={t('Stop')}>
            <IconButton label={t('Stop')} onClick={handleRecorderStop}>
              <StopIcon />
            </IconButton>
          </Tooltip>
        </>
      ) : (
        <>
          <Tooltip tip={t('Cancel')}>
            <IconButton label={t('Cancel')} onClick={onClose}>
              <CancelIcon />
            </IconButton>
          </Tooltip>
          <div className={styles.statusContainer}>
            <ProgressBar variant="line" progress={playingProgress} />
          </div>
          {player.isPlaying ? (
            <Tooltip tip={t('Pause')}>
              <IconButton label={t('Pause')} onClick={() => player.pause()}>
                <PauseIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip tip={t('Play')}>
              <IconButton
                label={t('Play')}
                onClick={() => player.start(audioOutputDeviceId, recorder.data as Blob)}
              >
                <PlayIcon />
              </IconButton>
            </Tooltip>
          )}
        </>
      )}
      <span className={styles.timeContainer}>
        {minutes}
        <span className={clsx({ [styles.invisible]: recorder.isRecording && !showColon })}>:</span>
        {seconds}
      </span>
    </div>
  );
};

export default VoiceRecordingBox;
