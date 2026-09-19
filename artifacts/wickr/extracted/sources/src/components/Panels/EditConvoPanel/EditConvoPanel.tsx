import { clsx } from 'clsx';
import { ChangeEvent, FC, SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { ConvoTimeSelector } from '../../ConvoSettingSelectors/ConvoTimeSelector';
import {
  Panel,
  PanelBody,
  PanelHeader,
  PrimaryButton,
  FormField,
  Heading,
} from '@/componentlibrary';
import TdfTagsContainer from '@/components/TdfTags/TagsContainer';
import { useCloseUnsavedPanel } from '@/hooks/useCloseUnsavedPanel';
import useConst from '@/hooks/useConst';
import useConvoExpirationTimes from '@/hooks/useConvoExpirationTimes';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelectorExtra, useAppSelector } from '@/store';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { useSetting } from '@/store/hooks/useSetting';
import {
  selectActiveConvoCanAddUser,
  selectActiveConvoCanModifyEphemerality,
  selectActiveConvoCanModifyTitleDescription,
  selectActiveConvoCanModifyUserRole,
  selectActiveConvoCanRemoveUser,
  selectConvoDescription,
  selectConvoMembers,
  selectConvoModerators,
  selectConvoTitle,
  selectConvoType,
} from '@/store/slices/convos';
import { selectActiveModal } from '@/store/slices/modal';
import {
  clearPanelStack,
  EditConvoPanelArgs,
  PANEL_SIDES,
  popPanel,
  selectIsActivePanel,
} from '@/store/slices/panels';
import { editConvo } from '@/store/thunks/convos';
import { openModal } from '@/store/thunks/modals';
import { contactSort } from '@/utils/sort';
import { ConvoExpandableMembersList } from './ConvoExpandableMembersList';

import styles from './styles.module.less';

const MAX_CONVO_DETAIL_LENGTH = 256;

