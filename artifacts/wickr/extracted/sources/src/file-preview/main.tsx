import '../prebootstrap';
import '../bootstrap';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from '@/components/Errors/ErrorBoundary';
import { i18nInit } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics';
import { FilePreviewApp } from './FilePreviewApp';
import { DummyStoreProvider } from './FilePreviewDummyStore';
import { FilePreviewProvider } from './FilePreviewProvider';

import 'unfonts.css';
import '../themes/base.less';
import '../themes/dark.less';
import '../themes/light.less';

const logger = new Logger('FilePreview:Main');

function main() {
  logger.info('Starting file previewer');

  i18nInit();

  const metricsLogger = new Logger('metrics');
  metrics.setAddMetricsHandler((name, details) => {
    metricsLogger.info(name, details);
  });

  const el = document.getElementById('root')!;
  const root = createRoot(el);
  root.render(
    <ErrorBoundary id="file-preview-main">
      <DummyStoreProvider>
        <FilePreviewProvider>
          <FilePreviewApp />
          {/* Prevents errors from being inlined (see prebootstrap) */}
          <div id="dev_error_banner"></div>
        </FilePreviewProvider>
      </DummyStoreProvider>
    </ErrorBoundary>
  );
}

main();
