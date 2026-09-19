import { ChangeEvent, FC, SyntheticEvent, useEffect, useState } from 'react';
import { Panel, PanelBody, PanelHeader, Button, FormField } from '@/componentlibrary';
import { useCloseUnsavedPanel } from '@/hooks/useCloseUnsavedPanel';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelectorExtra } from '@/store';
import {
  clearPanelStack,
  EditContactPanelArgs,
  PANEL_SIDES,
  popPanel,
  selectIsActivePanel,
} from '@/store/slices/panels';
import { selectUserByIdHash } from '@/store/slices/users';
import { setUserCustomName } from '@/store/thunks/users';

import styles from './styles.module.less';

const MAX_CUSTOM_NAME_LENGTH = 150;

export const EditContactPanel: FC<EditContactPanelArgs> = ({
  name,
  userIdHash,
  currentName,
  closeIcon,
}) => {
  const { t } = useAppTranslation();
  const side = PANEL_SIDES[name];
  const dispatch = useAppDispatch();
  const panelIsActive = useAppSelectorExtra(selectIsActivePanel, name);
  const [inputValue, setInputValue] = useState(currentName);
  const user = useAppSelectorExtra(selectUserByIdHash, userIdHash);
  const originalName = user?.name ?? '';

  const [formChanged, setFormChanged] = useState(false);
  useEffect(() => {
    setFormChanged(currentName !== inputValue);
  }, [currentName, inputValue]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleClear = () => {
    dispatch(clearPanelStack());
  };

  /** e.preventDefault() is needed to stop the page from reloading on a button with type submit,
   * which is used in the panel. But it is not needed when pressing save from the
   * "Save Changes?" modal, so it is optional
   */
  const handleSubmit = (e?: SyntheticEvent) => {
    e?.preventDefault();
    dispatch(
      setUserCustomName({
        userHash: userIdHash,
        customName: inputValue.trim(),
      })
    );
  };

  const handleSubmitAndClose = (e?: SyntheticEvent) => {
    handleSubmit(e);
    dispatch(popPanel());
  };

  const handleSubmitAndClear = (e?: SyntheticEvent) => {
    handleSubmit(e);
    handleClear();
  };

  const closeUnsavedPanel = useCloseUnsavedPanel(formChanged, handleSubmitAndClose);
  const clearUnsavedPanel = useCloseUnsavedPanel(formChanged, handleSubmitAndClear, handleClear);
  const handleOutsideClick = async () => {
    panelIsActive && (await clearUnsavedPanel());
  };

  return (
    <Panel
      onClose={closeUnsavedPanel}
      onOutsideClick={handleOutsideClick}
      side={side}
      closeIcon={closeIcon}
    >
      <form onSubmit={handleSubmitAndClose}>
        <PanelHeader
          title={t('Edit Contact')}
          closeLabel={t('Close')}
          trailingElement={
            <Button color="primary" className={styles.save} type="submit">
              {t('Save')}
            </Button>
          }
        />
        <PanelBody className={styles.body}>
          <FormField
            fieldName="input"
            fieldProps={{
              placeholder: originalName,
              showClear: inputValue !== originalName,
            }}
            maxLength={MAX_CUSTOM_NAME_LENGTH}
            label={t('Name')}
            onChange={handleInputChange}
            value={inputValue}
          />
        </PanelBody>
      </form>
    </Panel>
  );
};
