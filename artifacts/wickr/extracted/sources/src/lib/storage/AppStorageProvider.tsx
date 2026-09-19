import { createContext, useContext, useState } from 'react';
import { useWebChannel } from '@/apis/webChannel/context';
import { AppStorage } from './AppStorage';
import { AppStorageData } from './models';

const AppStorageContext = createContext<AppStorage<AppStorageData> | null>(null);

export const AppStorageProvider: ReactFC = ({ children }) => {
  const webChannel = useWebChannel();

  const [storage] = useState(() => new AppStorage<AppStorageData>(webChannel.wickrSettings));

  return <AppStorageContext.Provider value={storage}>{children}</AppStorageContext.Provider>;
};

export function useAppStorage() {
  const storage = useContext(AppStorageContext);
  if (!storage) throw new Error('useAppStorage must be used within an AppStorageProvider');
  return storage;
}

export const TestAppStorageProvider: ReactFC<{
  value: DeepPartial<AppStorage<AppStorageData>>;
}> = ({ children, value }) => {
  return (
    <AppStorageContext.Provider value={value as AppStorage<AppStorageData>}>
      {children}
    </AppStorageContext.Provider>
  );
};
