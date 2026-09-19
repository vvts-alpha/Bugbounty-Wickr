/** !! Bootstrap file must be first import !! */
import './bootstrap';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppChannelSubscriptions } from './AppChannelSubscriptions';
import { AppProvidersAndManagers } from './AppProviders';
import { ChannelReadyManager } from './apis/webChannel/ChannelReadyManager';
import { DevErrorBanner } from './components/Dev/DevErrorBanner';
import ErrorBoundary from './components/Errors/ErrorBoundary';
import { i18nInit } from './lib/i18n';

function main() {
  // Kick off i18n initialization immediately
  // This is sync because of resource providing
  // Would love to make lazy
  i18nInit();

  const container = document.getElementById('root');
  if (!container) throw new Error('Cannot create root; #root not found');
  const root = createRoot(container);
  root.render(
    <ErrorBoundary id="main">
      <AppProvidersAndManagers>
        <ChannelReadyManager>
          <AppChannelSubscriptions />
          <DevErrorBanner />
          <App />
        </ChannelReadyManager>
      </AppProvidersAndManagers>
    </ErrorBoundary>
  );
}

main();
