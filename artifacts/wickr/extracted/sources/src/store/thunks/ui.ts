import { setSilencedConvos } from '../slices/convos';
import { pushModal, selectHasModals } from '../slices/modal';
import { setPanelStack, pushPanel } from '../slices/panels';
import { setSetting, DEFAULT_CONVO_LIST_WIDTH } from '../slices/settings';
import {
  setModeratorTipDismissedList,
  selectModeratorTipDismissedList,
  setPanelMessage,
} from '../slices/uiChat';
import { selectUserById, selectUserByIdHash } from '../slices/users';
import { createAppAsyncThunk } from '../utils';
import {
  ImagePreviewPayload,
  OpenLinkPayload,
  FileTransferActionPayload,
  NotNowUnverifiedUserPayload,
  SavedImagePreviewPayload,
  ChangeProfilePicturePayload,
} from '@/apis/webChannel/BridgeWebChannel';
import {
  SaveFileToRoomPayload,
  OpenFilePayload,
  SaveFilePayload,
  ViewContactDetailsPayload,
  MessageHistoryPayload,
  ShowMessageErrorPayload,
  SaveLinkToRoomPayload,
  SecurityVerificationPayload,
} from '@/apis/webChannel/UIBridgeWebChannel';
import { Logger } from '@/lib/logger';
import { WickrMessage } from '@/lib/protobuf/messages';
import { rejectAfter } from '@/utils/async';
import { getGeoLocation } from '@/utils/geoLocation';
import { isWindows } from '@/utils/platform';
import { redactInProd } from '@/utils/strings';
import { sendLocationMessage } from './convos';
import { closeModal, openAlertModal, openModal } from './modals';
import { navigateToRoomHistoryMessage } from './roomHistory';

const logger = new Logger('store/ui');

export const imagePreview = createAppAsyncThunk(
  `ui/imagePreview`,
  async (payload: ImagePreviewPayload | SavedImagePreviewPayload, { extra }) => {
    logger.info('imagePreview:', payload);
    return extra.uiBridge.imagePreview(payload);
  }
);

export const saveLinkToRoom = createAppAsyncThunk(
  `ui/saveLinkToRoom`,
  async (payload: SaveLinkToRoomPayload, { extra }) => {
    logger.info('saveLinkToRoom', redactInProd(payload));
    return extra.uiBridge.saveLinkToRoom(payload);
  }
);

export const saveFileToRoom = createAppAsyncThunk(
  `ui/saveFileToRoom`,
  async (payload: SaveFileToRoomPayload, { extra }) => {
    logger.info('saveFileToRoom', payload);
    return extra.uiBridge.saveFileToRoom(payload);
  }
);

export const openFile = createAppAsyncThunk(
  `ui/openFile`,
  async (payload: OpenFilePayload, { extra, dispatch, getState }) => {
    logger.info('openFile');
    if (getState().settings.enableFileDownload) {
      return extra.uiBridge.openFile(payload);
    } else {
      dispatch(
        pushModal({
          name: 'FilePreviewModal',
          params: {
            msgId: payload.messageId,
            vgroupId: payload.vgroupId,
          },
        })
      );
    }
  }
);

export const saveFile = createAppAsyncThunk(
  `ui/saveFile`,
  async (payload: SaveFilePayload, { extra }) => {
    logger.info('saveFile');
    return extra.uiBridge.saveFile(payload);
  }
);

export const viewContactDetails = createAppAsyncThunk(
  `ui/viewContactDetails`,
  async (payload: ViewContactDetailsPayload, { dispatch, getState }) => {
    logger.info('viewContactDetails', payload);

    // Find user by id if idHash if not provided
    const userIdHash =
      payload.userIdHash ?? selectUserById(getState(), payload.userId ?? '')?.idHash;
    const user = selectUserByIdHash(getState(), userIdHash ?? '');

    if (user?.selfUser) {
      dispatch(pushModal('MyAccountModal'));
      return;
    }

    dispatch(
      pushPanel({
        name: 'ContactDetailsPanel',
        userIdHash,
      })
    );
  }
);

export const showMessageHistory = createAppAsyncThunk(
  `ui/showMessageHistory`,
  async (payload: MessageHistoryPayload, { dispatch }) => {
    logger.info('showMessageHistory');
    dispatch(
      navigateToRoomHistoryMessage({
        convoId: payload.vgroupId,
        highlightedMsgId: payload.messageId,
      })
    );
  }
);

export const showMessageInfo = createAppAsyncThunk(
  `ui/showMessageInfo`,
  async (message: WickrMessage, { dispatch }) => {
    dispatch(setPanelMessage(message));
    dispatch(pushPanel({ name: 'MessageInfoPanel' }));
  }
);

