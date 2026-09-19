import { useEffect, useRef } from 'react';
import { Button, Modal, ModalBody, ModalHeader } from '@/componentlibrary';
import AccessibleSelect from '@/componentlibrary/Select/AccessibleSelect';
import useCameraQRScanner from '@/hooks/useCameraQRScanner';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectScanQRCodeModalParams } from '@/store/slices/modal';
import { resetSlice } from '@/store/slices/shared';
import { pushDeviceQRScan, switchToCode } from '@/store/thunks/identity';

import styles from './styles.module.less';

const QR_SCANNER_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    aspectRatio: 1,
  },
};

const ScanQRCodeModal = () => {
  const cameraRef = useRef<HTMLVideoElement>(null);
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const {
    stream: mediaStream,
    result,
    devices,
    setSelectedVideoDeviceId,
    selectedVideoDeviceId,
  } = useCameraQRScanner(QR_SCANNER_MEDIA_CONSTRAINTS);
  const { newDeviceKey } = useAppSelector(selectScanQRCodeModalParams);

  const handleQRCodeScanned = (code: string) => {
    dispatch(pushDeviceQRScan({ pubKeyBytes: code }));
  };

  useEffect(() => {
    if (cameraRef.current && mediaStream) {
      cameraRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  useEffect(() => {
    const text = result?.getText();
    if (text) {
      handleQRCodeScanned(text);
    }
  }, [result]);

  const handleClose = () => {
    dispatch(resetSlice('deviceSync'));
  };

  const handleEnterCodeManuallyClicked = () => {
    dispatch(switchToCode({ pubKeyBytes: newDeviceKey }));
  };

  return (
    <Modal onClose={handleClose} closeLabel={t('Close')} size="md">
      <ModalHeader title={t('Scan QR Code')} />
      <ModalBody className={styles.body}>
        <p>{t('Scan the QR code to transfer your account and messages.')}</p>
        <div className={styles.camera}>
          <video ref={cameraRef} autoPlay playsInline width={250} height={250} />
          <div className={styles.overlay} />
        </div>
        {devices.length > 0 && (
          <AccessibleSelect
            className={styles.selectContainer}
            options={devices.map((d) => ({ label: d.label, value: d.deviceId }))}
            onChange={(value) => setSelectedVideoDeviceId(value.toString())}
            selectedOption={{
              value: selectedVideoDeviceId ?? devices[0]?.deviceId,
              label:
                devices.find((d) => d.deviceId === selectedVideoDeviceId)?.label ??
                devices[0]?.label,
            }}
            offset={[0, 0]}
            menuClassName={styles.selectMenu}
            label={t('Video Input Device')}
          />
        )}
        {newDeviceKey && (
          <Button
            bordered
            className={styles.enterCodeManuallyButton}
            onClick={handleEnterCodeManuallyClicked}
          >
            {t('Enter code manually')}
          </Button>
        )}
      </ModalBody>
    </Modal>
  );
};

export default ScanQRCodeModal;
