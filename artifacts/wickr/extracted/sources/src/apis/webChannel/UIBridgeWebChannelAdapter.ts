import { ImagePreviewPayload, OpenLinkPayload, SavedImagePreviewPayload } from './BridgeWebChannel';
import {
  JoinCallPayload,
  MessageHistoryPayload,
  OpenFilePayload,
  SaveFilePayload,
  SaveFileToRoomPayload,
  SaveLinkToRoomPayload,
  SecurityVerificationPayload,
  ShowMessageErrorPayload,
  ShowMessageInfoPayload,
  ViewContactDetailsAction,
} from './UIBridgeWebChannel';
import { WebChannelAdapter } from './WebChannelAdapter';

export class UIBridgeWebChannelAdapter extends WebChannelAdapter<'uiBridge'> {
  constructor() {
    super('uiBridge');
  }

  // ===========================================
  // Channel methods
  // ===========================================

  saveLinkToRoom = async (payload: SaveLinkToRoomPayload) => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'saveLinkToRoom',
      ...payload,
    });
  };

  saveFileToRoom = async (payload: SaveFileToRoomPayload) => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'saveFileToRoom',
      ...payload,
    });
  };

  shareLocation = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'shareLocation',
    });
  };

  /**
   * Opens the QT contact details panel for a given userId.
   *
   * Important note: if the active convo is a DM with this user, the userId
   * must be undefined for this to work properly. If the active convo is
   * not a DM with this user, the you must give the userId to open it.
   */
  viewContactDetails = async (payload: ViewContactDetailsAction) => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction(payload);
  };

  uploadFile = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'uploadFile',
    });
  };

  openFile = async (payload: OpenFilePayload) => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'openFile',
      ...payload,
    });
  };

  saveFile = async (payload: SaveFilePayload) => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'saveFile',
      ...payload,
    });
  };

  showMessageHistory = async (payload: MessageHistoryPayload) => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'messageHistory',
      ...payload,
    });
  };

  joinCall = async (payload: JoinCallPayload) => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'joinCall',
      ...payload,
    });
  };

  imagePreview = async (payload: ImagePreviewPayload | SavedImagePreviewPayload) => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'imagePreview',
      ...payload,
    });
  };

  openLink = async (payload: OpenLinkPayload) => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'openLink',
      ...payload,
    });
  };

  clipboardHasImage = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.clipboardHasImage();
  };

  pasteImage = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'pasteImage',
    });
  };

  showMessageError = async (payload: ShowMessageErrorPayload) => {
    const uiBridge = await this.whenChannel();
    uiBridge.sendAction({
      action: 'showMessageError',
      ...payload,
    });
  };

  showMessageInfo = async (payload: ShowMessageInfoPayload) => {
    const uiBridge = await this.whenChannel();
    uiBridge.sendAction({
      action: 'showMessageInfo',
      ...payload,
    });
  };

  viewRoomDetails = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'viewRoomDetails',
    });
  };

  openSavedItems = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'openSavedItems',
    });
  };

  openSearchPopout = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'openSearchPopout',
    });
  };

  addMods = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'addMods',
    });
  };

  manageUsers = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'manageUsers',
    });
  };

  verifyContact = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'verifyContact',
    });
  };

  openHamburgerMenu = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'openHamburgerMenu',
    });
  };

  openSettingsPanel = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'openSettingsPanel',
    });
  };

  referAFriend = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'referAFriend',
    });
  };

  limitedGuestAccess = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'limitedGuestAccess',
    });
  };

  openSecurityVerification = async (payload: SecurityVerificationPayload) => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'securityVerification',
      ...payload,
    });
  };

  openMyAccount = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'myAccount',
    });
  };

  addDevice = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'addDevice',
    });
  };

  closeAllPanels = async () => {
    const uiBridge = await this.whenChannel();
    return uiBridge.sendAction({
      action: 'closeAllPanels',
    });
  };
}
