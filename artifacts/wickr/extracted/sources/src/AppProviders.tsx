import { WickrWebChannelProvider } from './apis/webChannel/context';
import { AppManagers } from './components/AppManagers';
import { AwsAuthProvider } from './lib/awsAuth/AwsAuthProvider';
import { WickrMcpProvider } from './lib/mcp/WickrMcpProvider';
import { AppStorageProvider } from './lib/storage/AppStorageProvider';
import { AppRouter } from './routes';
import { AppStoreProvider } from './store/AppStoreProvider';

export const AppProvidersAndManagers: ReactFC = ({ children }) => {
  return (
    <AppRouter>
      <WickrWebChannelProvider>
        <AppStorageProvider>
          <AppStoreProvider>
            <AwsAuthProvider>
              <WickrMcpProvider>
                <AppManagers>{children}</AppManagers>
              </WickrMcpProvider>
            </AwsAuthProvider>
          </AppStoreProvider>
        </AppStorageProvider>
      </WickrWebChannelProvider>
    </AppRouter>
  );
};
