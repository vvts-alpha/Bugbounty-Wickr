import React from 'react';
import { ModalBody, ModalButtonGroup, ModalHeader, PrimaryButton } from '@/componentlibrary';
import Modal from '@/componentlibrary/Modal';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectSdkErrorModalParams } from '@/store/slices/modal';
import { dequeueSdkError } from '@/store/slices/modal/modalSlice';
import { insertLinebreaks } from '@/utils/sdkErrors';

const SdkErrorModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();

  const params = useAppSelector(selectSdkErrorModalParams);
  const errorInfo = params?.errors?.[0];

  if (!errorInfo) {
    return null;
  }

  const handleClose = () => {
    dispatch(dequeueSdkError());
  };

  return (
    <Modal variant="alert" onClose={handleClose}>
      <ModalHeader title={errorInfo.formattedTitle} />
      <ModalBody>{insertLinebreaks(errorInfo.formattedBody)}</ModalBody>
      <ModalButtonGroup>
        <PrimaryButton onClick={handleClose}>{t('OK')}</PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default SdkErrorModal;
