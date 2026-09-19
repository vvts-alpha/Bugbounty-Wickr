import { BrowserQRCodeSvgWriter } from '@zxing/browser';
import { FC, useEffect, useRef } from 'react';
import { Button, SpinnerIcon } from '@/componentlibrary';
import { LearnMoreVerificationButton } from '@/components/Panels/VerifyContactPanel/VerifyContactPanel';
import useConst from '@/hooks/useConst';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { useAppDispatch } from '@/store';
import { downloadFile } from '@/store/thunks/files';
import { VerificationFingerprint } from '@/store/thunks/users';
import { svgToBase64 } from '@/utils/image';

import styles from './styles.module.less';

type Props = {
  fingerprint?: VerificationFingerprint;
};

const QR_CODE_SIZE = 250;

const logger = new Logger('QR Code');

const QRCode: FC<Props> = ({ fingerprint }) => {
  const { t } = useAppTranslation();
  const qrCodeWriter = useConst(() => new BrowserQRCodeSvgWriter());
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (fingerprint && qrCodeRef.current) {
      qrCodeWriter.writeToDom(
        qrCodeRef.current,
        fingerprint.qrFingerPrint,
        QR_CODE_SIZE,
        QR_CODE_SIZE
      );
    }
    return () => {
      qrCodeRef.current?.replaceChildren();
    };
  }, [fingerprint]);

  const handleSaveQRCode = () => {
    const svgElement = qrCodeRef.current?.querySelector('svg');
    if (!svgElement) {
      return logger.error('Not QR code svg found to download.');
    }

    svgToBase64(svgElement, QR_CODE_SIZE)
      .then((dataUrl) => {
        const base64Data = dataUrl.split(',')[1];
        dispatch(
          downloadFile({
            data: base64Data,
            filename: 'qr-code.png',
            mimeType: 'image/png',
          })
        );
      })
      .catch((error) => {
        logger.error('Error converting SVG to base64:', error);
      });
  };

  return (
    <>
      <div className={styles.qrCodeWrapper}>
        <div ref={qrCodeRef} className={styles.qrCode} />
        <SpinnerIcon width={QR_CODE_SIZE} height={QR_CODE_SIZE} className={styles.spinner} />
      </div>
      <p className={styles.instructions}>
        {t(
          'Other users can verify your identity by scanning this QR code from your profile on their Wickr device.'
        )}
      </p>
      <LearnMoreVerificationButton />
      <Button
        shape="rounded"
        className={styles.btn}
        wrapperClassName={styles.btnWrapper}
        onClick={handleSaveQRCode}
      >
        {t('Save QR')}
      </Button>
    </>
  );
};

export default QRCode;
