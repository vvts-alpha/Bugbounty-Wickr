import { WebChannelAdapter } from './WebChannelAdapter';

export class ServerModelWebChannelAdapter extends WebChannelAdapter<'serverModel'> {
  constructor() {
    super('serverModel');
  }

  // ===========================================
  // Channel methods
  // ===========================================
  setProxy = async (payload: boolean) => {
    const channel = await this.whenChannel();
    return channel.setProxy(payload);
  };

  // The default value for resetNetworkOnSuccess is true
  // https://code.amazon.com/packages/WickrDesktopApp/blobs/08e1d9397c7c797a2e20eb5cda70950144663d32/--/clients/enterprise/networkservermodel.cpp#L211
  selectServer = async (
    host: string,
    updateNetworkState: boolean,
    resetNetworkOnSuccess = true
  ) => {
    const channel = await this.whenChannel();
    return channel.selectServer(host, updateNetworkState, resetNetworkOnSuccess);
  };

  getRandomServer = async () => {
    const channel = await this.whenChannel();
    return channel.getRandomServer();
  };

  isWOAProxyConfigured = async () => {
    const channel = await this.whenChannel();
    return channel.isWOAProxyConfigured;
  };

  currentHostStatus = async () => {
    const channel = await this.whenChannel();
    return channel.currentHostStatus;
  };
}
