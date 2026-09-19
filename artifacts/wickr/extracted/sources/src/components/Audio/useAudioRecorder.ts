import { IMediaRecorder, MediaRecorder } from 'extendable-media-recorder';
import { useEffect, useRef, useState } from 'react';
import useLatestCallback from '@/hooks/useLatestCallback';
import { toError } from '@/utils/error';
import { SafeIntervalCanceller, safeInterval } from '@/utils/safeInterval';

type TimeUpdateHandler = (time: number) => void;

export const useAudioRecorder = () => {
  const mediaRecorder = useRef<IMediaRecorder>();
  // a interval to report recording time to parent component
  const timeIntervalCanceller = useRef<SafeIntervalCanceller>();
  const timeUpdateHandler = useRef<TimeUpdateHandler>();
  const mediaStream = useRef<MediaStream>();
  const [data, setData] = useState<Blob | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [isRecording, setIsRecording] = useState(false);
  const [startTime, setStartTime] = useState<number>();
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      stop();
      timeUpdateHandler.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      setStartTime(Date.now());
    } else if (startTime) {
      setDuration(Date.now() - startTime);
    }
  }, [isRecording]);

  const onTimeUpdate = (handler: TimeUpdateHandler) => {
    timeUpdateHandler.current = handler;
  };

  const start = useLatestCallback(async (deviceId: string) => {
    // No op if mediaRecorder is still active
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      return;
    }
    try {
      mediaStream.current = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId, sampleSize: 16, channelCount: 1, sampleRate: 8000 },
      });
      const recorder = new MediaRecorder(mediaStream.current, {
        mimeType: 'audio/wav',
      });
      const audioChunks: Blob[] = [];
      setData(undefined);
      recorder.ondataavailable = (ev: BlobEvent) => {
        audioChunks.push(ev.data);
      };
      recorder.onstart = () => {
        setIsRecording(true);
      };
      recorder.onstop = () => {
        try {
          stop();
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          setData(audioBlob);
        } catch (error) {
          setError(toError(error));
        }
      };
      recorder.onerror = () => {
        stop();
        setError(new Error('Unexpected error, recording stopped'));
      };
      mediaRecorder.current = recorder;
      recorder.start();
      const startTime = Date.now();
      timeIntervalCanceller.current = safeInterval(() => {
        timeUpdateHandler.current?.(Date.now() - startTime);
      }, 50);
    } catch (error) {
      stop();
      setError(toError(error));
    }
  });

  const stop = useLatestCallback(() => {
    try {
      timeIntervalCanceller.current?.();
      mediaRecorder.current?.stop();
      setIsRecording(false);
      mediaStream.current?.getTracks().forEach((t) => t.stop());
    } catch (error) {
      setError(toError(error));
    }
  });

  return {
    start,
    stop,
    data,
    duration,
    isRecording,
    error,
    onTimeUpdate,
  };
};