export const showMessageError = createAppAsyncThunk(
  `ui/showMessageError`,
  async (payload: ShowMessageErrorPayload, { extra }) => {
    return extra.uiBridge.showMessageError(payload);
  }
);

export const openLink = createAppAsyncThunk(
  `ui/openLink`,
  async (payload: OpenLinkPayload, { extra, dispatch }) => {
    logger.info('openLink', redactInProd(payload));
    const { t } = extra;
    if (payload.showConfirmation) {
      const confirmed = await dispatch(
        openModal({
          name: 'ConfirmModal',
          params: {
            title: t('You are leaving Wickr'),
            body: t('Click continue to go to {{link}}', { link: payload.link }),
            confirmText: t('Continue'),
          },
        })
      ).unwrap();
      if (confirmed) {
        return extra.uiBridge.openLink({ link: payload.link, showConfirmation: false });
      }
    } else {
      return extra.uiBridge.openLink({ link: payload.link, showConfirmation: false });
    }
  }
);

export const openSearchPopout = createAppAsyncThunk(
  `ui/openSearchPopout`,
  async (_: undefined, { dispatch }) => {
    logger.info('openSearchPopout');
    dispatch(pushPanel({ name: 'SearchPanel' }));
  }
);

export const handleStartCall = createAppAsyncThunk(
  `ui/handleStartCall`,
  async (_: undefined, { extra }) => {
    logger.info('handleStartCall');
    return extra.bridge.handleStartCall();
  }
);

export const getIsCallShuttingDown = createAppAsyncThunk(
  `ui/getIsCallShuttingDown`,
  async (_: undefined, { extra }) => {
    logger.info('getIsCallShuttingDown');
    return extra.bridge.getIsCallShuttingDown();
  }
);

export const restoreSavedState = createAppAsyncThunk(
  `ui/restoreSavedState`,
  async (_: undefined, { dispatch, extra }) => {
    logger.info('restoreSavedState');

    // Restore Moderator Tip Banner Dismissed List state
    const dismissedList = await extra.storage.get('ModeratorTipDismissedList', []);

    if (dismissedList) {
      dispatch(setModeratorTipDismissedList(dismissedList));
    }

    const markdownControlsVisible = await extra.storage.get('MarkdownControlsVisible', false);
    dispatch(setSetting('markdownControlsVisible', markdownControlsVisible));

    const convoListSortMode = await extra.storage.get('ConvoListSortMode', 'recent');
    dispatch(setSetting('convoListSortMode', convoListSortMode));

    const convoListWidth = await extra.storage.get('ConvoListWidth', DEFAULT_CONVO_LIST_WIDTH);
    dispatch(setSetting('convoListWidth', convoListWidth));

    const theme = await extra.storage.get('Theme', 'classic-theme');
    dispatch(setSetting('theme', theme));

    const autoSummaryEnabled = await extra.storage.get('AutoSummaryEnabled', true);
    dispatch(setSetting('autoSummaryEnabled', autoSummaryEnabled));

    const showKnowledgeBaseOnlyChat = await extra.storage.get('ShowKnowledgeBaseOnlyChat', false);
    dispatch(setSetting('showKnowledgeBaseOnlyChat', showKnowledgeBaseOnlyChat));

    const silencedConvos = await extra.storage.get('SilencedConvos', []);
    dispatch(setSilencedConvos(silencedConvos));

    const developerModeEnabled = await extra.storage.get('DeveloperModeEnabled', false);
    dispatch(setSetting('developerModeEnabled', developerModeEnabled));
  }
);

export const dismissModeratorTip = createAppAsyncThunk(
  `ui/dismissModeratorTip`,
  async (convoId: string, { dispatch, getState, extra }) => {
    logger.info('dismissModeratorTip');

    const dismissedList = selectModeratorTipDismissedList(getState());

    if (!dismissedList.includes(convoId)) {
      const updatedList = [...dismissedList, convoId];

      extra.storage.set('ModeratorTipDismissedList', updatedList);
      dispatch(setModeratorTipDismissedList(updatedList));
    }
  }
);

export const fileTransferAction = createAppAsyncThunk(
  `ui/fileTransferAction`,
  async (payload: FileTransferActionPayload, { extra }) => {
    logger.info('fileTransferAction');
    return extra.bridge.fileTransferAction(payload);
  }
);

export const verifyContact = createAppAsyncThunk(
  `ui/verifyContact`,
  async (userIdHash: string, { dispatch }) => {
    logger.info('verifyContact');
    dispatch(pushPanel({ name: 'VerifyContactPanel', userIdHash: userIdHash }));
  }
);

