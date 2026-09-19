import { FC, useEffect, useRef, useState } from 'react';
import { Button, CameraIcon } from '@/componentlibrary';
import AccessibleSelect from '@/componentlibrary/Select/AccessibleSelect';
import { LearnMoreVerificationButton } from '@/components/Panels/VerifyContactPanel/VerifyContactPanel';
import useCameraQRScanner from '@/hooks/useCameraQRScanner';
import { useAppTranslation } from '@/lib/i18n';
import AppTrans from '@/lib/i18n/AppTrans';
import { useAppDispatch, useAppSelector } from '@/store';

import { selectActiveModal } from '@/store/slices/modal';
import { openAlertModal } from '@/store/thunks/modals';
import { VerificationFingerprint, verifyUser } from '@/store/thunks/users';

import styles from './styles.module.less';

const QR_SCANNER_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    aspectRatio: 1,
  },
};

type QRScannerProps = {
  userId: string;
  fingerprint?: VerificationFingerprint;
};

const QRScanner: FC<QRScannerProps> = ({ userId, fingerprint }) => {
  const cameraRef = useRef<HTMLVideoElement>(null);
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const [started, setStarted] = useState(false);
  const {
    stream: mediaStream,
    result,
    devices,
    setSelectedVideoDeviceId,
    selectedVideoDeviceId,
  } = useCameraQRScanner(QR_SCANNER_MEDIA_CONSTRAINTS, started);
  const activeModal = useAppSelector(selectActiveModal);
  const alertModalIsActive = activeModal?.name === 'AlertModal';

  const showErrorModal = () => {
    dispatch(
      openAlertModal({
        title: t('Incorrect fingerprint'),
        body: t("The security codes do not match. Please check your contact's name and try again."),
      })
    );
  };

  const handleQRCodeScanned = (code: string) => {
    if (!fingerprint || code !== fingerprint.securityCode) {
      showErrorModal();
      return;
    }

    dispatch(
      verifyUser({
        userId,
        verify: true,
        shownCode: code,
      })
    );
  };

  useEffect(() => {
    if (started && cameraRef.current && mediaStream) {
      cameraRef.current.srcObject = mediaStream;
    }
  }, [started && mediaStream]);

  useEffect(() => {
    if (alertModalIsActive) {
      // Do not process QR codes while the error modal is active
      return;
    }

    const text = result?.getText();
    if (text) {
      handleQRCodeScanned(text);
    }
  }, [result, alertModalIsActive]);

  return (
    <>
      <div className={styles.cameraContainer}>
        <div className={styles.camera}>
          {started ? (
            <video ref={cameraRef} autoPlay playsInline width={250} height={250} />
          ) : (
            <Button
              wrapperClassName={styles.cameraCoverWrapper}
              className={styles.cameraCoverBtn}
              onClick={() => setStarted(true)}
            >
              {t('Enable camera')}
              <CameraIcon />
            </Button>
          )}
          <div className={styles.overlay} />
        </div>
      </div>
      {devices.length > 0 && (
        <AccessibleSelect
          label={t('Video Input Device')}
          className={styles.selectContainer}
          options={devices.map((d) => ({ label: d.label, value: d.deviceId }))}
          onChange={(value) => setSelectedVideoDeviceId(value.toString())}
          selectedOption={{
            value: selectedVideoDeviceId ?? devices[0]?.deviceId,
            label:
              devices.find((d) => d.deviceId === selectedVideoDeviceId)?.label ?? devices[0]?.label,
          }}
          offset={[18, -21]}
          menuClassName={styles.selectMenu}
        />
      )}
      <p className={styles.text}>
        <AppTrans
          i18nKey="Scan the QR code belonging to <0>{{email}}</0> to verify the security of your end to end encryption."
          values={{ email: userId }}
        >
          <span className={styles.bold}></span>
        </AppTrans>
      </p>
      <LearnMoreVerificationButton />
    </>
  );
};

export default QRScanner;
