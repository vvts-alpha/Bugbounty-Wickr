import { batch } from 'react-redux';
import { AppAction } from '..';
import { selectIsFeatureEnabled } from '../slices/features';
import {
  upsertFileItems,
  setFolderItems,
  setRootFolderId,
  selectActiveRootFolderId,
  upsertFileItem,
  upsertUploadingFile,
  upsertDownloadingFile,
  updateFileStatus,
  setCurrentFolderId,
  selectActiveCurrentFolderId,
  setLegacyFileItems,
  setSavedLinkItems,
} from '../slices/files';
import { updateFileTransferBanners } from '../slices/uiChat';
import { createAppAsyncThunk } from '../utils';
import {
  DownloadFilePayload,
  FileStatusChangedResult,
  SetAppStateApiPayload,
} from '@/apis/webChannel/BridgeWebChannel';
import { UnpinItemsPayload } from '@/apis/webChannel/FileManagerWebChannel';
import {
  getFolder,
  getFolderFromFile,
  getLegacySavedItems,
  getRootFolder,
  getSavedLinks,
} from '@/apis/webFetch';
import { generateChatRoute } from '@/chat/routes';
import { Logger } from '@/lib/logger';
import { FileCollectionWithMeta, WickrFileItem, WickrFileItemType } from '@/lib/protobuf/files';
import { objectHasProperty } from '@/utils/lang';
import { trimPath } from '@/utils/path';

const logger = new Logger('store/files');

/** ================================
 *      Action Payload Types
 * ================================= */

export type CreateFolderActionPayload = {
  vgroupId: string;
  folderName: string;
  parentFolderId: string;
};

export type RenameFolderActionPayload = {
  vgroupId: string;
  folderName: string;
  folderId: string;
};

export type RemoveFolderActionPayload = {
  vgroupId: string;
  folderId: string;
};

export type MoveFolderActionPayload = {
  vgroupId: string;
  folderId: string;
  newParentFolderId: string;
};

export type MoveFileActionPayload = {
  vgroupId: string;
  fileId: string;
  newFolderId: string;
};

export type PinNewFileActionPayload = {
  vgroupId: string;
  filePath: string;
  parentFolderId: string;
  fileAlias: string;
};

export type ShowOpenDialogActionPayload = {
  filePath: string;
};

export type DownloadPinnedFileActionPayload = {
  vgroupId: string;
  fileId: string;
};

export type FetchLegacySavedItemsActionPayload = {
  vgroupId: string;
};

export type FetchSavedLinksActionPayload = {
  vgroupId: string;
};

export type FetchFolderActionPayload = {
  vgroupId: string;
  folderId?: string;
};

export type FetchFolderFromFileActionPayload = {
  vgroupId: string;
  fileId: string;
};

export type FetchFoldersOnPathActionPayload = {
  vgroupId: string;
  path: string; // Path of folder uuids
};

export type NavigateToFileActionPayload = {
  vgroupId: string;
  fileId: string;
};

export type UnpinFileActionPayload = {
  vgroupId: string;
  fileId: string;
};

export type UnpinLinkActionPayload = {
  vgroupId: string;
  link: string;
};

export type RenameFileActionPayload = {
  vgroupId: string;
  fileId: string;
  existingFilename: string;
  newFilename: string;
};

export type OpenPinnedFileActionPayload = {
  fileId: string;
  vgroupId: string;
};

export type CancelPinNewFileActionPayload = {
  fileId: string;
};

export type CancelDownloadActionPayload = {
  fileId: string;
};

