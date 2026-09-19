import { lazy } from 'react';
import { SUPPORTED_IMAGE_PREVIEW_TYPES } from '@/lib/protobuf/messages';
import { Theme } from '@/store/slices/settings';

// Lazy imports so that the top frame (wickr) doesn't pull these in,
// and also so that each previewer only loads the preview code it needs.
const lazyPdf = lazy(() => import('./components/PdfPreview'));
const lazyDoc = lazy(() => import('./components/DocPreview'));
const lazySpreadsheet = lazy(() => import('./components/SpreadsheetPreview'));
const lazyXml = lazy(() => import('./components/XmlPreview'));
const lazyText = lazy(() => import('./components/TextPreview'));
const lazyRtf = lazy(() => import('./components/TextPreview/RichTextPreview'));
const lazyPowerPoint = lazy(() => import('./components/PowerPointPreview'));

export const FILE_PREVIEW_COMPONENT_MAP = {
  pdf: lazyPdf,
  docx: lazyDoc,
  xls: lazySpreadsheet,
  xlsx: lazySpreadsheet,
  csv: lazySpreadsheet,
  pptx: lazyPowerPoint,
  xml: lazyXml,
  rss: lazyXml,
  txt: lazyText,
  log: lazyText,
  // Treat markdown as plain text because our markdown renderer is very specific.
  // There are many flavors of markdown, so we will not assume we can render them properly.
  md: lazyText,
  markdown: lazyText,
  rtf: lazyRtf,
} as const;

export type SupportedFileExt = keyof typeof FILE_PREVIEW_COMPONENT_MAP;

export const isSupportedPreviewFileType = (fileExt: string): fileExt is SupportedFileExt => {
  return fileExt in FILE_PREVIEW_COMPONENT_MAP || SUPPORTED_IMAGE_PREVIEW_TYPES.includes(fileExt);
};

// These extensions always use a dark theme
const ALWAYS_DARK_THEME: string[] = ['pdf', 'docx'] satisfies SupportedFileExt[];

/**
 * Select the appropriate theme for the given file. Most file types will use the same theme as the
 * main app. However, some file types always render with a dark theme, and we override appropriately.
 * */
export function determinePreviewThemeByFileExt(fileExt: string, theme: Theme | string) {
  return ALWAYS_DARK_THEME.includes(fileExt.toLowerCase())
    ? 'dark-theme'
    : theme === 'dark-theme'
    ? 'dark-theme'
    : 'light-theme';
}
