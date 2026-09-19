import { BrowserQRCodeSvgWriter } from '@zxing/browser';
import { EncodeHintType, QRCodeDecoderErrorCorrectionLevel } from '@zxing/library';
import { FC, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { Button, CodeMarkIcon, Heading, QRCodeIcon, Tab, Tabs } from '@/componentlibrary';
import useConst from '@/hooks/useConst';
import { useAppTranslation } from '@/lib/i18n';

import { generateSigninRoute } from '@/signin/routes';
import { selectSigninDevAuthKey, selectSigninDeviceVerifyKey } from '@/signin/signinSelectors';
import { setSigninDeviceVerifyKey } from '@/signin/signinSlice';
import { requestDeviceInfo } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';
import { pushModal } from '@/store/slices/modal';
import { processOnboardingDeviceVerifyKey } from '@/utils/strings';
import styles from './styles.module.less';

enum TransferDataTab {
  ScanCode = 0,
  EnterCode = 1,
}

const QR_CODE_SIZE = 150;
// Use medium correction level: https://code.amazon.com/packages/WickrDesktopApp/blobs/7ece1fc4cc2d1fa46f8de9443e8bca7b2d67d75a/--/clients/enterprise/qml/Settings/TwoFASettingsDetail.qml#L304
const QR_CODE_HINTS = new Map([
  [EncodeHintType.ERROR_CORRECTION, QRCodeDecoderErrorCorrectionLevel.M],
]);

const TransferData: FC = () => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<TransferDataTab>(TransferDataTab.ScanCode);
  const { t } = useAppTranslation();
  const qrCodeWriter = useConst(() => new BrowserQRCodeSvgWriter());
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCodeContent = useAppSelector(selectSigninDevAuthKey);

  useEffect(() => {
    if (!qrCodeContent || !qrRef.current) {
      return;
    }

    qrCodeWriter.writeToDom(
      qrRef.current,
      qrCodeContent,
      QR_CODE_SIZE,
      QR_CODE_SIZE,
      QR_CODE_HINTS
    );

    return () => {
      qrRef.current?.querySelectorAll('svg').forEach((svg) => svg.remove());
    };
  }, [qrCodeContent, qrRef, activeTab]);

  // TODO: implement this env setting API. When this is true, manual code entry option is available.
  const deviceSyncAltSecEnabled = true;

  const deviceVerifyKey = useAppSelector(selectSigninDeviceVerifyKey);
  const { mainKey, subKey } = processOnboardingDeviceVerifyKey(deviceVerifyKey);

  useEffect(() => {
    // Automatically switch to enter code tab when we receive a manual code
    if (deviceVerifyKey) {
      setActiveTab(TransferDataTab.EnterCode);
    }
  }, [deviceVerifyKey]);

  const handleSelectTab = (tab: TransferDataTab) => {
    setActiveTab(tab);
  };

  const handleResendNotification = () => {
    dispatch(requestDeviceInfo());

    if (deviceVerifyKey) {
      // Reset manual code as requesting device info gives us a new one
      dispatch(setSigninDeviceVerifyKey(''));
    }
  };

  const handleBack = () => {
    dispatch(pushModal({ name: 'ResetAppModal', params: { variant: 'signin' } }));
  };

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton onClick={handleBack} />
        <Heading level={1}>{t('Transfer account and messages')}</Heading>
      </PageHeader>
      <PageBody className={styles.pageBody}>
        <p>
          {deviceSyncAltSecEnabled
            ? t(
                'We sent a notification to your other devices. Open the app on one of these devices and scan the QR code or enter the code manually.'
              )
            : t(
                'We sent a notification to your other devices. Open the app on one of these devices and scan the QR code.'
              )}
        </p>
        <div className={styles.codeContainer}>
          {deviceSyncAltSecEnabled && (
            <Tabs
              selectedLabel={t('selected')}
              onSelectTab={handleSelectTab}
              activeTab={activeTab}
              variant="bar"
            >
              <Tab
                index={TransferDataTab.ScanCode}
                className={styles.tabsButtonWrapper}
                ariaLabel={t('Scan QR code')}
              >
                <QRCodeIcon />
                {t('Scan QR code')}
              </Tab>
              <Tab
                index={TransferDataTab.EnterCode}
                className={styles.tabsButtonWrapper}
                ariaLabel={t('Enter code')}
              >
                <CodeMarkIcon />
                {t('Enter code')}
              </Tab>
            </Tabs>
          )}
          {activeTab === TransferDataTab.ScanCode ? (
            <>
              <div className={styles.qrCode} ref={qrRef}></div>
              <Button className={styles.optionButton} onClick={handleResendNotification}>
                {t('Resend notification')}
              </Button>
            </>
          ) : (
            <>
              <div className={styles.manualCodeText}>
                {deviceVerifyKey
                  ? t('Complete this code on your other device to verify sign-in.')
                  : t(
                      'On your other device approve sign-in attempt and choose to enter code manually.'
                    )}
              </div>
              {deviceVerifyKey && (
                <>
                  <div className={styles.keyContainer}>
                    <div className={styles.mainKey}>{mainKey}</div>
                    <div>{subKey}</div>
                  </div>
                  <Button className={styles.optionButton} onClick={handleResendNotification}>
                    {t('Resend notification')}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
        <div className={styles.continueLinkContainer}>
          <NavLink to={generateSigninRoute.continueWithoutTransferring()}>
            {t('Continue without transferring')}
          </NavLink>
        </div>
      </PageBody>
    </Page>
  );
};

export default TransferData;