export const fetchFolder = createAppAsyncThunk(
  `files/fetchFolder`,
  async (payload: FetchFolderActionPayload, { dispatch, getState, extra }) => {
    logger.info('fetchFolder', payload);
    const { vgroupId, folderId } = payload;
    let result: FileCollectionWithMeta;
    const actions: AppAction[] = [];

    const rootFolderId = selectActiveRootFolderId(getState());
    // Treat fetching the root folder id the same as fetching '' — the root
    // folder UUID can change when the file vault is rebuilt (e.g. after the
    // first file is saved to a new room), so we must always refresh rootFolderId
    // and the root folder entity from the response rather than relying on the
    // stale folderId that was passed in.
    const isRootFetch = !folderId || folderId === rootFolderId;
    try {
      if (!isRootFetch) {
        result = await getFolder(vgroupId, folderId);
      } else {
        result = await getRootFolder(vgroupId);
        logger.info('fetchFolder: root folder UUID', {
          previous: rootFolderId,
          next: result.folderId,
        });
        const newFolder: WickrFileItem = {
          uuid: result.folderId,
          name: '',
          fileItemType: WickrFileItemType.Folder,
        };
        dispatch(upsertFileItem({ vgroupId, item: newFolder }));
      }

      if (isRootFetch) {
        actions.push(setRootFolderId({ vgroupId, rootFolderId: result.folderId }));
      }

      actions.push(upsertFileItems({ vgroupId, items: result.items }));
      actions.push(
        setFolderItems({
          vgroupId,
          // Always use result.folderId for root fetches so setFolderItems
          // targets the entity we just upserted, not a potentially stale UUID.
          folderId: isRootFetch ? result.folderId : folderId,
          items: result.items.map((i) => i.uuid),
        })
      );
    } catch (err) {
      if (!isRootFetch) {
        // Set to empty folder on error for non-root fetches only;
        // for root fetches we don't have a reliable folderId to clear.
        dispatch(setFolderItems({ vgroupId, folderId, items: [] }));
      }
    } finally {
      batch(() => actions.forEach((action) => dispatch(action)));
    }
  }
);

export const fetchLegacySavedItems = createAppAsyncThunk(
  `files/fetchLegacySavedItems`,
  async (payload: FetchLegacySavedItemsActionPayload, { dispatch }) => {
    logger.info('fetchLegacySavedItems', payload);
    const { vgroupId } = payload;
    let result: FileCollectionWithMeta;

    try {
      result = await getLegacySavedItems(vgroupId);
      dispatch(setLegacyFileItems(result.items));
    } catch (err) {
      logger.error('fetchLegacySavedItems', `fetch ${vgroupId} failed`, err);
      dispatch(setLegacyFileItems([]));
    }
  }
);

export const fetchSavedLinks = createAppAsyncThunk(
  `files/fetchSavedLinks`,
  async (payload: FetchSavedLinksActionPayload, { dispatch }) => {
    logger.info('fetchSavedLinks', payload);
    const { vgroupId } = payload;

    try {
      const result = await getSavedLinks(vgroupId);
      dispatch(setSavedLinkItems(result.items));
    } catch (err) {
      logger.error('fetchSavedLinks', `fetch ${vgroupId} failed`, err);
      dispatch(setSavedLinkItems([]));
    }
  }
);

