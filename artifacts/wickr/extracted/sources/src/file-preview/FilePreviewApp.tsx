import { clsx } from 'clsx';
import { Suspense } from 'react';
import { Button, FlexCentered, Heading } from '@/componentlibrary';
import { KeyboardShortcut } from '@/components/KeyboardShortcut';
import { useAppTranslation } from '@/lib/i18n';
import { reloadApp } from '@/utils/url';
import { useFilePreview } from './FilePreviewProvider';
import { FileLoading } from './components/FileLoading';
import withLinkHandler from './components/withLinkHandler';
import { FILE_PREVIEW_COMPONENT_MAP, isSupportedPreviewFileType } from './previews';

import styles from './styles.module.less';

const isTop = typeof window === 'object' ? window.top === window : false;

export const FilePreviewApp: ReactFC = () => {
  const { t } = useAppTranslation();
  const { fileExt, fileUrl, theme } = useFilePreview();

  const renderPreview = () => {
    if (isSupportedPreviewFileType(fileExt)) {
      const PreviewComponent = withLinkHandler(FILE_PREVIEW_COMPONENT_MAP[fileExt]);
      return (
        <Suspense fallback={<FileLoading />}>
          <PreviewComponent url={fileUrl} />
        </Suspense>
      );
    }

    return (
      <FlexCentered className={styles.errorContainer}>
        <div>
          <Heading level={2}>{t('Error')}</Heading>
          {t('File type not supported: {{type}}', { type: fileExt })}
        </div>
      </FlexCentered>
    );
  };

  return (
    <div className={clsx(styles.app, theme)}>
      {renderPreview()}
      {__DEV__ && <KeyboardShortcut shortcut="Reload" onShortcut={reloadApp} />}
      {__DEV__ && isTop && (
        <Button
          color="primary"
          wrapperClassName={styles.devButton}
          onClick={() => (location.href = '/')}
        >
          Pop in
        </Button>
      )}
    </div>
  );
};
