import { register } from 'extendable-media-recorder';
import { connect } from 'extendable-media-recorder-wav-encoder';
import { useEffect } from 'react';

export const MediaRecorderManager: React.FC = () => {
  const initializeMediaRecorder = async () => {
    await register(await connect());
  };

  useEffect(() => {
    initializeMediaRecorder();
  }, []);

  return null;
};
