import { BridgeSubscriptions } from '@/apis/webChannel/BridgeSubscriptions';
import { EnvironmentManagerSubscriptions } from '@/apis/webChannel/EnvironmentManagerSubscriptions';
import { OnboardingSubscriptions } from '@/apis/webChannel/OnboardingSubscriptions';
import { ServerModelSubscriptions } from '@/apis/webChannel/ServerModelSubscriptions';
import { WickrSettingsSubscriptions } from '@/apis/webChannel/WickrSettingsSubscriptions';
import { ComplianceBotSubscriptions } from '@/apis/webChannel/startup/ComplianceBotSubscriptions';
import { ServerConnectivityTracker } from '@/apis/webChannel/startup/ServerConnectivityTracker';
import { SyncAppClock } from '@/apis/webChannel/startup/SyncAppClock';
import { useAppSelector } from './store';
import { selectUIAppName } from './store/slices/uiApp';

// Collects always on signal subscriptions
export const AppChannelSubscriptions = () => {
  const uiAppName = useAppSelector(selectUIAppName);

  return (
    <div key={uiAppName}>
      <BridgeSubscriptions />
      <EnvironmentManagerSubscriptions />
      <OnboardingSubscriptions />
      <ServerModelSubscriptions />
      <WickrSettingsSubscriptions />
      <SyncAppClock />
      <ServerConnectivityTracker />
      <ComplianceBotSubscriptions />
    </div>
  );
};
