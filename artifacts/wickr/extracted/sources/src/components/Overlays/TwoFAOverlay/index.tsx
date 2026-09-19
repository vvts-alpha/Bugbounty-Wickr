import { BrowserQRCodeSvgWriter } from '@zxing/browser';
import { EncodeHintType, QRCodeDecoderErrorCorrectionLevel } from '@zxing/library';
import { FormEvent, useEffect, useRef, useState } from 'react';
import SettingItem from '../SettingItem';
import { useWebChannel } from '@/apis/webChannel/context';
import { FormField, Heading, List, PanelOverlay, PrimaryButton, Toggle } from '@/componentlibrary';
import useConst from '@/hooks/useConst';
import useLatestCallback from '@/hooks/useLatestCallback';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { setOverlay } from '@/store/slices/overlay';
import { openAlertModal } from '@/store/thunks/modals';
import { update2FAActive, updateIs2FAEnabled } from '@/store/thunks/settings';

import styles from './styles.module.less';

const QR_CODE_SIZE = 250;
const VERIFY_CODE_LENGTH = 6;

export const TwoFAOverlay = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const is2FAEnabled = useSetting('is2FAEnabled');
  const qrCodeWriter = useConst(() => new BrowserQRCodeSvgWriter());
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [input, setInputValue] = useState('');
  // user needs to enter correct code after enabling/disabling 2fa to actually change the setting. "lags" behind is2FAEnabled
  const is2FAActive = useSetting('is2FAActive');
  const [twoFAResult, setTwoFAResult] = useState('');
  const [isReady, setIsReady] = useState(false);
  const { wickrSettings } = useWebChannel();

  const setupNotComplete = useLatestCallback(() => is2FAEnabled && !is2FAActive);

  useEffect(() => {
    const dispatchErrorModal = (errMsg: string) => {
      dispatch(
        openAlertModal({
          title: errMsg,
          body: t('Please contact an administrator if the problem continues.'),
        })
      );
    };

    const unsubs: Array<() => void> = [
      wickrSettings.connect('is2FAEnabledChanged', async (isError: boolean, secret: string) => {
        const is2FAEnabled = await wickrSettings.getIs2FAEnabled();
        if (isError && is2FAEnabled) {
          dispatchErrorModal(t('QR Code retrieval failed for Two-factor authorization setup.'));
        } else if (is2FAEnabled && qrCodeRef.current) {
          // use medium correction level: https://code.amazon.com/packages/WickrDesktopApp/blobs/7ece1fc4cc2d1fa46f8de9443e8bca7b2d67d75a/--/clients/enterprise/qml/Settings/TwoFASettingsDetail.qml#L304
          const hints = new Map([
            [EncodeHintType.ERROR_CORRECTION, QRCodeDecoderErrorCorrectionLevel.M],
          ]);
          qrCodeWriter.writeToDom(qrCodeRef.current, secret, QR_CODE_SIZE, QR_CODE_SIZE, hints);
        }
      }),
      wickrSettings.connect('is2FAActiveChanged', async (isError: boolean) => {
        const is2FAActive = await wickrSettings.getIs2FAActive();
        if (isError) {
          if (is2FAActive) {
            dispatchErrorModal(t('2FA Deactivation failed, invalid verification code.'));
          } else {
            dispatchErrorModal(t('2FA Activation failed, invalid verification code.'));
          }
        } else {
          if (is2FAActive) {
            setTwoFAResult(t('You have successfully enabled Two-factor Authentication'));
          } else {
            setTwoFAResult(t('You have successfully disabled Two-factor Authentication'));
          }
        }
      }),
    ];

    setIsReady(true);

    return () => {
      if (setupNotComplete()) {
        dispatch(updateIs2FAEnabled(false));
      }
      unsubs.forEach((unsub) => unsub());
    };
  }, [dispatch, qrCodeWriter, wickrSettings, setupNotComplete, t]);

  const verifyCode = (e: FormEvent) => {
    e.preventDefault();
    if (input.length >= VERIFY_CODE_LENGTH) {
      if (is2FAEnabled && !is2FAActive) {
        dispatch(update2FAActive({ flag: true, code: input }));
      } else if (!is2FAEnabled && is2FAActive) {
        dispatch(update2FAActive({ flag: false, code: input }));
      }
    }
  };

  return (
    <PanelOverlay
      onClose={() => dispatch(setOverlay('PrivacyAndSafety'))}
      closeLabel={t('Back')}
      className={styles.twoFAOverlay}
      title={t('Two-factor Authentication')}
    >
      <List>
        <SettingItem
          title={t('Activate Two-factor Authentication')}
          description={t('Two-factor authentication will disable auto-login feature')}
        >
          <Toggle
            label={t('Activate Two-factor Authentication')}
            checked={is2FAEnabled}
            aria-disabled={!isReady}
            onChange={() => {
              dispatch(updateIs2FAEnabled(!is2FAEnabled));
            }}
          />
        </SettingItem>
      </List>
      {is2FAEnabled !== is2FAActive && (
        // user is attempting to either activate or deactivate 2FA
        <>
          <div className={styles.container}>
            {is2FAEnabled ? (
              // enabled but not activated. show setup instructions
              <>
                <div>
                  <Heading level={3} className={styles.instructionsTitle}>
                    {t('Instructions')}
                  </Heading>
                  <List ordered className={styles.instructions}>
                    <div>{t('Install and setup Google Authenticator on your mobile device.')}</div>
                    <div>
                      {t(
                        'Synchronize time in Google Authenticator settings and ensure your mobile device is using network time.'
                      )}
                    </div>
                    <div>
                      {t('Scan this QR code with Google Authenticator on your mobile device.')}
                    </div>
                    <div>{t('Enter the code from Google Authenticator below.')}</div>
                  </List>
                </div>
                <div ref={qrCodeRef}></div>
              </>
            ) : (
              <Heading level={3} className={styles.instructionsTitle}>
                {t(
                  'To disable two-factor authentication, you will need to provide the current code'
                )}
              </Heading>
            )}
          </div>
          <form onSubmit={verifyCode} className={styles.container}>
            <FormField
              fieldName="input"
              fieldProps={{ showClear: false, type: 'number' }}
              label={t('Enter the code from Google Authenticator')}
              onChange={(event) => {
                const input = event.target.value;
                if (/^\d*$/.test(input)) setInputValue(event.target.value);
              }}
              value={input}
            />
            <PrimaryButton
              className={styles.verifyCode}
              aria-disabled={input.length < VERIFY_CODE_LENGTH}
              type="submit"
            >
              {t('Verify Code')}
            </PrimaryButton>
          </form>
        </>
      )}
      {twoFAResult.length > 0 && (
        <div className={styles.container}>
          <Heading level={3} className={styles.instructionsTitle}>
            {twoFAResult}
          </Heading>
        </div>
      )}
    </PanelOverlay>
  );
};

export default TwoFAOverlay;
