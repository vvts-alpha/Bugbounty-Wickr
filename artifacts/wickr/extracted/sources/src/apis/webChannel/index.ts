import { BridgeWebChannelAdapter } from './BridgeWebChannelAdapter';
import { EnvironmentManagerWebChannelAdapter } from './EnvironmentManagerWebChannelAdapter';
import { FileManagerWebChannelAdapter } from './FileManagerWebChannelAdapter';
import { OnboardingWebChannelAdapter } from './OnboardingWebChannelAdapter';
import { ServerModelWebChannelAdapter } from './ServerModelWebChannelAdapter';
import { UIBridgeWebChannelAdapter } from './UIBridgeWebChannelAdapter';
import { WickrSettingsWebChannelAdapter } from './WickrSettingsWebChannelAdapter';

export class WickrWebChannel {
  readonly bridge = new BridgeWebChannelAdapter();
  readonly environmentMgr = new EnvironmentManagerWebChannelAdapter();
  readonly fileManager = new FileManagerWebChannelAdapter();
  readonly uiBridge = new UIBridgeWebChannelAdapter();
  readonly wickrSettings = new WickrSettingsWebChannelAdapter();
  readonly serverModel = new ServerModelWebChannelAdapter();
  readonly onboardingBridge = new OnboardingWebChannelAdapter();
}

export { WickrWebChannelProvider, TestWebChannelProvider, useWebChannel } from './context';
export { ChannelReadyManager } from './ChannelReadyManager';
