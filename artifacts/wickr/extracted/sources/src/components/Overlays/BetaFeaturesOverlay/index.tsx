import SettingItem from '../SettingItem';
import { List, PanelOverlay, Toggle, PrimaryButton, Button } from '@/componentlibrary';
import useChangeEffect from '@/hooks/useChangeEffect';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { pushModal } from '@/store/slices/modal';
import { mlsAction } from '@/store/thunks/convos';
import { openModal } from '@/store/thunks/modals';
import {
  testCrashReporting,
  updateDeveloperLogging,
  updateIsCallStatsEnabled,
  updateIsCleanAttachmentsEnabled,
  updateLoggingEmulateProduction,
  updateNightlyBetaRing,
  updateScreenShareWindowExclusion,
  updateSocksUDPCalling,
  updateSwitchboardDiagnostics,
  updateUiLoggingEnabled,
} from '@/store/thunks/settings';

export const DEFAULT_WEB_ADDRESS = 'qrc:/index.html';

export const BetaFeaturesOverlay = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const isPro = useSetting('isPro');
  const isBeta = useSetting('isBeta');
  const isAlpha = useSetting('isAlpha');
  const isNightlyBetaRingEnabled = useSetting('nightlyBetaRing');
  const popcornOverrideAddress = useSetting('popcornOverrideAddress');
  const webViewAddress = useSetting('webViewAddress') || DEFAULT_WEB_ADDRESS;
  const isLoggingEmulateProductionEnabled = useSetting('loggingEmulateProduction');
  const isDeveloperLoggingEnabled = useSetting('developerLogging');
  const isCallStatsEnabled = useSetting('isCallStatsEnabled');
  const isSwitchboardDiagnosticsEnabled = useSetting('switchboardDiagnostics');
  const isSocksUDPCallingEnabled = useSetting('socksUDPCalling');
  const isCleanAttachmentsEnabled = useSetting('isCleanAttachmentsEnabled');
  const uiLoggingEnabled = useSetting('uiLoggingEnabled');
  const screenShareWindowExclusion = useSetting('screenShareWindowExclusion');

  useChangeEffect(() => {
    if (webViewAddress) {
      let isCurrent = true;
      dispatch(
        openModal({
          name: 'ConfirmModal',
          params: {
            title: 'Reload App',
            body: `Would you like to reload with the new URL?\n${webViewAddress}`,
          },
        })
      )
        .unwrap()
        .then((confirmed) => {
          if (confirmed && isCurrent) {
            location.href = webViewAddress;
          }
        });

      return () => {
        isCurrent = false;
      };
    }
  }, [webViewAddress]);

  return (
    <PanelOverlay title={t('Beta Features')}>
      <List>
        {isPro && isBeta && (
          <SettingItem
            title={t('Nightly Beta Ring')}
            description={t(
              'Check this to get updates for the nightly build. Restart the app to take effect'
            )}
          >
            <Toggle
              label={t('Nightly Beta Ring')}
              checked={!!isNightlyBetaRingEnabled}
              onChange={() => {
                if (!isNightlyBetaRingEnabled) {
                  const proceed = confirm(
                    "OOPS! You probably didn't mean to turn this on." +
                      '\n\n' +
                      'Nightly beta ring is not meant for general consumption and should only be used by a small group of users. ' +
                      '\n\n' +
                      'Please contact the Desktop or Web team before proceeding. ' +
                      '\n\n' +
                      'Are you sure you want to proceed?'
                  );
                  if (!proceed) return;
                }
                dispatch(updateNightlyBetaRing(!isNightlyBetaRingEnabled));
              }}
            />
          </SettingItem>
        )}
        <SettingItem title={t('Enable Clean Attachments')}>
          <Toggle
            label={t('Enable Clean Attachments')}
            checked={isCleanAttachmentsEnabled}
            onChange={() => dispatch(updateIsCleanAttachmentsEnabled(!isCleanAttachmentsEnabled))}
          />
        </SettingItem>
        <SettingItem title={t('Popcorn Address')} description={popcornOverrideAddress}>
          <PrimaryButton
            onClick={() =>
              dispatch(
                pushModal({
                  name: 'ChangeAddressModal',
                  params: {
                    title: t('Popcorn Address'),
                    defaultAddress: '',
                    currentAddress: popcornOverrideAddress,
                    settingToUpdate: 'popcornOverrideAddress',
                  },
                })
              )
            }
          >
            {t('Change')}
          </PrimaryButton>
        </SettingItem>
        {isAlpha && (
          <SettingItem
            title={t('Emulate Production Logging')}
            description={t(
              'Check this to to provide method of inspection in non-production builds.'
            )}
          >
            <Toggle
              label={t('Emulate Production Logging')}
              checked={!!isLoggingEmulateProductionEnabled}
              onChange={() =>
                dispatch(updateLoggingEmulateProduction(!isLoggingEmulateProductionEnabled))
              }
            />
          </SettingItem>
        )}
        <SettingItem
          title={t('Developer Logging')}
          description={t(
            'When enabled, network traffic will be logged.  Restart the app after toggling this option.'
          )}
        >
          <Toggle
            label={t('Developer Logging')}
            checked={!!isDeveloperLoggingEnabled}
            onChange={() => dispatch(updateDeveloperLogging(!isDeveloperLoggingEnabled))}
          />
        </SettingItem>
        <SettingItem
          title={t('UI Webview Logging')}
          description={t('When enabled, UI webview logging will output to desktop client logs.')}
        >
          <Toggle
            label={t('UI Webview Logging')}
            checked={uiLoggingEnabled}
            onChange={() => dispatch(updateUiLoggingEnabled(!uiLoggingEnabled))}
          />
        </SettingItem>
        <SettingItem title={t('Enable Calling Statistics')}>
          <Toggle
            label={t('Enable Calling Statistics')}
            checked={!!isCallStatsEnabled}
            onChange={() => dispatch(updateIsCallStatsEnabled(!isCallStatsEnabled))}
          />
        </SettingItem>
        <SettingItem
          title={t('Enable Screen Share Window Exclusions')}
          description={t(
            'This will hide the main app window and the floating controls from other participants on a call when you are screensharing. This may crash on Windows. Not supported on Linux.'
          )}
        >
          <Toggle
            label={t('Enable Screen Share Window Exclusions')}
            checked={screenShareWindowExclusion}
            onChange={() => dispatch(updateScreenShareWindowExclusion(!screenShareWindowExclusion))}
          />
        </SettingItem>
        <SettingItem
          title={t('Switchboard Diagnostics')}
          description={t(
            'Enable switchboard diagnostics for session server socket connection. Please restart the app after changing this setting.'
          )}
        >
          <Toggle
            label={t('Switchboard Diagnostics')}
            checked={!!isSwitchboardDiagnosticsEnabled}
            onChange={() =>
              dispatch(updateSwitchboardDiagnostics(!isSwitchboardDiagnosticsEnabled))
            }
          />
        </SettingItem>
        <SettingItem
          title={t('Custom Web View Address (For development only)')}
          description={`${t('Specify the web address')}: ${webViewAddress}`}
        >
          <PrimaryButton
            onClick={() =>
              dispatch(
                pushModal({
                  name: 'ChangeAddressModal',
                  params: {
                    title: t('Web View Address'),
                    defaultAddress: DEFAULT_WEB_ADDRESS,
                    currentAddress: webViewAddress,
                    settingToUpdate: 'webViewAddress',
                  },
                })
              )
            }
          >
            {t('Change')}
          </PrimaryButton>
        </SettingItem>
        <SettingItem
          title={t('WOA UDP Calling')}
          description={t(
            'Experimental setting for calling team to test UDP calling via socksproxy. It may not work!'
          )}
        >
          <Toggle
            label={t('WOA UDP Calling')}
            checked={!!isSocksUDPCallingEnabled}
            onChange={() => dispatch(updateSocksUDPCalling(!isSocksUDPCallingEnabled))}
          />
        </SettingItem>
        <SettingItem
          title={t('Test Crash Reporting')}
          description={t('Clicking this button will crash this app. You have been warned!')}
        >
          <PrimaryButton onClick={() => dispatch(testCrashReporting())}>{t('Crash')}</PrimaryButton>
        </SettingItem>
        <SettingItem title="MLS Service Reset">
          <Button color="red" onClick={() => dispatch(mlsAction({ action: 'mlsServiceReset' }))}>
            Reset
          </Button>
        </SettingItem>
      </List>
    </PanelOverlay>
  );
};

export default BetaFeaturesOverlay;
