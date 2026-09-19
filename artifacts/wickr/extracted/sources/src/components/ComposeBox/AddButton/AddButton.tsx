import React, { useEffect, useReducer, useRef } from 'react';
import { QuickResponses } from '../QuickResponses/QuickResponses';
import { ACTIONS_ICON_SIZE } from '../constants';
import {
  Tooltip,
  IconButton,
  AddIcon,
  PopOverItem,
  AttachmentIcon,
  LocationIcon,
  QuickResponseIcon,
  PopOver,
} from '@/componentlibrary';
import { KeyboardShortcut } from '@/components/KeyboardShortcut';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectQuickResponses } from '@/store/slices/account';
import { selectActiveConvoId } from '@/store/slices/shared';
import {
  selectActiveReplyOrEditMsg,
  selectIsMessagesTabActive,
  setActiveReplyOrEditMsg,
} from '@/store/slices/uiChat';
import { sendTextMessage, uploadFile } from '@/store/thunks/messages';
import { shareCurrentLocation } from '@/store/thunks/ui';

export const ITEM_ICON_SIZE = '18px';

export const AddButton: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const isMessagesActive = useAppSelector(selectIsMessagesTabActive);

  const hasQuickResponses = useAppSelector(selectQuickResponses).length > 0;
  const [quickResponsesOpen, setQuickResponsesOpen] = useReducer(
    (state: boolean, action: boolean | ((current: boolean) => boolean)) => {
      if (typeof action === 'function') action = action(state);
      if (!hasQuickResponses) return false;
      return action;
    },
    false
  );

  const locationEnabled = useSetting('locationEnabled');
  const filesEnabled = useSetting('filesEnabled');
  const activeReplyOrEditMsg = useAppSelector(selectActiveReplyOrEditMsg);

  useEffect(() => {
    if (!hasQuickResponses) {
      setQuickResponsesOpen(false);
    }
  }, [hasQuickResponses]);

  const onSelectQuickResponse = (response: string): void => {
    response = response.replace(/\\/g, '\\\\'); // replace all '\' with '\\' in string since its an escape character
    const { type, msgId } = activeReplyOrEditMsg || {};
    if (type === 'reply' && msgId) {
      dispatch(sendTextMessage({ message: response, replyTo: msgId, vgroupId: activeConvoId }));
      dispatch(setActiveReplyOrEditMsg());
    } else {
      dispatch(sendTextMessage({ message: response, vgroupId: activeConvoId }));
    }
    forceToggleMenu();
  };

  const handleShareLocation = async () => {
    dispatch(shareCurrentLocation(activeConvoId));
  };

  /**
   * This is a bit of a hack since clicking on Upload A File
   * or Share Location should close the menu, but clicking on Quick Responses should not.
   * Its also used to force open the menus with keyboard shortcuts.
   * */
  const btnRef = useRef<HTMLButtonElement>(null);
  const forceToggleMenu = () => {
    btnRef.current?.click();
  };

  return (
    <>
      <KeyboardShortcut
        shortcut="UploadFile"
        onShortcut={() => dispatch(uploadFile())}
        disabled={!isMessagesActive || !filesEnabled}
      />
      <KeyboardShortcut
        shortcut="ShareLocation"
        onShortcut={handleShareLocation}
        disabled={!isMessagesActive}
      />
      <KeyboardShortcut
        shortcut="QuickResponses"
        onShortcut={() => {
          forceToggleMenu();
          setQuickResponsesOpen((open) => !open);
        }}
        disabled={!isMessagesActive}
      />
      <PopOver
        closeOnClick={false}
        onClose={() => setQuickResponsesOpen(false)}
        iconGutter
        popoverContent={
          quickResponsesOpen ? (
            <QuickResponses onSelect={onSelectQuickResponse} />
          ) : (
            <>
              {filesEnabled && (
                <PopOverItem
                  onClick={() => {
                    forceToggleMenu();
                    dispatch(uploadFile());
                  }}
                  icon={<AttachmentIcon size={ITEM_ICON_SIZE} />}
                >
                  {t('Compose.Add.ChooseFile')}
                </PopOverItem>
              )}
              {locationEnabled && (
                <PopOverItem
                  onClick={() => {
                    forceToggleMenu();
                    handleShareLocation();
                  }}
                  icon={<LocationIcon size={ITEM_ICON_SIZE} />}
                >
                  {t('Compose.Add.ShareLocation')}
                </PopOverItem>
              )}
              {hasQuickResponses && (
                <PopOverItem
                  onClick={() => setQuickResponsesOpen(true)}
                  icon={<QuickResponseIcon size={ITEM_ICON_SIZE} />}
                >
                  {t('Compose.Add.QuickResponses')}
                </PopOverItem>
              )}
            </>
          )
        }
      >
        <Tooltip tip={t('Compose.Add')} closeOnTriggerClick>
          <div>
            <IconButton label={t('Compose.Add')} ref={btnRef}>
              <AddIcon size={ACTIONS_ICON_SIZE} />
            </IconButton>
          </div>
        </Tooltip>
      </PopOver>
    </>
  );
};
