import { useReducer } from 'react';
import { valueOrInitializer, ValueOrInitializer } from '@/utils/function';

export type LoadingAction = 'loading' | 'loaded' | 'error';
export type LoadingState = { isLoading: boolean; hasError: boolean };
// Provide type-narrowing (e.g., if isLoading is true, hasError is false)
export type UseLoadingStateValue = Readonly<
  [true, false, (action: LoadingAction) => void] | [false, boolean, (action: LoadingAction) => void]
>;

const initialState: LoadingState = { isLoading: true, hasError: false };

function reducer(_state: LoadingState, action: LoadingAction): LoadingState {
  return {
    isLoading: action === 'loading',
    hasError: action === 'error',
  };
}

/**
 * Hook that transitions between loading/loaded/error states
 * isLoading and hasError are explicit states, and loaded is inferred by !isLoading && !hasError
 * This is to make branching cases easier
 * @example
 * if (hasError) return <Oops />
 *
 * return (isLoading ? <Spinner /> : <AllYourData />)
 */

export default function useLoadingState(
  initialAction: ValueOrInitializer<LoadingAction> = 'loading'
): UseLoadingStateValue {
  const [{ isLoading, hasError }, setLoadingState] = useReducer(reducer, initialState, (state) => {
    return reducer(state, valueOrInitializer(initialAction));
  });
  return [isLoading, hasError, setLoadingState] as const as any;
}
