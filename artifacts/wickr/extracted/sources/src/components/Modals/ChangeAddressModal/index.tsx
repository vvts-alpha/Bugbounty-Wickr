import { FormEvent, useState } from 'react';
import {
  FormField,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  Button,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectChangeAddressModalParams } from '@/store/slices/modal';

import { closeModal } from '@/store/thunks/modals';
import { updatePopcornOverrideAddress, updateWebViewAddress } from '@/store/thunks/settings';
import styles from './styles.module.less';

const ChangeAddressModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const params = useAppSelector(selectChangeAddressModalParams);
  const [inputValue, setInputValue] = useState(params.currentAddress || params.defaultAddress);
  const updateSettingThunk =
    params.settingToUpdate === 'popcornOverrideAddress'
      ? updatePopcornOverrideAddress
      : updateWebViewAddress;

  const handleClose = () => {
    dispatch(closeModal('ChangeAddressModal'));
  };
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    dispatch(updateSettingThunk(inputValue));
    handleClose();
  };

  return (
    <Modal closeLabel={t('Close')} onClose={handleClose}>
      <ModalHeader title={params.title} />
      <ModalBody>
        <form className={styles.form} onSubmit={handleSubmit}>
          <FormField
            fieldName="input"
            fieldProps={{ showClear: false }}
            label={params.title}
            onChange={(event) => {
              setInputValue(event.target.value);
            }}
            value={inputValue}
          />
        </form>
      </ModalBody>
      <ModalButtonGroup className={styles.footer}>
        <Button
          bordered
          onClick={() => {
            dispatch(updateSettingThunk(params.defaultAddress));
            handleClose();
          }}
        >
          {t('Reset')}
        </Button>
        <div>
          <Button bordered onClick={handleClose}>
            {t('Cancel')}
          </Button>
          <Button color="primary" onClick={handleSubmit}>
            {t('OK')}
          </Button>
        </div>
      </ModalButtonGroup>
    </Modal>
  );
};

export default ChangeAddressModal;
