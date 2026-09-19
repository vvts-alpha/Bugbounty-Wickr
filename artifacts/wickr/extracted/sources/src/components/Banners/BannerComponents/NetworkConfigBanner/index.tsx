import { Banner } from '@/componentlibrary';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { setSetting } from '@/store/slices/settings';

const NetworkConfigBanner = () => {
  const dispatch = useAppDispatch();
  const banner = useSetting('networkBannerConfig');

  const handleClose = () => {
    dispatch(setSetting('networkBannerConfig', { ...banner, dismissed: true }));
  };

  if (!banner || !banner.enabled || banner.dismissed) {
    return null;
  }

  return (
    <Banner severity={banner.severity} onClose={banner.dismissible ? handleClose : undefined}>
      {banner.content}
    </Banner>
  );
};

export default NetworkConfigBanner;
