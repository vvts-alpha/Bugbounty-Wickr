import { MetricsManager } from '@/lib/metrics/MetricsManager';
import { SummarizerManager } from '@/lib/metrics/summarizers/SummarizerManager';
import { AppShortcuts } from './AppShortcuts';
import { CopyHandler } from './CopyHandler';
import { DocumentTitleManager } from './DocumentTitle';
import { ExternalLinkManager } from './ExternalLinks';
import { MediaRecorderManager } from './MediaRecorderManager';

/** Collect all the little managers and inject them together */
export const AppManagers: ReactFC = ({ children }) => (
  <>
    <DocumentTitleManager />
    <ExternalLinkManager />
    <AppShortcuts />
    <MediaRecorderManager />
    <CopyHandler />
    <MetricsManager />
    <SummarizerManager />
    {children}
  </>
);