export const notNowUnverifiedUser = createAppAsyncThunk(
  `ui/notNowUnverifiedUser`,
  async (payload: NotNowUnverifiedUserPayload, { extra }) => {
    logger.info('notNowUnverifiedUser', redactInProd(payload));
    return extra.bridge.notNowUnverifiedUser(payload);
  }
);

export const openHamburgerMenu = createAppAsyncThunk(
  `ui/openHamburgerMenu`,
  async (_: undefined, { getState, dispatch }) => {
    logger.info('openHamburgerMenu');
    const hasModals = selectHasModals(getState());
    if (!hasModals) dispatch(setPanelStack({ name: 'MainMenuPanel' }));
  }
);

export const openSettingsPanel = createAppAsyncThunk(
  `ui/openSettingsPanel`,
  async (_: undefined, { getState, dispatch }) => {
    const hasModals = selectHasModals(getState());
    if (!hasModals) dispatch(setPanelStack({ name: 'SettingsPanel' }));
  }
);

export const closeAllQmlPanels = createAppAsyncThunk(
  `ui/closeAllQmlPanels`,
  async (_: undefined, { extra }) => {
    return extra.uiBridge.closeAllPanels();
  }
);

export const referAFriend = createAppAsyncThunk(
  `ui/referAFriend`,
  async (_: undefined, { extra }) => {
    logger.info('referAFriend');
    return extra.uiBridge.referAFriend();
  }
);

export const limitedGuestAccess = createAppAsyncThunk(
  `ui/limitedGuestAccess`,
  async (_: undefined, { extra }) => {
    logger.info('limitedGuestAccess');
    return extra.uiBridge.limitedGuestAccess();
  }
);

export const openSecurityVerification = createAppAsyncThunk(
  `ui/openSecurityVerification`,
  async (payload: SecurityVerificationPayload, { extra }) => {
    logger.info('openSecurityVerification');
    return extra.uiBridge.openSecurityVerification(payload);
  }
);

export const openMyAccount = createAppAsyncThunk(
  `ui/openMyAccount`,
  async (_: undefined, { extra }) => {
    logger.info('openMyAccount');
    return extra.uiBridge.openMyAccount();
  }
);

export const changeProfilePicture = createAppAsyncThunk(
  `ui/changeProfilePicture`,
  async (payload: ChangeProfilePicturePayload | undefined, { extra }) => {
    logger.info('changeProfilePicture');
    return extra.bridge.changeProfilePicture(payload);
  }
);

export const showLocationShareErrorModal = createAppAsyncThunk(
  `ui/showLocationShareErrorModal`,
  async (_: undefined, { extra, dispatch }) => {
    const { t } = extra;

    dispatch(
      openAlertModal({
        title: t('Share Current Location Error'),
        body: t(
          'You do not have access to location services. It is required that your system either have Wi-Fi and/or a GPS device connected and active, and location services must be enabled. Please check your location settings at: {{setting}}',
          {
            setting: t(
              isWindows()
                ? 'Settings -> Privacy -> Location'
                : 'System Preferences -> Security & Privacy'
            ),
          }
        ),
      })
    );
  }
);

export const shareCurrentLocation = createAppAsyncThunk(
  `ui/shareCurrentLocation`,
  async (vGroupId: string, { extra, dispatch }) => {
    logger.info('shareCurrentLocation');

    const { t } = extra;
    const locationPromise = getGeoLocation();

    // Race in case of cached location - do not flash loading modal
    const locationRace = await rejectAfter(locationPromise, 200).catch(() => undefined);

    if (!locationRace) {
      // Show loading modal while requesting location
      dispatch(
        openModal({
          name: 'LoadingModal',
          params: {
            title: t('Requesting current location...'),
          },
        })
      );
    }

    const location = await locationPromise;

    dispatch(closeModal('LoadingModal'));

    if (!location) {
      dispatch(showLocationShareErrorModal());
      return;
    }

    // Extract just lat and lng since GeolocationCoordinates is not serializable
    const { latitude, longitude } = location.coords;

    // Show map confirmation modal
    const confirmed = await dispatch(
      openModal({
        name: 'LocationModal',
        params: {
          type: 'share',
          location: {
            latitude,
            longitude,
          },
        },
      })
    ).unwrap();

    if (!confirmed) {
      return;
    }

    // Send location message
    const success = await dispatch(
      sendLocationMessage({
        latitude,
        longitude,
        vgroupId: vGroupId,
      })
    ).unwrap();

    if (!success) {
      dispatch(showLocationShareErrorModal());
      return;
    }
  }
);
