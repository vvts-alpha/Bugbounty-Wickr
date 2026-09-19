import { createContext, useContext } from 'react';
import { MessageCaches } from './MessageCaches';

const MessageCachesContext = createContext(new MessageCaches());

export function useMessageCaches() {
  return useContext(MessageCachesContext);
}

export const TestMessageCachesProvider: ReactFC<{
  value: DeepPartial<MessageCaches>;
}> = ({ children, value }) => {
  return (
    <MessageCachesContext.Provider value={value as MessageCaches}>
      {children}
    </MessageCachesContext.Provider>
  );
};
