import { clsx } from 'clsx';
import { millisecondsToSeconds, secondsToMilliseconds } from 'date-fns';
import React, { useRef, useState } from 'react';
import ProgressBar from '../ComposeBox/VoiceRecordingBox/ProgressBar';
import { wickrWebEndpoints } from '@/apis/webFetch/endpoints';
import { Tooltip } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { isForwardedMessage, WickrMessage } from '@/lib/protobuf/messages';
import { toDurationString } from '@/utils/date';

import styles from './ConvoMessageAudioContent.module.less';

interface ConvoMessageAudioContentProps {
  message: WickrMessage;
}

const ConvoMessageAudioContent: React.FC<ConvoMessageAudioContentProps> = ({ message }) => {
  const { t } = useAppTranslation();
  const audioSrc = wickrWebEndpoints.messageAudio(message.vGroupID, message.msgId);
  const audioEl = useRef<HTMLAudioElement>(null);
  const audio = audioEl.current;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioElDurationSeconds = audio?.duration;
  const audioDurationMs =
    message.file?.audioMetadata?.duration || secondsToMilliseconds(audioElDurationSeconds || 0);
  const isForwarded = isForwardedMessage(message);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  };

  const handlePlayPauseClick = () => {
    if (audio) {
      if (audio.paused) audio.play();
      else audio.pause();
    }
  };

  const label = audio && audio.paused ? t('Play') : t('Pause');

  return (
    <div className={styles.audioContent}>
      <audio
        src={audioSrc}
        onPlay={handlePlay}
        onEnded={handlePause}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        ref={audioEl}
      />
      <Tooltip tip={label}>
        <button
          onClick={handlePlayPauseClick}
          className={clsx(styles.playPauseBtn, { [styles.isForwarded]: isForwarded })}
          aria-label={label}
        >
          <ProgressBar
            isInProgress={isPlaying}
            variant="circle"
            progress={(currentTime / millisecondsToSeconds(audioDurationMs)) * 100}
          />
        </button>
      </Tooltip>
      <span>
        {toDurationString(isPlaying ? secondsToMilliseconds(currentTime) : audioDurationMs, {
          showHour: false,
        })}
      </span>
    </div>
  );
};

export default ConvoMessageAudioContent;
