import { clsx } from 'clsx';
import { useEffect } from 'react';
import { AppAuthNavigate } from './AppAuthNavigate';
import { useWebChannel } from './apis/webChannel/context';
import { AppBannersContainer } from './components/Banners/BannerContainers/AppBannersContainer';
import { DebugConsoleTools } from './components/Dev/DebugConsoleTools';
import DevBar from './components/Dev/DevBar';
import { FloatingContentContainers } from './components/FloatingContentContainers';
import { ModalManager } from './components/Modals/ModalManager';
import ToastContainer from './components/ToastContainer';
import { ToursManager } from './components/Tours/ToursManager';
import { AppRoutes } from './routes';
import { useSetting } from './store/hooks/useSetting';

import 'unfonts.css';
import './themes/base.less';
import './themes/dark.less';
import './themes/light.less';
import styles from './App.module.less';

const App = () => {
  const theme = useSetting('theme');
  const applyTheme = () => (theme === 'classic-theme' ? 'light-theme' : theme);
  const { bridge } = useWebChannel() || {};

  // When providers and managers are re-organized, move into separate component that sets this
  useEffect(() => {
    bridge?.setIsWebViewLoaded({ status: true });
  }, [bridge]);

  return (
    <div className={clsx(styles.root, applyTheme())}>
      <AppBannersContainer />
      <DevBar />
      <DebugConsoleTools />
      <ModalManager />
      <AppRoutes />
      <AppAuthNavigate />
      <ToastContainer />
      <FloatingContentContainers />
      <ToursManager />
    </div>
  );
};

export default App;
