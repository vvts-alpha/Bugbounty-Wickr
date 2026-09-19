import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { useSetting } from '@/store/hooks/useSetting';
import {
  selectActiveConvoMessages,
  selectActiveConvoModeratorIds,
  selectActiveConvoType,
  selectSelfUserIsModeratorInConvo,
} from '@/store/slices/convos';
import { selectSelfUserIdHash } from '@/store/slices/identity';
import { pushModal } from '@/store/slices/modal';
import { setOverlay } from '@/store/slices/overlay';
import { setPanelStack, togglePanel } from '@/store/slices/panels';
import { selectActiveConvoId } from '@/store/slices/shared';
import { deleteConvo } from '@/store/thunks/convos';
import { openModal } from '@/store/thunks/modals';
import {
  openAdminControls,
  updatePresenceEnabled,
  updateWinTextScaleFactor,
} from '@/store/thunks/settings';
import { openHamburgerMenu, openSettingsPanel } from '@/store/thunks/ui';
import { safeMessagesMeta } from '@/utils/debug';
import { CONVO_LIST_SEARCH_INPUT_ID } from './ConvoList/ConvoSearch';
import { useKeyboardShortcut } from './KeyboardShortcut';
import { ZOOM_OPTIONS } from './Overlays/AppearanceOverlay';

export const AppShortcuts: React.FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const abortableDispatch = useAbortableDispatch();
  const messages = useAppSelector(selectActiveConvoMessages);
  const selfHashId = useAppSelector(selectSelfUserIdHash);
  const zoom = useSetting('winTextScaleFactor');
  const activeConvoModerators = useAppSelector(selectActiveConvoModeratorIds);
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const selfUserIsMod = useAppSelectorExtra(selectSelfUserIsModeratorInConvo, activeConvoId);
  const selfUserIsOnlyActiveConvoModerator = activeConvoModerators.length === 1 && selfUserIsMod;
  const presenceEnabled = useSetting('isPresenceEnabled');
  const activeConvoType = useAppSelector(selectActiveConvoType);

  useKeyboardShortcut('OpenNavMenu', () => {
    dispatch(openHamburgerMenu());
  });

  useKeyboardShortcut('OpenSettings', () => {
    dispatch(openSettingsPanel());
  });

  useKeyboardShortcut('DebugActiveMessages', () => {
    const logger = new Logger('debug');
    logger.info('active messages:', safeMessagesMeta(messages, selfHashId));
  });

  useKeyboardShortcut('ZoomIn', () => {
    const newZoom = ZOOM_OPTIONS[ZOOM_OPTIONS.indexOf(zoom) + 1];
    if (newZoom) dispatch(updateWinTextScaleFactor(newZoom));
  });

  useKeyboardShortcut('ZoomOut', () => {
    const newZoom = ZOOM_OPTIONS[ZOOM_OPTIONS.indexOf(zoom) - 1];
    if (newZoom) dispatch(updateWinTextScaleFactor(newZoom));
  });

  useKeyboardShortcut('AdminControls', () => dispatch(openAdminControls()));

  useKeyboardShortcut('OpenContacts', () =>
    dispatch(togglePanel({ name: 'ContactsPanel', initialTab: 0 }))
  );

  useKeyboardShortcut('OpenDirectory', () =>
    dispatch(togglePanel({ name: 'ContactsPanel', initialTab: 1 }))
  );

  useKeyboardShortcut('UniversalSearch', () => dispatch(togglePanel({ name: 'SearchPanel' })));

  useKeyboardShortcut('UniversalSearchStarredItems', () =>
    dispatch(togglePanel({ name: 'SearchPanel', initialStarred: true }))
  );

  useKeyboardShortcut('FocusFindRoomsAndDMs', () => {
    const searchInput = document.getElementById(CONVO_LIST_SEARCH_INPUT_ID);
    searchInput?.focus();
  });
  const handleDeleteGroupOrDM = async () => {
    try {
      const value = await abortableDispatch(
        openModal({
          name: 'ConfirmModal',
          params: {
            title: t('Are you sure?'),
            body: t(
              'This conversation and all of its contents will be permanently deleted. Are you sure you want to delete this conversation?'
            ),
          },
        })
      );
      if (value) {
        dispatch(deleteConvo(activeConvoId));
      }
    } catch {
      // no-op
    }
  };
  useKeyboardShortcut(
    'LeaveConvo',
    () => {
      if (activeConvoType === WickrConvoType.DM || activeConvoType === WickrConvoType.Group) {
        handleDeleteGroupOrDM();
      } else if (selfUserIsOnlyActiveConvoModerator) {
        dispatch(pushModal({ name: 'CantLeaveRoomModal', params: { vGroupId: activeConvoId } }));
      } else {
        dispatch(pushModal({ name: 'LeaveConvoModal', params: { vGroupId: activeConvoId } }));
      }
    },
    { disabled: !activeConvoId }
  );
  useKeyboardShortcut(
    'DeleteConvo',
    () => {
      if (activeConvoType === WickrConvoType.DM || activeConvoType === WickrConvoType.Group) {
        handleDeleteGroupOrDM();
      } else if (selfUserIsMod) {
        dispatch(pushModal({ name: 'DeleteConvoModal', params: { vGroupId: activeConvoId } }));
      } else {
        dispatch(pushModal({ name: 'LeaveConvoModal', params: { vGroupId: activeConvoId } }));
      }
    },
    { disabled: !activeConvoId }
  );
  useKeyboardShortcut('TogglePresence', () => {
    dispatch(updatePresenceEnabled({ enable: !presenceEnabled }));
  });
  useKeyboardShortcut('SupportScreen', () => {
    dispatch(setPanelStack({ name: 'MainMenuPanel' }));
    dispatch(setOverlay('Support'));
  });

  return null;
};
