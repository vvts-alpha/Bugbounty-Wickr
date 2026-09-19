import { secondsToMilliseconds } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import useLatestCallback from '@/hooks/useLatestCallback';
import { toError } from '@/utils/error';

type TimeUpdateHandler = (time: number, duration: number) => void;

export const useAudioPlayer = () => {
  const audioElement = useRef<HTMLAudioElement>();
  const timeUpdateHandler = useRef<TimeUpdateHandler>();
  const audioData = useRef<Blob>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    return () => {
      stop();
      timeUpdateHandler.current = undefined;
    };
  }, []);

  const onTimeUpdate = (handler: TimeUpdateHandler) => {
    timeUpdateHandler.current = handler;
  };

  const start = useLatestCallback(async (deviceId: string, data: Blob) => {
    try {
      if (audioElement.current && data === audioData.current) {
        await (audioElement.current as any).setSinkId?.(deviceId);
        audioElement.current.play();
        return;
      }
      const audioUrl = URL.createObjectURL(data);
      const audio = new Audio(audioUrl);
      await (audio as any).setSinkId?.(deviceId);
      audioElement.current = audio;
      audioData.current = data;

      audio.ontimeupdate = () => {
        timeUpdateHandler.current?.(
          secondsToMilliseconds(audio.currentTime),
          secondsToMilliseconds(audio.duration)
        );
      };

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        stop();
        setError(new Error('Unexpected error, playing stopped'));
      };

      audio.onplaying = () => {
        setIsPlaying(true);
      };

      audio.onpause = () => {
        setIsPlaying(false);
      };

      audio.play();
    } catch (error) {
      stop();
      setError(toError(error));
    }
  });

  const pause = useLatestCallback(() => {
    try {
      audioElement.current?.pause();
    } catch (error) {
      setError(toError(error));
    }
  });

  const stop = useLatestCallback(() => {
    try {
      pause();
      if (audioElement.current) {
        audioElement.current.currentTime = 0;
      }
    } catch (error) {
      setError(toError(error));
    }
  });

  return {
    start,
    pause,
    stop,
    isPlaying,
    error,
    onTimeUpdate,
  };
};
