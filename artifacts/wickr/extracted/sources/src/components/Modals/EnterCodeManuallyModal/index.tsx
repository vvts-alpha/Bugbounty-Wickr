import { FormEvent, useEffect, useState } from 'react';
import {
  Button,
  FormField,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { deviceSyncActions } from '@/store/slices/deviceSync';
import { selectEnterCodeManuallyModalParams } from '@/store/slices/modal';
import { pushDeviceCode } from '@/store/thunks/identity';

import styles from './styles.module.less';

const MAX_ATTEMPTS = 3;

const EnterCodeManuallyModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const [code, setCode] = useState('');
  const { deviceSyncVerifyKey } = useAppSelector(selectEnterCodeManuallyModalParams);
  // skip first 6 chars then add space between every 6 chars. user will need to enter first 6 chars based on their other device
  const transformedString = deviceSyncVerifyKey
    .slice(6)
    .match(/.{1,6}/g)
    ?.join(' ');
  const [errorCount, setErrorCount] = useState(0);

  const handleClose = () => {
    dispatch(deviceSyncActions.closeEnterCodeManually());
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // verify code
    if (code === deviceSyncVerifyKey.slice(0, 6)) {
      // passing in empty object as the payload only includes an optional supportBackup field which can be left out by default
      dispatch(pushDeviceCode({}));
    } else {
      // error attempt
      setErrorCount(errorCount + 1);
    }
  };

  useEffect(() => {
    if (errorCount >= MAX_ATTEMPTS) {
      dispatch(deviceSyncActions.unableToVerifyCode());
    }
  }, [errorCount]);

  return (
    <Modal onClose={handleClose} closeLabel={t('Back')} size="md">
      <ModalHeader title={t('Enter code manually')} backButton />
      <form onSubmit={handleSubmit}>
        <ModalBody className={styles.body}>
          <p>
            {t(
              'Enter the first six characters to complete the code displayed on your new device. Verify the security of your connection by comparing the entire code with the code on your new device.'
            )}
          </p>

          <FormField
            className={styles.codeInput}
            fieldName="input"
            fieldProps={{
              showClear: false,
              spellCheck: false,
            }}
            label={t('Enter code')}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
            }}
            value={code}
            maxLength={6}
            infoContent={transformedString}
          />
          <span className={styles.errorText}>{errorCount > 0 ? t("Code doesn't match") : ''}</span>
        </ModalBody>
        <ModalButtonGroup>
          <Button
            className={styles.blueText}
            onClick={() => {
              dispatch(deviceSyncActions.codeDoesntMatch());
            }}
          >
            {t("Code doesn't match")}
          </Button>
          <PrimaryButton type="submit">{t('Continue')}</PrimaryButton>
        </ModalButtonGroup>
      </form>
    </Modal>
  );
};

export default EnterCodeManuallyModal;