export const navigateToFile = createAppAsyncThunk(
  `files/navigateToFile`,
  async (payload: NavigateToFileActionPayload, { dispatch, rejectWithValue, extra }) => {
    logger.info('navigateToFile', payload);
    const { vgroupId, fileId } = payload;
    try {
      const collection = await dispatch(fetchFolderFromFileId({ vgroupId, fileId })).unwrap();
      dispatch(fetchFoldersOnPath({ vgroupId, path: collection.currentPathUuid }));
      dispatch(setCurrentFolderId({ vgroupId, currentFolderId: collection.folderId }));
      extra.navigate(
        generateChatRoute.convo(vgroupId, 'files', {
          folderId: collection.folderId,
        })
      );
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const fetchFoldersOnPath = createAppAsyncThunk(
  `files/fetchFoldersOnPath`,
  async (payload: FetchFoldersOnPathActionPayload, { dispatch, rejectWithValue }) => {
    logger.info('fetchFoldersOnPath', payload);
    const { vgroupId, path } = payload;
    try {
      const pathSegments = trimPath(path).split('/');
      // Fetch the root folder
      dispatch(fetchFolder({ vgroupId, folderId: '' }));
      // then fetch the other folders in the path
      for (const folderId of pathSegments) {
        dispatch(fetchFolder({ vgroupId, folderId }));
      }
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const fetchFolderFromFileId = createAppAsyncThunk(
  `files/fetchFolderFromFileId`,
  async (payload: FetchFolderFromFileActionPayload, { dispatch, rejectWithValue }) => {
    logger.info('fetchFolderFromFileId', payload);
    const { vgroupId, fileId } = payload;
    try {
      const result = await getFolderFromFile(vgroupId, fileId);

      batch(() => {
        dispatch(upsertFileItems({ vgroupId, items: result.items }));
        dispatch(
          setFolderItems({
            vgroupId,
            folderId: result.folderId,
            items: result.items.map((i) => i.uuid),
          })
        );
      });

      return result;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const createFolder = createAppAsyncThunk(
  `files/createFolder`,
  async (payload: CreateFolderActionPayload, { getState, rejectWithValue, extra }) => {
    const { vgroupId, folderName, parentFolderId } = payload;
    if (!parentFolderId) payload.parentFolderId = selectActiveRootFolderId(getState());
    logger.info('createFolder', { vgroupId, parentFolderId: payload.parentFolderId });
    const validityCheck = await extra.fileManager.checkName(payload);
    if (!validityCheck.valid) {
      return rejectWithValue(validityCheck);
    }

    const response = await extra.fileManager.createFolder({
      vgroupId,
      folderName,
      parentFolderUUID: payload.parentFolderId,
    });
    if ('error' in response) {
      return rejectWithValue(response);
    }
    return response;
  }
);

export const renameFolder = createAppAsyncThunk(
  `files/renameFolder`,
  async (payload: RenameFolderActionPayload, { rejectWithValue, extra }) => {
    const { vgroupId, folderId, folderName } = payload;
    logger.info('renameFolder', { vgroupId, folderId });
    const validityCheck = await extra.fileManager.checkName({ folderName });
    if (!validityCheck.valid) {
      return rejectWithValue(validityCheck);
    }
    const response = await extra.fileManager.renameFolder({
      vgroupId,
      folderName,
      folderUUID: folderId,
    });
    if ('error' in response) {
      return rejectWithValue(response);
    }
    return response;
  }
);

export const removeFolder = createAppAsyncThunk(
  `files/removeFolder`,
  async (payload: RemoveFolderActionPayload, { rejectWithValue, extra }) => {
    logger.info('removeFolder', payload);
    const response = await extra.fileManager.removeFolder({
      vgroupId: payload.vgroupId,
      folderUUID: payload.folderId,
    });
    if ('error' in response) {
      return rejectWithValue(response);
    }
    return response;
  }
);

export const moveFolder = createAppAsyncThunk(
  `files/moveFolder`,
  async (payload: MoveFolderActionPayload, { getState, rejectWithValue, extra }) => {
    logger.info('moveFolder', payload);
    if (!payload.newParentFolderId)
      payload.newParentFolderId = selectActiveRootFolderId(getState());
    const response = await extra.fileManager.moveFolder({
      vgroupId: payload.vgroupId,
      folderUUID: payload.folderId,
      newParentFolderUUID: payload.newParentFolderId,
    });
    if ('error' in response) {
      return rejectWithValue(response);
    }
    return response;
  }
);

export const showOpenDialog = createAppAsyncThunk(
  `files/showOpenDialog`,
  async (_: undefined, { extra }) => {
    const { fileName: filename } = await extra.fileManager.showOpenDialog();
    return filename;
  }
);

export const moveFile = createAppAsyncThunk(
  `files/moveFile`,
  async (payload: MoveFileActionPayload, { getState, rejectWithValue, extra }) => {
    logger.info('moveFile', payload);
    if (!payload.newFolderId) payload.newFolderId = selectActiveRootFolderId(getState());
    const response = await extra.fileManager.moveFile({
      vgroupId: payload.vgroupId,
      fileUUID: payload.fileId,
      folderUUID: payload.newFolderId,
    });
    if ('error' in response) {
      return rejectWithValue(response);
    }
    return response;
  }
);

export const pinNewFile = createAppAsyncThunk(
  `files/pinNewFile`,
  async (payload: PinNewFileActionPayload, { dispatch, getState, rejectWithValue, extra }) => {
    const { vgroupId, filePath, fileAlias, parentFolderId } = payload;
    if (!filePath) {
      logger.info('showOpenDialog returns empty filename');
      return;
    }

    if (!parentFolderId) payload.parentFolderId = selectActiveRootFolderId(getState());
    logger.info('pinNewFile', { vgroupId, parentFolderId: payload.parentFolderId });

    const validityCheck = await extra.fileManager.checkName({ fileName: fileAlias });
    if (!validityCheck.valid) {
      return rejectWithValue(validityCheck);
    }

    const response = await extra.fileManager.pinNewFile({
      vgroupId,
      fileName: filePath,
      renamedFile: fileAlias,
      parentFolder: payload.parentFolderId,
    });

    if ('error' in response) {
      return rejectWithValue(response);
    }

    if ('uuid' in response) {
      // Create new temp file and upsert it
      const newFile: WickrFileItem = {
        uuid: response.uuid,
        name: fileAlias,
        fileItemType: WickrFileItemType.File,
        status: 'initializing',
      };

      logger.info('pinNewFile creating new temp file', { uuid: response.uuid });
      batch(() => {
        dispatch(upsertFileItem({ vgroupId, item: newFile }));

        // Update folderItemRefs map
        dispatch(
          upsertUploadingFile({
            vgroupId,
            folderId: payload.parentFolderId,
            item: newFile,
          })
        );
      });
    }

    return response;
  }
);

export const downloadPinnedFile = createAppAsyncThunk(
  `files/downloadPinnedFile`,
  async (payload: DownloadPinnedFileActionPayload, { dispatch, rejectWithValue, extra }) => {
    logger.info('downloadPinnedFile', payload);
    const { vgroupId, fileId } = payload;
    dispatch(upsertDownloadingFile({ vgroupId, fileId }));
    const response = await extra.fileManager.downloadPinnedFile({
      vgroupId,
      fileUUID: payload.fileId,
    });
    if (response && 'error' in response) {
      return rejectWithValue(response);
    }
    return response;
  }
);

export const unpinFile = createAppAsyncThunk(
  `files/unpinFile`,
  async (payload: UnpinFileActionPayload, { rejectWithValue, extra }) => {
    logger.info('unpinFile', payload);
    const response = await extra.fileManager.unpinFile({
      vgroupId: payload.vgroupId,
      uuid: payload.fileId,
    });
    if (response && 'error' in response) {
      return rejectWithValue(response);
    }
    return response;
  }
);

export const unpinLink = createAppAsyncThunk(
  `files/unpinLink`,
  async (payload: UnpinLinkActionPayload, { rejectWithValue, extra }) => {
    logger.info('unpinLink', payload.vgroupId);
    const response = await extra.fileManager.unpinLink({
      vgroupId: payload.vgroupId,
      link: payload.link,
    });
    if (objectHasProperty(response, 'error')) {
      return rejectWithValue(response);
    }
    return response;
  }
);

export const unpinItems = createAppAsyncThunk(
  `files/unpinItems`,
  async (payload: UnpinItemsPayload, { rejectWithValue, extra }) => {
    logger.info('unpinItems', payload.vgroupId);
    const response = await extra.fileManager.unpinItems({
      vgroupId: payload.vgroupId,
      files: payload.files,
      links: payload.links,
    });
    if ('error' in response) {
      return rejectWithValue(response);
    }
    return response;
  }
);

export const renameFile = createAppAsyncThunk(
  `files/renameFile`,
  async (payload: RenameFileActionPayload, { rejectWithValue, extra }) => {
    const { vgroupId, fileId, existingFilename, newFilename } = payload;
    logger.info('renameFile', { vgroupId, fileId });
    const validityCheck = await extra.fileManager.checkName({ fileName: newFilename });
    if (!validityCheck.valid) {
      return rejectWithValue(validityCheck);
    }
    const response = await extra.fileManager.renameFile({
      vGroupID: vgroupId,
      uuid: fileId,
      existingFileName: existingFilename,
      newFileName: newFilename,
    });
    if ('error' in response) {
      return rejectWithValue(response);
    }
    return response;
  }
);

export const openPinnedFile = createAppAsyncThunk(
  `files/openPinnedFile`,
  async (payload: OpenPinnedFileActionPayload, { dispatch, rejectWithValue, extra }) => {
    logger.info('openPinnedFile', payload);
    const { vgroupId, fileId } = payload;
    dispatch(upsertDownloadingFile({ vgroupId, fileId }));
    const response = await extra.fileManager.openPinnedFile({
      fileUUID: payload.fileId,
      vgroupId,
    });
    if (response && 'error' in response) {
      return rejectWithValue(response);
    }
    return response;
  }
);

export const cancelPinNewFile = createAppAsyncThunk(
  `files/cancelPinNewFile`,
  async (payload: CancelPinNewFileActionPayload, { rejectWithValue, extra }) => {
    logger.info('cancelPinNewFile', payload);
    const response = await extra.fileManager.cancelPinNewFile({
      uuid: payload.fileId,
    });
    if ('error' in response) {
      return rejectWithValue(response);
    }
    return response;
  }
);

export const cancelDownload = createAppAsyncThunk(
  `files/cancelDownload`,
  async (payload: CancelDownloadActionPayload, { rejectWithValue, extra }) => {
    logger.info('cancelDownload', payload);
    const response = await extra.fileManager.cancelDownload({
      uuid: payload.fileId,
    });
    if (response?.error && 'error' in response) {
      return rejectWithValue(response);
    }
    return response;
  }
);

// TODO move into a more generic app level thunks when possible
export const setAppState = createAppAsyncThunk(
  `files/setAppState`,
  async (payload: SetAppStateApiPayload, { extra }) => {
    logger.info('setAppState', payload);
    await extra.bridge.setAppState(payload);
  }
);

export const processFileStatusChanged = createAppAsyncThunk(
  `files/processFileStatusChanged`,
  async (payload: FileStatusChangedResult, { dispatch }) => {
    if (payload.status === 'downloading' && payload.tag === 'pinnedFileDownload') {
      dispatch(updateFileStatus(payload));
    } else {
      batch(() => {
        dispatch(updateFileTransferBanners(payload));
        dispatch(updateFileStatus(payload));
      });
    }
  }
);

export const handleFileManagerContentsChanged = createAppAsyncThunk(
  `files/handleFileManagerContentsChanged`,
  async (vgroupId: string, { dispatch, getState }) => {
    logger.info('handleFileManagerContentsChanged', vgroupId);
    const currentFolderId = selectActiveCurrentFolderId(getState());
    const fileManagementEnabled = selectIsFeatureEnabled(getState(), 'FileManagement');
    if (!fileManagementEnabled) {
      dispatch(fetchLegacySavedItems({ vgroupId }));
    }
    dispatch(fetchSavedLinks({ vgroupId }));
    dispatch(fetchFolder({ vgroupId, folderId: currentFolderId }));
  }
);

export const downloadFile = createAppAsyncThunk(
  `files/downloadFile`,
  async (payload: DownloadFilePayload, { extra }) => {
    return extra.bridge.saveGeneralFile(payload);
  }
);
