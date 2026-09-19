import { FC } from 'react';
import { Avatar } from '../../Avatar';
import {
  IconButton,
  Panel,
  PanelBody,
  CloseIcon,
  ExternalLink,
  List,
  AvatarCircleIcon,
  ContactsIcon,
  SupportIcon,
  UpdateIcon,
  ReferAFriendIcon,
  GearIcon,
  Button,
  PopOutIcon,
  ShieldIcon,
  ClockIcon,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { metrics } from '@/lib/metrics';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { useSetting } from '@/store/hooks/useSetting';
import {
  selectIsAdmin,
  selectIsAwsNetwork,
  selectNetworkInvitesAllowed,
} from '@/store/slices/account';
import { selectSelfUser } from '@/store/slices/identity';
import { pushModal } from '@/store/slices/modal';
import { selectActiveOverlay, setOverlay } from '@/store/slices/overlay';
import {
  clearPanelStack,
  MainMenuPanelArgs,
  PANEL_SIDES,
  popPanel,
  pushPanel,
  selectIsActivePanel,
} from '@/store/slices/panels';
import { selectShowSessionTimeoutMenuItem } from '@/store/slices/session';
import { quitApp, signOut } from '@/store/thunks/identity';
import { openModal } from '@/store/thunks/modals';
import { checkForUpdates, openAdminControls } from '@/store/thunks/settings';
import MainMenuItem from './MainMenuItem';

import styles from './styles.module.less';

export const MainMenuPanel: FC<MainMenuPanelArgs> = ({ name, closeIcon }) => {
  const side = PANEL_SIDES[name];
  const dispatch = useAppDispatch();
  const selfUser = useAppSelector(selectSelfUser);
  const { t } = useAppTranslation();
  const handleClose = () => dispatch(popPanel());
  const isActive = useAppSelectorExtra(selectIsActivePanel, name);
  const handleOutsideClick = () => isActive && dispatch(clearPanelStack());
  const appVersion = useSetting('appVersion');
  const activeOverlay = useAppSelector(selectActiveOverlay);
  const abortableDispatch = useAbortableDispatch();
  const checkForUpdatesSetting = useSetting('checkForUpdatesSetting');
  const isAutoUpdateSupported = useSetting('isAutoUpdateSupported');
  const isAdmin = useAppSelector(selectIsAdmin);
  const isAwsNetwork = useAppSelector(selectIsAwsNetwork);
  const allowNetworkInvites = useAppSelector(selectNetworkInvitesAllowed);
  const isEnterprise = useSetting('isEnterprise');
  const isGovCloudAdc = useSetting('isGovCloudAdcEnabled');
  const ssoEnabled = useSetting('ssoEnabled');
  const brandingLinks = useSetting('brandingLinks');
  const isComplianceConfigValid = useSetting('isComplianceConfigValid');
  const showSessionTimeoutMenuItem = useAppSelector(selectShowSessionTimeoutMenuItem);

  const handleSignOut = async () => {
    try {
      if (ssoEnabled) {
        const confirmation = await abortableDispatch(
          openModal({
            name: 'ConfirmModal',
            params: {
              title: t('Are you sure?'),
              body: t('This will log you out from all your devices.'),
              confirmText: t('Sign Out'),
            },
          })
        );
        if (confirmation) {
          dispatch(signOut());
        }
      } else {
        dispatch(signOut());
      }
    } catch {
      // no-op
    }
  };

  return (
    <Panel
      className={styles.mainMenuPanel}
      onClose={handleClose}
      side={side}
      onOutsideClick={handleOutsideClick}
      closeIcon={closeIcon}
    >
      <header className={styles.header}>
        <span className={styles.closeBtnWrapper}>
          <IconButton label={t('Close')} onClick={handleClose}>
            <CloseIcon size="1.25rem" />
          </IconButton>
        </span>
        {selfUser && (
          <>
            <Avatar size={62} userIdHash={selfUser.idHash} />
            <p className={styles.name}>{selfUser.name}</p>
            <p className={styles.network}>{selfUser.networkName}</p>
          </>
        )}
        {isComplianceConfigValid && (
          <>
            <div className={styles.dataRetentionIndicator}>
              <ShieldIcon />
              <span className={styles.drTitle}>{t('Data Retention Network')}</span>
            </div>
            <div className={styles.drContent}>
              {t(
                'Wickr cannot access any content on this network, and all conversations are end-to-end encrypted.'
              )}{' '}
              <ExternalLink showExternalLinkIcon href={brandingLinks?.complianceLearnMoreUrl}>
                {t('Learn more')}
              </ExternalLink>
            </div>
          </>
        )}
      </header>
      <PanelBody>
        <List>
          <MainMenuItem
            icon={<AvatarCircleIcon />}
            label={t('My Account')}
            onClick={() => dispatch(pushModal('MyAccountModal'))}
          />
          {isAdmin && !isAwsNetwork && (
            <MainMenuItem
              label={t('Admin Controls')}
              icon={<PopOutIcon />}
              onClick={() => dispatch(openAdminControls())}
            />
          )}
          {!selfUser?.isGuest && (
            <MainMenuItem
              icon={<ContactsIcon filled />}
              label={t('Contacts')}
              onClick={() => {
                dispatch(clearPanelStack());
                dispatch(pushPanel({ name: 'ContactsPanel' }));
              }}
            />
          )}
          <MainMenuItem
            icon={<GearIcon filled />}
            label={t('Settings')}
            onClick={() => dispatch(pushPanel({ name: 'SettingsPanel' }))}
          />
          {!isEnterprise && !selfUser?.isGuest && allowNetworkInvites && !isGovCloudAdc && (
            <MainMenuItem
              icon={<ReferAFriendIcon filled />}
              label={t('Invite to Team')}
              onClick={() => dispatch(pushModal('ReferAFriendModal'))}
            />
          )}
          <MainMenuItem
            icon={<SupportIcon />}
            label={t('Support')}
            selected={activeOverlay === 'Support'}
            onClick={() => dispatch(setOverlay('Support'))}
          />
          {isAutoUpdateSupported && checkForUpdatesSetting && (
            <MainMenuItem
              icon={<UpdateIcon filled />}
              label={t('Check For Updates')}
              onClick={() => dispatch(checkForUpdates())}
            />
          )}
          {showSessionTimeoutMenuItem && (
            <MainMenuItem
              icon={<ClockIcon />}
              label={t('Session Expiring')}
              onClick={() => {
                const segmentation = {
                  platform: 'desktop',
                };
                metrics.addMetrics('SessionTimeout:UserTriggered', { count: 1, segmentation });
                dispatch(pushModal('SessionExpiringModal'));
              }}
            />
          )}
        </List>
      </PanelBody>
      <footer className={styles.footer}>
        <Button bordered className={styles.quit} onClick={() => dispatch(quitApp())}>
          {t('Quit')}
        </Button>
        <Button className={styles.signOut} onClick={handleSignOut}>
          {t('Sign Out')}
        </Button>
        <ExternalLink className={styles.privacyNotice} href={brandingLinks?.privacyPolicyURL}>
          {t('Privacy Notice')}
        </ExternalLink>
        <p className={styles.buildInfo} aria-label={t('app version')}>
          {appVersion}
        </p>
      </footer>
    </Panel>
  );
};

export default MainMenuPanel;
