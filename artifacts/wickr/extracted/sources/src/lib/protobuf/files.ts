import { FileCollection } from '@amzn/wickr-messaging-protocol-proto';
import { v4 } from 'uuid';
import { Logger } from '../logger';
import { FileStatus } from '@/apis/webChannel/BridgeWebChannel';
import { assertRequiredKeysFactory } from './utils';

export const SAVED_ITEMS_UUID = 'saveditems';
export const INVALID_FILE_ITEM = 'Invalid FileItem';

const logger = new Logger('protobuf/files');

export type RequiredFileInfo = OptionalExceptForRequiredNonNullable<
  FileCollection.IFileItem,
  'uuid' | 'fileItemType' | 'name'
>;

export const WickrFileItemType = FileCollection.FileItemType;

export type WickrFileItem = {
  uuid: string;
  fileItemType: FileCollection.FileItemType;
  name: string;
  mimeType?: string | null | undefined;
  modifiedTimestamp?: number | null | undefined;
  sizeInBytes?: number | null | undefined;
  progress?: number;
  status?: FileStatus;
  parentFolderId?: string;
  imageUrl?: string | null | undefined;
  sentTimestamp?: number | null | undefined;
  sentByUser?: string | null | undefined;
  savedTimestamp?: number | null | undefined;
  savedByUser?: string | null | undefined;
};

export const assertRequiredFile = assertRequiredKeysFactory<RequiredFileInfo>([
  'uuid',
  'fileItemType',
  'name',
]);

export const fileItemToWickrFileItem = (
  fileItem: FileCollection.IFileItem,
  parentFolderId: string
): WickrFileItem | undefined => {
  try {
    const file = assertRequiredFile(fileItem);
    const {
      uuid,
      fileItemType,
      name,
      mimeType,
      modifiedTimestamp,
      sizeInBytes,
      imageUrl,
      sentTimestamp,
      sentByUser,
      savedTimestamp,
      savedByUser,
    } = file;
    return {
      uuid: fileItemType === WickrFileItemType.LegacyFolder ? SAVED_ITEMS_UUID : uuid,
      fileItemType,
      name,
      mimeType,
      modifiedTimestamp,
      sizeInBytes,
      parentFolderId,
      imageUrl,
      sentTimestamp,
      sentByUser,
      savedTimestamp,
      savedByUser,
    };
  } catch (err) {
    if (__DEV__) {
      logger.error(err);
      return {
        uuid: v4(),
        fileItemType: WickrFileItemType.Unknown,
        name: `${INVALID_FILE_ITEM}: ${JSON.stringify(fileItem, undefined, 2)}`,
        mimeType: null,
        modifiedTimestamp: null,
        sizeInBytes: null,
        imageUrl: null,
        sentTimestamp: null,
        sentByUser: null,
        savedTimestamp: null,
        savedByUser: null,
      };
    }
    return undefined;
  }
};

export type FileCollectionWithMeta = {
  items: WickrFileItem[];
  folderId: string;
  currentPathUuid: string;
};

export const fileCollectionToWickrFileItems = (
  collection: FileCollection
): FileCollectionWithMeta => {
  const { fileItems, currentFolderUuid, currentPathUuid } = collection;
  // We no longer use /files/:subFolder1/:subFolder2 as a url, but we
  // can still parse the parent folder tree this way.
  const parentFolderId = currentPathUuid.split('/').pop() || '';
  return {
    items: fileItems
      .map((file) => fileItemToWickrFileItem(file, parentFolderId))
      .filter((file): file is WickrFileItem => !!file),
    folderId: currentFolderUuid,
    currentPathUuid,
  };
};