export const EditConvoPanel: FC<EditConvoPanelArgs> = ({ name, convoId, closeIcon }) => {
  const { t } = useAppTranslation();
  const side = PANEL_SIDES[name];
  const dispatch = useAppDispatch();
  const abortableDispatch = useAbortableDispatch();
  const panelIsActive = useAppSelectorExtra(selectIsActivePanel, name);
  const activeModal = useAppSelector(selectActiveModal);
  const convoType = useAppSelectorExtra(selectConvoType, convoId);
  const convoTitle = useAppSelectorExtra(selectConvoTitle, convoId);
  const originalConvoTitle = useConst(() => convoTitle);
  const convoDescription = useAppSelectorExtra(selectConvoDescription, convoId) || '';
  const canModifyEphemerality = useAppSelector(selectActiveConvoCanModifyEphemerality);
  const canModifyUserRole = useAppSelector(selectActiveConvoCanModifyUserRole);
  const canAddUsers = useAppSelector(selectActiveConvoCanAddUser);
  const canRemoveUsers = useAppSelector(selectActiveConvoCanRemoveUser);
  const canModifyTitleDescription = useAppSelector(selectActiveConvoCanModifyTitleDescription);
  const tdfEnabled = useSetting('tdfEnabled');

  const [titleInputValue, setTitleInputValue] = useState(convoTitle);
  const [descriptionInputValue, setDescriptionInputValue] = useState(convoDescription);
  const { displayedTTL, displayedBOR } = useConvoExpirationTimes(convoId);
  const [unsavedTTL, setUnsavedTTL] = useState(displayedTTL);
  const [unsavedBOR, setUnsavedBOR] = useState(displayedBOR);

  const [formChanged, setFormChanged] = useState(false);
  useEffect(() => {
    const changed =
      displayedTTL !== unsavedTTL ||
      displayedBOR !== unsavedBOR ||
      originalConvoTitle !== titleInputValue ||
      convoDescription !== descriptionInputValue;

    setFormChanged(changed);
  }, [
    displayedTTL,
    unsavedTTL,
    displayedBOR,
    unsavedBOR,
    originalConvoTitle,
    titleInputValue,
    convoDescription,
    descriptionInputValue,
  ]);

  const expirationTimerButtonId = 'EditConvoModal-ExpirationButton';
  const burnOnReadButtonId = 'EditConvoModal-BorButton';

  const convoModerators = useAppSelectorExtra(selectConvoModerators, convoId);
  const sortedConvoModerators = useMemo(
    () => convoModerators.filter((m) => !m.isBot && m.id).sort(contactSort),
    [convoModerators]
  );
  const convoMembers = useAppSelectorExtra(selectConvoMembers, convoId);
  const sortedConvoMembers = useMemo(
    () =>
      convoMembers
        .filter((m) => !m.isBot && m.id)
        // Include moderators if it is a group, otherwise filter out to include in mods section
        .filter((m) => (convoType === WickrConvoType.Group ? true : !m.moderator))
        .sort(contactSort),
    [convoMembers, convoType]
  );
  const sortedConvoBots = useMemo(
    () => convoMembers.filter((m) => m.isBot && m.id).sort(contactSort),
    [convoMembers]
  );

  const handleTitleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitleInputValue(event.target.value);
  };

  const handleDescriptionInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDescriptionInputValue(event.target.value);
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
      editConvo({
        vgroupId: convoId,
        destructionTime: unsavedTTL,
        burnOnRead: unsavedBOR,
        title: titleInputValue,
        description: descriptionInputValue,
        // TODO: remove/add mods and users
      })
    );
  };

  const handleSubmitAndClose = (e?: SyntheticEvent) => {
    if (formChanged) {
      handleSubmit(e);
    }
    dispatch(popPanel());
  };

  const handleSubmitAndClear = (e?: SyntheticEvent) => {
    handleSubmit(e);
    handleClear();
  };

  const handleCloseUnsavedPanel = useCloseUnsavedPanel(formChanged, handleSubmitAndClose);
  const handleClearUnsavedPanel = useCloseUnsavedPanel(
    formChanged,
    handleSubmitAndClear,
    handleClear
  );
  const handleOutsideClick = async () => {
    if (panelIsActive && !activeModal) {
      await handleClearUnsavedPanel();
    }
  };

  const handleTTLChange = (time: number) => {
    setUnsavedTTL(time);
    // Burn on read should not be great the TTL
    if (time < unsavedBOR) setUnsavedBOR(time);
  };

  const handleBORChange = (time: number) => {
    setUnsavedBOR(time);
  };

  return (
    <Panel
      onClose={handleCloseUnsavedPanel}
      onOutsideClick={handleOutsideClick}
      side={side}
      closeIcon={closeIcon}
    >
      <form onSubmit={handleSubmitAndClose}>
        <PanelHeader
          title={t(convoType === WickrConvoType.Room ? 'Room Details' : 'Group Details')}
          closeLabel={t('Close')}
          trailingElement={
            formChanged ? (
              <PrimaryButton type="submit" className={styles.save}>
                {t('Save')}
              </PrimaryButton>
            ) : undefined
          }
        />
        <PanelBody className={styles.body}>
          {canModifyTitleDescription ? (
            <>
              <FormField
                className={styles.inputField}
                fieldName="input"
                fieldProps={{
                  showClear: false,
                }}
                maxLength={MAX_CONVO_DETAIL_LENGTH}
                label={t(convoType === WickrConvoType.Room ? 'Room Name' : 'Group Name')}
                onChange={handleTitleInputChange}
                value={titleInputValue}
              />
              <FormField
                className={clsx(styles.inputField, { [styles.descriptionInputField]: tdfEnabled })}
                fieldName="input"
                fieldProps={{
                  showClear: false,
                }}
                maxLength={MAX_CONVO_DETAIL_LENGTH}
                label={t('Description')}
                onChange={handleDescriptionInputChange}
                value={descriptionInputValue}
              />
              {tdfEnabled && convoType === WickrConvoType.Room && (
                <TdfTagsContainer
                  description={descriptionInputValue}
                  className={styles.tdfContent}
                />
              )}
            </>
          ) : (
            <div className={styles.titleDescription}>
              <Heading level={3} className={styles.title}>
                {convoTitle}
              </Heading>
              {convoDescription && <div className={styles.description}>{convoDescription}</div>}
            </div>
          )}
          {canModifyEphemerality && (
            <>
              <ConvoTimeSelector
                convoId={convoId}
                convoType={convoType === WickrConvoType.Room ? 'room' : 'dmOrGroup'}
                expirationType="ttl"
                onChange={handleTTLChange}
                value={unsavedTTL}
                id={expirationTimerButtonId}
                onClickCustom={async () => {
                  try {
                    const value = await abortableDispatch(
                      openModal({
                        name: 'CustomConvoTimerModal',
                        params: {
                          type: 'ttl',
                          vGroupId: convoId,
                          initialValue: unsavedTTL,
                          originElementId: expirationTimerButtonId,
                        },
                      })
                    );

                    if (typeof value === 'number') {
                      handleTTLChange(value);
                    }
                  } catch {
                    // no-op
                  }
                }}
              />
              <ConvoTimeSelector
                convoId={convoId}
                expirationType="bor"
                convoType={convoType === WickrConvoType.Room ? 'room' : 'dmOrGroup'}
                onChange={handleBORChange}
                value={unsavedBOR}
                id={burnOnReadButtonId}
                currentTTL={unsavedTTL}
                onClickCustom={async () => {
                  try {
                    const value = await abortableDispatch(
                      openModal({
                        name: 'CustomConvoTimerModal',
                        params: {
                          type: 'bor',
                          vGroupId: convoId,
                          initialValue: unsavedBOR,
                          originElementId: burnOnReadButtonId,
                          currentTTL: unsavedTTL,
                        },
                      })
                    );

                    if (typeof value === 'number') {
                      handleBORChange(value);
                    }
                  } catch {
                    // no-op
                  }
                }}
              />
            </>
          )}
          <ConvoExpandableMembersList
            label={t('Moderators')}
            showAddButton={canModifyUserRole}
            isModeratorList={true}
            members={sortedConvoModerators}
            vGroupId={convoId}
            visible={convoType === WickrConvoType.Room}
          />
          <ConvoExpandableMembersList
            label={t('Members')}
            showAddButton={canAddUsers || canRemoveUsers}
            members={sortedConvoMembers}
            vGroupId={convoId}
          />
          <ConvoExpandableMembersList
            label={t('Bots')}
            showAddButton={false}
            members={sortedConvoBots}
            vGroupId={convoId}
            subtext={t(
              convoType === WickrConvoType.Room
                ? 'Bots may be able to see your messages and record activity in this room.'
                : 'Bots may be able to see your messages and record activity in this group.'
            )}
          />
        </PanelBody>
      </form>
    </Panel>
  );
};
