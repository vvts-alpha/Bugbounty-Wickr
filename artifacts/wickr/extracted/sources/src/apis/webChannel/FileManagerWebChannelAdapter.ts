import {
  CreateFolderApiPayload,
  RenameFolderApiPayload,
  RemoveFolderApiPayload,
  MoveFolderApiPayload,
  MoveFileApiPayload,
  PinNewFileApiPayload,
  DownloadPinnedFileApiPayload,
  UnpinFileApiPayload,
  RenameFileApiPayload,
  CheckNameApiPayload,
  OpenPinnedFileApiPayload,
  CancelPinNewFileApiPayload,
  CancelDownloadApiPayload,
  UnpinLinkApiPayload,
  UnpinItemsPayload,
} from './FileManagerWebChannel';
import { WebChannelAdapter } from './WebChannelAdapter';

export class FileManagerWebChannelAdapter extends WebChannelAdapter<'fileManager'> {
  constructor() {
    super('fileManager');
  }

  // ===========================================
  // Channel methods
  // ===========================================

  createFolder = async (payload: CreateFolderApiPayload) => {
    const channel = await this.whenChannel();
    return channel.createFolder(payload);
  };

  renameFolder = async (payload: RenameFolderApiPayload) => {
    const channel = await this.whenChannel();
    return channel.renameFolder(payload);
  };

  removeFolder = async (payload: RemoveFolderApiPayload) => {
    const channel = await this.whenChannel();
    return channel.removeFolder(payload);
  };

  moveFolder = async (payload: MoveFolderApiPayload) => {
    const channel = await this.whenChannel();
    return channel.moveFolder(payload);
  };

  moveFile = async (payload: MoveFileApiPayload) => {
    const channel = await this.whenChannel();
    return channel.moveFile(payload);
  };

  pinNewFile = async (payload: PinNewFileApiPayload) => {
    const channel = await this.whenChannel();
    return channel.pinNewFile(payload);
  };

  showOpenDialog = async () => {
    const channel = await this.whenChannel();
    return channel.showOpenDialog();
  };

  downloadPinnedFile = async (payload: DownloadPinnedFileApiPayload) => {
    const channel = await this.whenChannel();
    return channel.downloadPinnedFile(payload);
  };

  unpinFile = async (payload: UnpinFileApiPayload) => {
    const channel = await this.whenChannel();
    return channel.unPinFile(payload);
  };

  unpinLink = async (payload: UnpinLinkApiPayload) => {
    const channel = await this.whenChannel();
    return channel.unPinLink(payload);
  };

  unpinItems = async (payload: UnpinItemsPayload) => {
    const channel = await this.whenChannel();
    return channel.unPinItems(payload);
  };

  renameFile = async (payload: RenameFileApiPayload) => {
    const channel = await this.whenChannel();
    return channel.renamePinnedFile(payload);
  };

  checkName = async (payload: CheckNameApiPayload) => {
    const channel = await this.whenChannel();
    return channel.checkName(payload);
  };

  openPinnedFile = async (payload: OpenPinnedFileApiPayload) => {
    const channel = await this.whenChannel();
    return channel.openPinnedFile(payload);
  };

  cancelPinNewFile = async (payload: CancelPinNewFileApiPayload) => {
    const channel = await this.whenChannel();
    return channel.cancelPinNewFile(payload);
  };

  cancelDownload = async (payload: CancelDownloadApiPayload) => {
    const channel = await this.whenChannel();
    return channel.cancelDownload(payload);
  };
}
