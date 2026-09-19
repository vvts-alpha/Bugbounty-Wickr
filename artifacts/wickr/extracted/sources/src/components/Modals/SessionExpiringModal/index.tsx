import { useEffect, useState } from 'react';
import { useWebChannel } from '@/apis/webChannel/context';
import {
  Button,
  CautionIcon,
  FormField,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  Paragraph,
} from '@/componentlibrary';
import { useExpirationInterval } from '@/components/Convo/ExpirationIntervalContext';
import { useAppTranslation } from '@/lib/i18n';
import { metrics } from '@/lib/metrics';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectSessionExpiresAt,
  selectReauthErrorMessage,
  selectReauthIsSubmitting,
  setReauthErrorMessage,
} from '@/store/slices/session';
import { closeModal } from '@/store/thunks/modals';
import { reauthenticateSession } from '@/store/thunks/session';

import styles from './styles.module.less';

const SessionExpiringModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const { environmentMgr } = useWebChannel();
  const sessionExpiresAt = useAppSelector(selectSessionExpiresAt);
  const errorMessage = useAppSelector(selectReauthErrorMessage);
  const isSubmitting = useAppSelector(selectReauthIsSubmitting);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [password, setPassword] = useState('');
  const [firstWarningSeconds, setFirstWarningSeconds] = useState(0);
  const [secondWarningSeconds, setSecondWarningSeconds] = useState(0);

  useEffect(() => {
    const fetchThresholds = async () => {
      const first = await environmentMgr.getSessionFirstWarningSeconds();
      const second = await environmentMgr.getSessionSecondWarningSeconds();
      setFirstWarningSeconds(first);
      setSecondWarningSeconds(second);
    };
    void fetchThresholds();
  }, [environmentMgr]);

  useExpirationInterval((nowSkewCorrected) => {
    if (!sessionExpiresAt) {
      setRemainingSeconds(0);
      return;
    }
    const msRemaining = sessionExpiresAt - nowSkewCorrected;
    setRemainingSeconds(Math.max(0, Math.floor(msRemaining / 1000)));
  });

  const handleClose = () => {
    dispatch(setReauthErrorMessage(''));
    dispatch(closeModal('SessionExpiringModal'));

    // Fire appropriate dismiss metric based on remaining time
    if (remainingSeconds <= firstWarningSeconds) {
      if (remainingSeconds > secondWarningSeconds) {
        metrics.addMetrics('SessionTimeout:WarningDismissed', { count: 1 });
      } else {
        metrics.addMetrics('SessionTimeout:UrgentDismissed', { count: 1 });
      }
    }
  };

  // This feature does NOT support SSO
  const handleReauthenticate = () => {
    dispatch(reauthenticateSession(password));
  };

  const formatRemainingTime = (totalSeconds: number): string => {
    if (totalSeconds <= 60) {
      return t('less than 1 minute remaining');
    }

    const totalMinutes = Math.ceil(totalSeconds / 60);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(t('{{count}} days', { count: days }));
    if (hours > 0) parts.push(t('{{count}} hours', { count: hours }));
    if (minutes > 0) parts.push(t('{{count}} minutes', { count: minutes }));

    return t('{{time}} remaining', { time: parts.join(' ') });
  };

  return (
    <Modal variant="alert" onClose={handleClose} closeOnOutsideClick={false}>
      <ModalHeader title={t('Session Expiring')} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleReauthenticate();
        }}
      >
        <ModalBody className={styles.body}>
          <Paragraph className={styles.description}>
            <CautionIcon variant="error" />
            {t('Your session is about to expire.')}
          </Paragraph>
          <div className={styles.countdown} aria-atomic="true" aria-live="polite">
            {formatRemainingTime(remainingSeconds)}
          </div>
          <Paragraph>{t('Enter your password to stay signed in.')}</Paragraph>
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
              type: 'password',
              placeholder: t('Enter your password'),
            }}
            label={t('Password')}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errorMessage) {
                dispatch(setReauthErrorMessage(''));
              }
            }}
            value={password}
            hasError={!!errorMessage}
            errorContent={errorMessage}
          />
        </ModalBody>
        <ModalButtonGroup>
          <Button bordered onClick={handleClose}>
            {t('ModertorTip.Ignore')}
          </Button>
          <Button
            color="primary"
            type="submit"
            isPending={isSubmitting}
            aria-disabled={isSubmitting}
          >
            {t('Re-authenticate')}
          </Button>
        </ModalButtonGroup>
      </form>
    </Modal>
  );
};

export default SessionExpiringModal;
