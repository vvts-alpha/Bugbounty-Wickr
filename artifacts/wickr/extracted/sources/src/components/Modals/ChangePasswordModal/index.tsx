import { FormEvent, useMemo, useState } from 'react';
import {
  Button,
  FormField,
  Modal,
  ModalBody,
  ModalHeader,
  PrimaryButton,
  SpinnerIcon,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { attemptChangePassword } from '@/store/thunks/identity';
import { closeModal, openAlertModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

const ChangePasswordModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const [currentPassword, setCurrentPassword] = useState('');
  const [shouldShowCurrentPassword, setShouldShowCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [shouldShowNewPassword, setShouldShowNewPassword] = useState(false);
  const passwordHelp = useSetting('passwordHelp');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [shouldShowConfirmPassword, setShouldShowConfirmPassword] = useState(false);
  const passwordRegex = useSetting('passwordRegex');
  const newPasswordValid = useMemo(() => {
    const validator = new RegExp(passwordRegex);
    return validator.test(newPassword);
  }, [passwordRegex, newPassword]);
  // change password can take a while
  const [waitingForResult, setWaitingForResult] = useState(false);
  const [currentPasswordIncorrect, setCurrentPasswordIncorrect] = useState(false);
  const [showNewPasswordSameAsOldError, setShowNewPasswordSameAsOldError] = useState(false);

  const handleClose = () => dispatch(closeModal('ChangePasswordModal'));

  const showNotice = (errMsg: string) => {
    dispatch(
      openAlertModal({
        title: t('Notice'),
        body: errMsg,
      })
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setWaitingForResult(true);
    dispatch(attemptChangePassword({ oldPassword: currentPassword, newPassword }))
      .unwrap()
      .then(
        (res) => {
          setWaitingForResult(false);
          if (res.status) {
            handleClose();
            showNotice(t('Your password has been changed.'));
          } else if (res.forceLogout) {
            // no-op
            // https://code.amazon.com/packages/WickrDesktopApp/blobs/a8250d8dfac7f54d5c9ef0da509f5f364d07fd82/--/clients/enterprise/wickrquickmain.cpp#L3501
          } else if (res.errorCode === 'currentPasswordIncorrect') {
            setCurrentPasswordIncorrect(true);
          } else if (res.errorCode === 'newPasswordSameAsOld') {
            setShowNewPasswordSameAsOldError(true);
          } else if (res.errorCode === 'writingDeviceEncryption') {
            showNotice(t('There was a problem writing device encryption information'));
          } else if (res.errorCode === 'internalFailure') {
            showNotice(t('Internal Failure'));
          } else if (res.errorCode === 'aesDecryptionError') {
            showNotice(t('There was a decryption error while processing the request.'));
          } else if (res.errorCode === 'passwordAttemptsReached') {
            showNotice(t('Invalid password attempts has been exceeded'));
          } else {
            showNotice(res.errorCode);
          }
        },
        () => {
          // no-op on error
        }
      );
  };

  return (
    <Modal closeLabel={t('Close')} onClose={handleClose}>
      <ModalHeader title={t('Change Password')} backButton />
      <ModalBody>
        <form onSubmit={handleSubmit} className={styles.fullWidth}>
          <div className={styles.fieldsContainer}>
            <div className={styles.field}>
              <FormField
                className={styles.fullWidth}
                fieldName="input"
                fieldProps={{
                  showClear: false,
                  type: shouldShowCurrentPassword ? 'text' : 'password',
                }}
                label={t('Current Password')}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setCurrentPasswordIncorrect(false);
                }}
                value={currentPassword}
                hasError={currentPasswordIncorrect}
                errorContent={t('The current password you entered is incorrect')}
              />
              <Button onClick={() => setShouldShowCurrentPassword(!shouldShowCurrentPassword)}>
                {shouldShowCurrentPassword ? t('Hide') : t('Show')}
              </Button>
            </div>
            <div className={styles.field}>
              <FormField
                className={styles.fullWidth}
                fieldName="input"
                fieldProps={{
                  showClear: false,
                  type: shouldShowNewPassword ? 'text' : 'password',
                }}
                label={t('New Password')}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setShowNewPasswordSameAsOldError(false);
                }}
                value={newPassword}
                infoContent={newPasswordValid ? '' : passwordHelp}
                hasError={showNewPasswordSameAsOldError}
                errorContent={t('The new password must be different from the old password')}
              />
              <Button onClick={() => setShouldShowNewPassword(!shouldShowNewPassword)}>
                {shouldShowNewPassword ? t('Hide') : t('Show')}
              </Button>
            </div>
            <div className={styles.field}>
              <FormField
                className={styles.fullWidth}
                fieldName="input"
                fieldProps={{
                  showClear: false,
                  type: shouldShowConfirmPassword ? 'text' : 'password',
                }}
                label={t('Confirm password')}
                onChange={(e) => setConfirmPassword(e.target.value)}
                value={confirmPassword}
                hasError={
                  confirmPassword.length >= newPassword.length && confirmPassword !== newPassword
                }
                errorContent={t('The passwords do not match')}
              />
              <Button onClick={() => setShouldShowConfirmPassword(!shouldShowConfirmPassword)}>
                {shouldShowConfirmPassword ? t('Hide') : t('Show')}
              </Button>
            </div>
          </div>
          <div className={styles.submitContainer}>
            <PrimaryButton
              type="submit"
              aria-disabled={!newPasswordValid || newPassword !== confirmPassword}
            >
              {t('Submit')}
              {waitingForResult && <SpinnerIcon />}
            </PrimaryButton>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
};

export default ChangePasswordModal;
