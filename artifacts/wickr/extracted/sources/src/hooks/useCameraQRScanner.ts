import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { Result, DecodeHintType, BarcodeFormat } from '@zxing/library';
import { useEffect, useState } from 'react';
import { Logger } from '@/lib/logger';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectVideoDevicePermission, promptForMediaDevicePermission } from '@/store/slices/media';
import useConst from './useConst';
import useMounted from './useMounted';

const logger = new Logger('CameraQRScanner');

/**
 * This hook creates a media stream and continuously scans once per second for QR codes within it. If
 * a QR code is found, it returns the result and stops scanning. You can use the media stream to display the
 * user's camera in a `<video>` element.
 * @param constraints Optional constraints for the media stream. If provided, these constraints should be defined
 * outside the component or persisted in state, otherwise the hook might continuously re-render.
 * @param start Optional boolean to start scanning immediately. If not provided, you must call the returned
 * `start` function to start scanning.
 * @returns An object containing the media stream and QR code result (undefined if nothing has been found in the
 * last check). Use `getText()` on the result to get the QR code's text value.
 */
export default function useCameraQRScanner(
  constraints: MediaStreamConstraints = {
    video: true,
  },
  start = true
): {
  stream?: MediaStream;
  result?: Result;
  devices: MediaDeviceInfo[];
  setSelectedVideoDeviceId: (deviceId: string) => void;
  selectedVideoDeviceId?: string;
  start?: boolean;
} {
  const codeReader = useConst(() => {
    const hints = new Map();
    // only look for QR codes (skip other barcode formats). copied from qt.
    const formats = [BarcodeFormat.QR_CODE];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.TRY_HARDER, false);
    return new BrowserQRCodeReader(hints);
  });
  const [stream, setStream] = useState<MediaStream>();
  const [decoder, setDecoder] = useState<IScannerControls>();
  const [result, setResult] = useState<Result>();
  const videoPermission = useAppSelector(selectVideoDevicePermission);
  const isMounted = useMounted();
  const dispatch = useAppDispatch();
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>();

  const stop = (mediaStream?: MediaStream) => {
    mediaStream?.getTracks().forEach((track) => track.stop());
    decoder?.stop();
  };

  const getVideoDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    return (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === 'videoinput'
    );
  };

  const refreshCamera = async () => {
    try {
      const mediaConstraints = constraints;

      if (selectedVideoDeviceId) {
        mediaConstraints.video = {
          ...(typeof constraints.video === 'object' ? constraints.video : {}),
          deviceId: selectedVideoDeviceId,
        };
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      setStream(mediaStream);

      if (!isMounted()) {
        stop(mediaStream);
      }
    } catch (err) {
      logger.error(`Error getting user media stream.`, err);
    }
  };

  const refreshCodeReader = async () => {
    if (!stream) {
      return;
    }

    // Continuously check every second for QR codes in video stream
    setDecoder(
      await codeReader.decodeFromStream(stream, undefined, (result, err, controls) => {
        /**
         * Ignore error since it gives an error of code not
         * found every check if there is no QR code in the
         * video stream.
         */
        setResult(result);
      })
    );
  };

  useEffect(() => {
    if (start) {
      dispatch(promptForMediaDevicePermission({ audio: false, video: true }));
    }
  }, [start]);

  useEffect(() => {
    if (videoPermission === 'GRANTED' && videoDevices.length === 0) {
      // Get all video devices after permission is granted
      getVideoDevices().then((devices) => {
        setVideoDevices(devices);
        setSelectedVideoDeviceId(devices[0]?.deviceId);
      });
    }
  }, [videoPermission, videoDevices]);

  useEffect(() => {
    if (start && videoPermission === 'GRANTED' && selectedVideoDeviceId) {
      // Only refresh the camera stream if permissions are granted and a video device has been selected
      refreshCamera();
    }
  }, [start, videoPermission, constraints, selectedVideoDeviceId]);

  useEffect(() => {
    refreshCodeReader();
    return () => {
      stop(stream);
    };
  }, [stream]);

  return {
    stream,
    result,
    devices: videoDevices,
    setSelectedVideoDeviceId,
    selectedVideoDeviceId,
    start,
  };
}
