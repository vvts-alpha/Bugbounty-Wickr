import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { wickrWebEndpoints } from '@/apis/webFetch/endpoints';
import { Theme } from '@/store/slices/settings';
import { isAndroid } from '@/utils/platform';
import { determinePreviewThemeByFileExt } from './previews';

export type FilePreviewURLParams = {
  fileExt: string;
  theme: string;
  msgId: string;
  vgroupId: string;
  fileId: string;
};

/** Data stored in the context */
type FilePreviewType = {
  vgroupId: string;
  msgId: string;
  /** The file extension (lowercase) */
  fileExt: string;
  /** The URL to fetch the file */
  fileUrl: string;
  /** The theme for the preview */
  theme: Theme;
  /** The file id (for file management files) */
  fileId: string;
};

const FilePreviewContext = createContext<FilePreviewType>({
  vgroupId: '',
  msgId: '',
  fileExt: '',
  fileUrl: '',
  theme: 'classic-theme',
  fileId: '',
});

function getFilePreviewDataFromUrl(): FilePreviewType {
  // use hash url so that we can get URL changes that do not reload the page, e.g., for theme changes
  const urlParams = new URLSearchParams(location.hash.substring(1));
  const get = (name: keyof FilePreviewURLParams) => urlParams.get(name) ?? '';
  const vgroupId = get('vgroupId');
  const msgId = get('msgId');
  const fileId = get('fileId');
  const fileExt = get('fileExt').toLowerCase();
  const theme = determinePreviewThemeByFileExt(fileExt, get('theme'));
  const fileUrl = isAndroid()
    ? `/preview-file/`
    : vgroupId && msgId
    ? wickrWebEndpoints.fileData(vgroupId, msgId)
    : fileId
    ? wickrWebEndpoints.fileDataFromFileManager(fileId)
    : '';

  return {
    vgroupId,
    msgId,
    fileUrl,
    fileExt,
    theme,
    fileId,
  };
}

export const FilePreviewProvider: ReactFC = ({ children }) => {
  const [{ vgroupId, msgId, fileUrl, fileExt, theme, fileId }, setParams] =
    useState(getFilePreviewDataFromUrl);

  useEffect(() => {
    const handler = () => setParams(getFilePreviewDataFromUrl());
    addEventListener('hashchange', handler);
    return () => removeEventListener('hashchange', handler);
  }, []);

  const value: FilePreviewType = useMemo(
    () => ({
      vgroupId,
      msgId,
      fileUrl,
      fileExt,
      theme,
      fileId,
    }),
    [vgroupId, msgId, fileUrl, fileExt, theme, fileId]
  );

  return <FilePreviewContext.Provider value={value}>{children}</FilePreviewContext.Provider>;
};

export function useFilePreview() {
  return useContext(FilePreviewContext);
}
