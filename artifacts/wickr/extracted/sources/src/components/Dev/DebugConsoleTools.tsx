import { FC, useEffect } from 'react';
import { useAppStore } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { addConsoleTools } from '@/utils/debug';

export const DebugConsoleTools: FC = () => {
  const isProduction = useSetting('isProduction');
  const store = useAppStore();

  useEffect(() => {
    if (!isProduction) {
      const removeTools = addConsoleTools(store, __DEV__);

      return removeTools;
    }
  }, [isProduction, store]);

  return null;
};
