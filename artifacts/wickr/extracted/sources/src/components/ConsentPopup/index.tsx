import { useEffect, useRef, useState } from 'react';
import AWSWickrGovLogo from '../AWSWickrGovLogo';
import AWSWickrLogo from '../AWSWickrLogo';
import WickrEnterpriseLogo from '../WickrEnterpriseLogo';
import {
  Button,
  PrimaryButton,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
} from '@/componentlibrary';
import { KEY_CODES } from '@/componentlibrary/constants';
import trapFocus from '@/componentlibrary/utils/trap-focus';
import { MarkdownText } from '@/components/MarkdownText';
import useEventListener from '@/hooks/useEventListener';
import { useAppTranslation } from '@/lib/i18n';
import { metrics } from '@/lib/metrics';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { signOut } from '@/store/thunks/identity';
import { acknowledgeConsentPopup } from '@/store/thunks/settings';
import { openLink } from '@/store/thunks/ui';
import { asElement } from '@/utils/dom';
import { shouldShowLinkConfirmation } from '@/utils/links';
import styles from './ConsentPopup.module.less';

export const ConsentPopup = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const ssoEnabled = useSetting('ssoEnabled');
  const consentPopupConfig = useSetting('consentPopupConfig');
  const isEnterprise = useSetting('isEnterprise');
  const isGovCloudEnabled = useSetting('isGovCloudEnabled');
  const isGovCloudAdcEnabled = useSetting('isGovCloudAdcEnabled');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [pendingLink, setPendingLink] = useState<string | null>(null);

  const handleSignOut = () => {
    const segmentation = {
      platform: 'desktop',
    };
    if (ssoEnabled) {
      setShowSignOutConfirm(true);
    } else {
      metrics.addMetrics('Consent:SignedOut', { count: 1, segmentation });
      dispatch(signOut());
    }
  };

  const handleConfirmSignOut = () => {
    const segmentation = {
      platform: 'desktop',
    };
    metrics.addMetrics('Consent:SignedOut', { count: 1, segmentation });
    setShowSignOutConfirm(false);
    dispatch(signOut());
  };

  const handleCancelSignOut = () => {
    setShowSignOutConfirm(false);
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = asElement(e.target)?.closest('a');
    if (!anchor || !anchor.href) return;

    const url = new URL(anchor.href);
    if (url.protocol === 'qrc:') return;

    e.preventDefault();
    e.stopPropagation();

    if (shouldShowLinkConfirmation(anchor)) {
      setPendingLink(anchor.href);
    } else {
      dispatch(openLink({ link: anchor.href, showConfirmation: false }));
    }
  };

  const handleConfirmLink = () => {
    if (pendingLink) {
      dispatch(openLink({ link: pendingLink, showConfirmation: false }));
    }
    setPendingLink(null);
  };

  const handleCancelLink = () => {
    setPendingLink(null);
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const shouldShow = consentPopupConfig && !!consentPopupConfig.content;

  useEffect(() => {
    if (shouldShow) {
      buttonRef.current?.focus();

      const segmentation = {
        platform: 'desktop',
      };

      metrics.addMetrics('Consent:Shown', { count: 1, segmentation });
    }
  }, [shouldShow]);

  useEventListener(window, 'keydown', (e) => {
    if (e.key === KEY_CODES.TAB && contentRef.current) {
      trapFocus(e, contentRef.current);
    }
  });

  const handleAcknowledgeClick = () => {
    const segmentation = {
      platform: 'desktop',
    };
    metrics.addMetrics('Consent:Acknowledged', { count: 1, segmentation });

    dispatch(acknowledgeConsentPopup());
  };

  if (!shouldShow) return null;

  return (
    <div className={styles.overlay}>
      <div
        ref={contentRef}
        className={styles.content}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-popup-header"
        onClick={handleContentClick}
      >
        {isEnterprise ? (
          <WickrEnterpriseLogo />
        ) : isGovCloudEnabled || isGovCloudAdcEnabled ? (
          <AWSWickrGovLogo />
        ) : (
          <AWSWickrLogo />
        )}
        <div className={styles.adminBanner}>{t('Message from your network administrator')}</div>
        {consentPopupConfig.header && (
          <h1 id="consent-popup-header" className={styles.header}>
            {consentPopupConfig.header}
          </h1>
        )}
        <MarkdownText className={styles.body} text={consentPopupConfig.content} />
        <div className={styles.buttons}>
          <Button color="red" onClick={handleSignOut}>
            {t('Sign Out')}
          </Button>
          <PrimaryButton ref={buttonRef} onClick={handleAcknowledgeClick}>
            {consentPopupConfig.closeButtonLabel || t('I Acknowledge')}
          </PrimaryButton>
        </div>
      </div>
      {showSignOutConfirm && (
        <Modal variant="alert" onClose={handleCancelSignOut}>
          <ModalHeader title={t('Are you sure?')} />
          <ModalBody>{t('This will log you out from all your devices.')}</ModalBody>
          <ModalButtonGroup>
            <Button bordered onClick={handleCancelSignOut}>
              {t('Cancel')}
            </Button>
            <Button color="primary" onClick={handleConfirmSignOut}>
              {t('Sign Out')}
            </Button>
          </ModalButtonGroup>
        </Modal>
      )}
      {pendingLink && (
        <Modal variant="alert" onClose={handleCancelLink}>
          <ModalHeader title={t('You are leaving Wickr')} />
          <ModalBody>{t('Click continue to go to {{link}}', { link: pendingLink })}</ModalBody>
          <ModalButtonGroup>
            <Button bordered onClick={handleCancelLink}>
              {t('Cancel')}
            </Button>
            <Button color="primary" onClick={handleConfirmLink}>
              {t('Continue')}
            </Button>
          </ModalButtonGroup>
        </Modal>
      )}
    </div>
  );
};
