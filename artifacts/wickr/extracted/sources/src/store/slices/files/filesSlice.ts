import { Draft, PayloadAction, createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { FileStatusChangedResult } from '@/apis/webChannel/BridgeWebChannel';
import { Logger } from '@/lib/logger';
import { WickrFileItem } from '@/lib/protobuf/files';
import { WickrLinkItem } from '@/lib/protobuf/links';
import { FilesSort, FilesEntity, FileItem, FilesState } from '@/store/slices/files';

const logger = new Logger('filesSlice');

export const fileItemsAdapater = createEntityAdapter<FileItem, string>({
  selectId: (item) => item.uuid,
});
export const filesAdapater = createEntityAdapter<FilesEntity, string>({
  selectId: (filesEntity) => filesEntity.vgroupId,
});

const createFilesEntity = (vgroupId: string): FilesEntity => ({
  vgroupId,
  fileItems: fileItemsAdapater.getInitialState(),
  rootFolderId: '',
  currentFolderId: '',
});

const getOrAddFileEntity = (state: Draft<FilesState>, vgroupId: string) => {
  const filesEntity = state.files.entities[vgroupId];
  if (filesEntity) {
    return filesEntity;
  } else {
    const files = createFilesEntity(vgroupId);
    filesAdapater.addOne(state.files, files);
    return files;
  }
};

const initialState: FilesState = {
  files: filesAdapater.getInitialState(),
  transferringUuidConvoMap: {},
  legacyFileItems: [],
  savedLinkItems: [],
};

export const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    setCurrentFolderId: (
      state,
      {
        payload: { vgroupId, currentFolderId },
      }: PayloadAction<{ vgroupId: string; currentFolderId: string }>
    ) => {
      const filesEntity = getOrAddFileEntity(state, vgroupId);
      filesEntity.currentFolderId = currentFolderId;
    },
    setRootFolderId: (
      state,
      {
        payload: { vgroupId, rootFolderId },
      }: PayloadAction<{ vgroupId: string; rootFolderId: string }>
    ) => {
      const filesEntity = getOrAddFileEntity(state, vgroupId);
      filesEntity.rootFolderId = rootFolderId;
    },
    setSelectedFileItemId: (
      state,
      { payload: { vgroupId, fileId } }: PayloadAction<{ vgroupId: string; fileId: string }>
    ) => {
      const filesEntity = getOrAddFileEntity(state, vgroupId);
      if (fileId) {
        filesEntity.selectedFileItemId = fileId;
      } else {
        delete filesEntity.selectedFileItemId;
      }
    },
    upsertFileItems: (
      state,
      {
        payload: { vgroupId, items },
      }: PayloadAction<{ vgroupId: string; items: WickrFileItem[] | FileItem[] }>
    ) => {
      const filesEntity = getOrAddFileEntity(state, vgroupId);
      fileItemsAdapater.upsertMany(filesEntity.fileItems, items);
    },
    upsertFileItem: (
      state,
      {
        payload: { vgroupId, item },
      }: PayloadAction<{ vgroupId: string; item: WickrFileItem | FileItem }>
    ) => {
      const filesEntity = getOrAddFileEntity(state, vgroupId);
      fileItemsAdapater.upsertOne(filesEntity.fileItems, item);
    },
    setFolderItems: (
      state,
      {
        payload: { vgroupId, folderId, items },
      }: PayloadAction<{ vgroupId: string; folderId: string; items: string[] }>
    ) => {
      const filesEntity = getOrAddFileEntity(state, vgroupId);
      const folder = filesEntity.fileItems.entities[folderId];
      if (!folder) {
        logger.warn('setFolderItems: no matching folder', folderId);
        return;
      }
      const uploadingFiles =
        folder.items?.filter(
          (id) =>
            filesEntity.fileItems.entities[id]?.status === 'uploading' &&
            !items?.find((uuid) => uuid === id)
        ) ?? [];
      folder.items = items.concat(uploadingFiles);
    },
    upsertUploadingFile: (
      state,
      {
        payload: { vgroupId, folderId, item },
      }: PayloadAction<{ vgroupId: string; folderId: string; item: WickrFileItem | FileItem }>
    ) => {
      const filesEntity = getOrAddFileEntity(state, vgroupId);
      const folder = filesEntity.fileItems.entities[folderId];
      if (!folder) {
        logger.warn('upsertUploadingFile: no matching folder', folderId);
        return;
      }

      state.transferringUuidConvoMap[item.uuid] = vgroupId;
      filesEntity.fileItems.entities[folderId] = {
        ...folder,
        items: folder.items?.concat(item.uuid) || [item.uuid],
      };
    },
    upsertDownloadingFile: (
      state,
      { payload: { vgroupId, fileId } }: PayloadAction<{ vgroupId: string; fileId: string }>
    ) => {
      state.transferringUuidConvoMap[fileId] = vgroupId;
    },
    updateFileStatus: (state, { payload }: PayloadAction<FileStatusChangedResult>) => {
      const vgroupId = state.transferringUuidConvoMap[payload.uuid];
      if (!vgroupId) return;
      const filesEntity = getOrAddFileEntity(state, vgroupId);

      const file = filesEntity.fileItems.entities[payload.uuid];
      if (!file) {
        logger.warn('updateFileStatus: no matching file', payload.uuid);
        return;
      }

      file.progress = payload.progress;
      file.status = payload.status;

      if (payload.status === 'complete' || payload.status === 'canceled') {
        delete state.transferringUuidConvoMap[payload.uuid];
      }
    },
    setFilesSort: (
      state,
      { payload: { vgroupId, sort } }: PayloadAction<{ vgroupId: string; sort: FilesSort }>
    ) => {
      const filesEntity = getOrAddFileEntity(state, vgroupId);
      filesEntity.sort = sort;
    },
    setLegacyFileItems: (state, action: PayloadAction<WickrFileItem[]>) => {
      state.legacyFileItems = action.payload;
    },
    setSavedLinkItems: (state, action: PayloadAction<WickrLinkItem[]>) => {
      state.savedLinkItems = action.payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('files', initialState));
  },
});

export const filesReducer = filesSlice.reducer;
export const {
  setCurrentFolderId,
  setRootFolderId,
  upsertFileItems,
  upsertFileItem,
  setFolderItems,
  setSelectedFileItemId,
  upsertUploadingFile,
  upsertDownloadingFile,
  setFilesSort,
  updateFileStatus,
  setLegacyFileItems,
  setSavedLinkItems,
} = filesSlice.actions;
