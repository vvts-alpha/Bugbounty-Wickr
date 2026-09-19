import { clsx } from 'clsx';

import { FormEvent, useState } from 'react';
import {
  Button,
  FormField,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectAddLinkModalParams } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

const AddLinkModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const params = useAppSelector(selectAddLinkModalParams);
  const [text, setText] = useState(params.text ?? '');
  const [link, setLink] = useState(params.link ?? '');

  const handleClose = () => dispatch(closeModal('AddLinkModal'));

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    dispatch(closeModal({ name: 'AddLinkModal', returnValue: { text, link } }));
  };

  return (
    <Modal onClose={handleClose} closeLabel={t('Close')}>
      <ModalHeader title={t('Compose.Link.AddLink')} />
      <form onSubmit={handleSave}>
        <ModalBody>
          <div className={styles.formFields}>
            <FormField
              fieldName="input"
              fieldProps={{
                showClear: false,
              }}
              label={t('Text')}
              onChange={(e) => setText(e.target.value)}
              value={text}
            />
            <FormField
              fieldName="input"
              fieldProps={{
                showClear: false,
              }}
              label={t('Compose.Link.Link')}
              onChange={(e) => setLink(e.target.value)}
              value={link}
            />
          </div>
        </ModalBody>
        <ModalButtonGroup>
          <Button className={clsx('closeMenu')} onClick={handleClose} bordered>
            {t('Cancel')}
          </Button>
          <Button color="primary" className={clsx('closeMenu')} type="submit">
            {t('Save')}
          </Button>
        </ModalButtonGroup>
      </form>
    </Modal>
  );
};

export default AddLinkModal;
