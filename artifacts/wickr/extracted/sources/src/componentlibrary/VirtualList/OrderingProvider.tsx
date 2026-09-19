import { createContext, RefObject, useContext, useMemo, useState } from 'react';
import useLatestCallback from '@/hooks/useLatestCallback';
import useUniqueId from '@/hooks/useUniqueId';

type OrderingContextType = {
  register(id: string, ref: RefObject<HTMLElement>): void;
  unregister(id: string): void;
  components: { id: string; ref: RefObject<HTMLElement> }[];
};

const OrderingContext = createContext<OrderingContextType | null>(null);

export function OrderingProvider({ children }: React.PropsWithChildren) {
  const [components, setComponents] = useState<{ id: string; ref: RefObject<HTMLElement> }[]>([]);

  const register = useLatestCallback((id: string, ref: RefObject<HTMLElement>) => {
    setComponents((components) => {
      const newComponents = [...components, { id, ref }];
      // bubble up the component if its position is higher
      for (let i = newComponents.length - 1; i > 0; i--) {
        const [curr, prev] = [newComponents[i], newComponents[i - 1]];
        // if the component is not in the DOM, stop
        if (!curr.ref.current) break;
        // if the previous component is not in the DOM, move the current component up
        if (!prev.ref.current) {
          [newComponents[i], newComponents[i - 1]] = [prev, curr];
        } else {
          // get previous component position relative to current component
          const position = curr.ref.current.compareDocumentPosition(prev.ref.current);
          // if previous component is following current one, move the current up
          if (position === Node.DOCUMENT_POSITION_FOLLOWING) {
            [newComponents[i], newComponents[i - 1]] = [prev, curr];
          } else {
            // if previous component is below current one, or on the same level, stop
            break;
          }
        }
      }
      return newComponents;
    });
  });

  const unregister = useLatestCallback((id: string) => {
    setComponents((components) => components.filter((c) => c.id !== id));
  });

  const contextValue = useMemo(
    () => ({
      register,
      unregister,
      components,
    }),
    [register, unregister, components]
  );

  return <OrderingContext.Provider value={contextValue}>{children}</OrderingContext.Provider>;
}

export function useListIdOrder() {
  // id  never changes
  const id = useUniqueId();
  const ctx = useContext(OrderingContext);
  if (!ctx) throw new Error('useListIdOrder must be used within a OrderingProvider');
  // order updates when "lists" are added/removed, default to 0 when not yet in the DOM
  const order = ctx.components.findIndex((c) => c.id === id) + 1;

  return [id, order, ctx.register, ctx.unregister] as const;
}
