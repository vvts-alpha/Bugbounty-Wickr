import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';
import { selectActiveConvoId } from '@/store/slices/shared';
import { MAX_NESTED_FOLDERS } from '@/utils/files';
import { FileItem } from './filesModels';
import { fileItemsAdapater, filesAdapater } from './filesSlice';

const selectFiles = (state: AppRootState) => state.files.files;
export const { selectById: selectFilesById, selectAll: selectAllFiles } =
  filesAdapater.getSelectors(selectFiles);
const { selectById: internalSelectFileItemById } = fileItemsAdapater.getSelectors();

export const selectLegacyFileItems = (state: AppRootState) => state.files.legacyFileItems;

const selectActiveLegacyFileItems = createSelector(
  (state: AppRootState) => state,
  selectActiveConvoId,
  selectLegacyFileItems
);

export const selectActiveLegacyFileItemById = createSelector(
  selectActiveLegacyFileItems,
  (_: any, uuid: string) => uuid,
  (fileItems, uuid) => {
    if (!fileItems || !uuid) return;
    return fileItems.find((item) => item.uuid === uuid);
  }
);

export const selectSavedLinkItems = (state: AppRootState) => state.files.savedLinkItems;

export const selectCurrentFolderId = createSelector(selectFilesById, (files) => {
  return files?.currentFolderId || files?.rootFolderId || '';
});
export const selectActiveCurrentFolderId = createSelector(
  (state: AppRootState) => state,
  selectActiveConvoId,
  selectCurrentFolderId
);

export const selectSelectedFileItemId = createSelector(
  selectFilesById,
  (files) => files?.selectedFileItemId
);
export const selectActiveSelectedFileItemId = createSelector(
  (state: AppRootState) => state,
  selectActiveConvoId,
  selectSelectedFileItemId
);

export const selectRootFolderId = createSelector(
  selectFilesById,
  (files) => files?.rootFolderId || ''
);
export const selectActiveRootFolderId = createSelector(
  (state: AppRootState) => state,
  selectActiveConvoId,
  selectRootFolderId
);

export const selectFilesSort = createSelector(selectFilesById, (files) => files?.sort);
export const selectActiveFilesSort = createSelector(
  (state: AppRootState) => state,
  selectActiveConvoId,
  selectFilesSort
);

export const selectFileItems = createSelector(selectFilesById, (files) => files?.fileItems);
export const selectActiveFileItems = createSelector(
  (state: AppRootState) => state,
  selectActiveConvoId,
  selectFileItems
);

export const selectActiveFileItemById = createSelector(
  selectActiveFileItems,
  (_: any, uuid: string) => uuid,
  (fileItems, uuid) => {
    if (!fileItems || !uuid) return;
    return internalSelectFileItemById(fileItems, uuid);
  }
);

export const selectFileItemByConvoIdFileId = createSelector(
  selectFilesById,
  (_: any, convoId: string) => convoId,
  (_: any, _convoId: string, fileId: string) => fileId,
  (files, convoId, fileId) => {
    if (!files || !fileId || !convoId) return undefined;
    const fileItems = files?.fileItems;
    const allFileItems = Object.values(fileItems.entities);
    return allFileItems.find((file) => file.uuid === fileId);
  }
);

export const selectActiveCurrentFolder = createSelector(
  selectActiveFileItems,
  selectActiveCurrentFolderId,
  (fileItems, folderId) => {
    // folderId could be empty string '' for chatroom with no folder yet, so we only check undefined here
    if (!fileItems || folderId === undefined) return;
    try {
      return internalSelectFileItemById(fileItems, folderId);
    } catch (err) {
      return;
    }
  }
);

export const selectActiveCurrentFileItems = createSelector(
  selectActiveFileItems,
  selectActiveCurrentFolder,
  (fileItems, folder) => {
    if (!fileItems || !folder) return [];
    return (
      folder?.items
        ?.map((itemId) => internalSelectFileItemById(fileItems, itemId))
        .filter((item): item is FileItem => !!item) ?? []
    );
  }
);

export const selectActiveFileItemsInFolderById = createSelector(
  selectActiveFileItems,
  (_: any, folderId: string) => folderId,
  (fileItems, folderId) => {
    if (!fileItems) return [];
    const folder = internalSelectFileItemById(fileItems, folderId);
    return (
      folder?.items
        ?.map((id) => internalSelectFileItemById(fileItems, id))
        .filter((file): file is FileItem => !!file) ?? []
    );
  }
);

export const selectFileItemBreadcrumbsById = createSelector(
  selectActiveFileItems,
  (_: any, id: string) => id,
  (fileItems, id) => {
    const breadcrumbs: FileItem[] = [];
    if (!fileItems || !id) {
      return breadcrumbs;
    }
    const item = internalSelectFileItemById(fileItems, id);
    if (!item) {
      return breadcrumbs;
    }
    const getParent = (it: FileItem) => {
      breadcrumbs.unshift(it);
      if (it?.parentFolderId) {
        const parent = internalSelectFileItemById(fileItems, it.parentFolderId);
        if (parent) {
          getParent(parent);
        } else {
          return;
        }
      }
    };
    getParent(item);
    return breadcrumbs;
  }
);

export const selectActiveFileItemBreadcrumbs = createSelector(
  (state: AppRootState) => state,
  selectActiveCurrentFolderId,
  (state, id) => selectFileItemBreadcrumbsById(state, id)
);

export const selectIsAtMaximumDepthByFolderId = createSelector(
  selectFileItemBreadcrumbsById,
  (_: any, id: string) => id,
  (breadcrumbs) => {
    return breadcrumbs.length >= MAX_NESTED_FOLDERS;
  }
);

export const selectActiveCurrentFolderIsAtMaximumDepth = createSelector(
  (state: AppRootState) => state,
  selectActiveCurrentFolderId,
  (state, id) => selectIsAtMaximumDepthByFolderId(state, id)
);
