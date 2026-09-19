import { ForwardedRef } from 'react';

export type ReactComponent<Props = unknown> = React.JSXElementConstructor<
  React.PropsWithChildren<Props>
>;

interface ComposeProps {
  components: ReactComponent[];
  children: React.ReactNode;
}

export const ComposeComponents: React.FC<ComposeProps> = (props: ComposeProps) => {
  const { components = [], children } = props;

  return (
    <>
      {components.reduceRight((acc, Comp) => {
        return <Comp>{acc}</Comp>;
      }, children)}
    </>
  );
};

export function assignRef<T>(ref: ForwardedRef<T> | undefined | null, value: any) {
  if (typeof ref === 'function') ref(value);
  else if (ref && typeof ref === 'object') ref.current = value;
}
