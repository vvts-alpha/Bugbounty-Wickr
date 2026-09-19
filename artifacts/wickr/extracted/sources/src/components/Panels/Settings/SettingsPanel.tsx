import { FC, useEffect } from 'react';
import MainMenuItem from '../MainMenu/MainMenuItem';
import {
  CloseIcon,
  IconButton,
  Panel,
  PanelBody,
  Heading,
  NotificationsIcon,
  CallSettingsIcon,
  DeviceManagementIcon,
  ConnectivityIcon,
  AppearanceIcon,
  WickrLogoIcon,
  SecurityIcon,
  TranslationIcon,
  BotIcon,
  List,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSetting } from '@/store/hooks/useSetting';
import { clearOverlay, selectActiveOverlay, setOverlay } from '@/store/slices/overlay';
import {
  clearPanelStack,
  setPanelStack,
  selectIsActivePanel,
  PANEL_SIDES,
  SettingsPanelArgs,
} from '@/store/slices/panels';

import styles from './styles.module.less';

export const SettingsPanel: FC<SettingsPanelArgs> = ({ name, closeIcon }) => {
  const side = PANEL_SIDES[name];
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const activeOverlay = useAppSelector(selectActiveOverlay);
  const handleClose = () => dispatch(clearPanelStack());
  const isActive = useAppSelectorExtra(selectIsActivePanel, name);
  const isBeta = useSetting('isBeta');
  const isAlpha = useSetting('isAlpha');
  const isTranslationAvailable = useSetting('isTranslationAvailable');
  const wickrAIEnabled = useFeature('WickrAI');
  const handleOutsideClick = () => isActive && dispatch(clearPanelStack());

  // These are overlays which are openable directly without going through the settings panel
  // We shouldn't clear them because when directly opening them we would want them and the settings panel to show up together
  const noClear = ['SupportLogging', 'Translation'];
  useEffect(() => {
    dispatch(setPanelStack({ name }));
    if (activeOverlay && !noClear.includes(activeOverlay)) {
      dispatch(clearOverlay());
    }
  }, []);

  return (
    <Panel
      onClose={handleClose}
      side={side}
      onOutsideClick={handleOutsideClick}
      closeIcon={closeIcon}
    >
      <Heading level={3} as="h1" className={styles.header}>
        <IconButton label={t('Close')} onClick={handleClose} className={styles.leftIcon}>
          <CloseIcon size="1.25rem" />
        </IconButton>
        {t('Settings')}
      </Heading>

      <PanelBody>
        <List className={styles.list}>
          <MainMenuItem
            icon={<NotificationsIcon filled />}
            label={t('Notifications')}
            onClick={() => dispatch(setOverlay('Notifications'))}
            selected={activeOverlay === 'Notifications'}
          />
          <MainMenuItem
            icon={<SecurityIcon />}
            label={t('Privacy & Safety')}
            onClick={() => dispatch(setOverlay('PrivacyAndSafety'))}
            selected={
              activeOverlay !== null &&
              [
                'PrivacyAndSafety',
                'DataRetention',
                'BlockedUsers',
                'TwoFA',
                'LocationSharing',
                'SupportLogging',
              ].includes(activeOverlay)
            }
          />
          <MainMenuItem
            icon={<CallSettingsIcon />}
            label={t('Calling')}
            onClick={() => dispatch(setOverlay('Calling'))}
            selected={activeOverlay === 'Calling'}
          />
          <MainMenuItem
            icon={<DeviceManagementIcon />}
            label={t('Device Management')}
            onClick={() => dispatch(setOverlay('DeviceManagement'))}
            selected={activeOverlay === 'DeviceManagement'}
          />
          <MainMenuItem
            icon={<ConnectivityIcon />}
            label={t('Connectivity')}
            onClick={() => dispatch(setOverlay('Connectivity'))}
            selected={activeOverlay === 'Connectivity'}
          />
          <MainMenuItem
            icon={<AppearanceIcon />}
            label={t('Appearance')}
            onClick={() => dispatch(setOverlay('Appearance'))}
            selected={activeOverlay === 'Appearance'}
          />
          {(isBeta || isAlpha) && (
            <MainMenuItem
              icon={<WickrLogoIcon />}
              label={t('Beta Features')}
              onClick={() => dispatch(setOverlay('BetaFeatures'))}
              selected={activeOverlay === 'BetaFeatures'}
            />
          )}
          {isTranslationAvailable && (
            <MainMenuItem
              icon={<TranslationIcon />}
              label={t('Translation')}
              onClick={() => dispatch(setOverlay('Translation'))}
              selected={activeOverlay === 'Translation'}
            />
          )}
          {wickrAIEnabled && (
            <MainMenuItem
              icon={<BotIcon />}
              label="Wickr AI"
              onClick={() => dispatch(setOverlay('WickrAI'))}
              selected={activeOverlay === 'WickrAI'}
            />
          )}
        </List>
      </PanelBody>
    </Panel>
  );
};

export default SettingsPanel;
