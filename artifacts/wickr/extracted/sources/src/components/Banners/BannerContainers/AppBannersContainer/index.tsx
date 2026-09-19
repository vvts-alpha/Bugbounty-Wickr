import NetworkConfigBanner from '../../BannerComponents/NetworkConfigBanner';
import UpdateBanner from '../../BannerComponents/UpdateBanner';

export const AppBannersContainer = () => {
  return (
    <>
      <UpdateBanner />
      <NetworkConfigBanner />
    </>
  );
};
