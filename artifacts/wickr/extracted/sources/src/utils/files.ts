import { FileApiErrorResponse } from '@/apis/webChannel/FileManagerWebChannel';
import { AppTranslationKey, useAppTranslation } from '@/lib/i18n';
import { WickrFileItemType, WickrFileItem, SAVED_ITEMS_UUID } from '@/lib/protobuf/files';
import { useAppDispatch } from '@/store';
import { FilesSort, NamingError, SortDirection } from '@/store/slices/files';
import { pushModal } from '@/store/slices/modal';
import { getFileExtension } from './path';

export const isFolder = (item: WickrFileItem): boolean =>
  item.fileItemType === WickrFileItemType.Folder ||
  item.fileItemType === WickrFileItemType.LegacyFolder;

export const isLegacyFolder = (item: WickrFileItem): boolean =>
  item.fileItemType === WickrFileItemType.LegacyFolder;

export const isFile = (item: WickrFileItem): boolean =>
  item.fileItemType === WickrFileItemType.File;

export function sortFiles(items: WickrFileItem[], sort?: FilesSort): WickrFileItem[] {
  switch (sort?.category) {
    case 'name':
      return sortByName(items, sort.direction);
    case 'type':
      return sortByType(items, sort.direction);
    case 'modified':
      return sortByModified(items, sort.direction);
    case 'size':
      return sortBySize(items, sort.direction);
    default:
      return items;
  }
}

/** Helper function to always sort the saved items folder to the top */
function handleSavedItemsSort(a: WickrFileItem, b: WickrFileItem): number | undefined {
  if (a.uuid === SAVED_ITEMS_UUID) {
    return -1;
  } else if (b.uuid === SAVED_ITEMS_UUID) {
    return 1;
  }
}

function sortByName(items: WickrFileItem[], direction: SortDirection): WickrFileItem[] {
  return [...items].sort((a, b) => {
    const savedSort = handleSavedItemsSort(a, b);
    if (savedSort) return savedSort;

    return direction === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
  });
}

function sortByType(items: WickrFileItem[], direction: SortDirection): WickrFileItem[] {
  return [...items].sort((a, b) => {
    const savedSort = handleSavedItemsSort(a, b);
    if (savedSort) return savedSort;

    const aExt = getFileExtension(a.name ?? '').toLowerCase();
    const bExt = getFileExtension(b.name ?? '').toLowerCase();

    return direction === 'desc' ? bExt.localeCompare(aExt) : aExt.localeCompare(bExt);
  });
}
function sortByModified(items: WickrFileItem[], direction: SortDirection): WickrFileItem[] {
  return [...items].sort((a, b) => {
    const savedSort = handleSavedItemsSort(a, b);
    if (savedSort) return savedSort;

    const aTimestamp = a.modifiedTimestamp ?? 0;
    const bTimestamp = b.modifiedTimestamp ?? 0;

    return direction === 'desc' ? bTimestamp - aTimestamp : aTimestamp - bTimestamp;
  });
}
function sortBySize(items: WickrFileItem[], direction: SortDirection): WickrFileItem[] {
  return [...items].sort((a, b) => {
    const savedSort = handleSavedItemsSort(a, b);
    if (savedSort) return savedSort;

    const aSize = a.sizeInBytes ?? 0;
    const bSize = b.sizeInBytes ?? 0;

    return direction === 'desc' ? bSize - aSize : aSize - bSize;
  });
}

export const MAX_NESTED_FOLDERS = 3;

function mapErrorToI18nKey(error: string, isFolder: boolean): AppTranslationKey | undefined {
  if (!error) {
    return;
  }
  if (isFolder) {
    if (error === 'folderAlreadyExists') {
      return 'FileManagement.DuplicateFolder';
    }
    if (error === 'empty') {
      return 'FileManagement.EmptyFolderName';
    }
    if (error === 'exceedsMaxLength') {
      return 'FileManagement.FolderNameTooLong';
    }
    if (error === 'unsupportedChars') {
      return 'FileManagement.FolderNameUnsupportedCharacters';
    }
  } else {
    if (error === 'fileAlreadyExists') {
      return 'FileManagement.DuplicateFile';
    }
    if (error === 'empty') {
      return 'FileManagement.EmptyFilename';
    }
    if (error === 'exceedsMaxLength') {
      return 'FileManagement.FilenameTooLong';
    }
    if (error === 'unsupportedChars') {
      return 'FileManagement.FilenameUnsupportedCharacters';
    }
  }
}

// Hook that either returns a translated error string to be used by a component
// or renders a "Something went wrong" modal if the error is unhandled.
export function useHandleFileManagementApiError() {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();

  return (errorResponse: FileApiErrorResponse, isFolder: boolean) => {
    let errorString: AppTranslationKey | undefined;

    if (errorResponse.error) {
      errorString = mapErrorToI18nKey(errorResponse.error, isFolder);
    } else {
      /* This currently only returns the first error reason in the response
          even though it is possible to get a response of more than one error.
          Currently according to the UX designs, this is ok, but we may need to 
          handle multiple responses. We also get other properties like the character
          limit and the characters that were invalid. We currently don't use those values,
          but we could handle them here in the future too. */
      const namingErrors: NamingError[] = ['empty', 'exceedsMaxLength', 'unsupportedChars'];
      for (const reason in errorResponse) {
        if (namingErrors.includes(reason as NamingError)) {
          errorString = mapErrorToI18nKey(reason as NamingError, isFolder);
        }
      }
    }
    if (errorString) return t(errorString);
    dispatch(pushModal('SomethingWentWrongModal'));
  };
}
