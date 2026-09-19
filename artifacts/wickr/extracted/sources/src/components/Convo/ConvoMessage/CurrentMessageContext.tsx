import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { Dispatch, createContext, useContext, useEffect, useReducer } from 'react';
import { Logger } from '@/lib/logger';
import { WickrReaction, WickrMessage } from '@/lib/protobuf/messages';
import { useAppSelector } from '@/store';
import { selectConvoMessage } from '@/store/slices/convos';
import { selectSelfUserIdHash } from '@/store/slices/identity';

const logger = new Logger('CurrentMessageContext');

export type ReactionLoadingType = 'removing' | 'adding';

// This CurrentMessageState is the shared context for all components at the ConvoMessage level.
// The context is useful to reduce excessive prop drilling and keep shared state in a centralized location.
type CurrentMessageSharedStateContextType = {
  // Adding reactions here so that it's easier to manage reactionsLoading ()
  reactions?: WickrReaction[];
  // Reactions on messages that have been toggled on/off for self user but awaiting response from Qt to update messages w/ new emoji
  reactionsLoading: Record<string, ReactionLoadingType>;
};

const initialState: CurrentMessageSharedStateContextType = {
  reactions: [],
  reactionsLoading: {},
};

const currentMessageStateSlice = createSlice({
  name: 'currentMessageState',
  reducers: {
    // Do not use outside of CurrentMessageProvider
    updateReactions: (state, { payload }: PayloadAction<WickrReaction[] | null | undefined>) => {
      state.reactions = payload || [];
    },
    addReactionLoading: (
      state,
      {
        payload: { reactionId, selfUserId },
      }: PayloadAction<{
        reactionId: string;
        selfUserId: string;
      }>
    ) => {
      if (!reactionId) {
        logger.error('addReactionLoading::reaction id was not provided');
        return;
      }
      const reaction = state.reactions?.find((r) => r.identifier === reactionId);
      const selfReacted = reaction?.userIDs.includes(selfUserId);
      const loadingType = selfReacted ? 'removing' : 'adding';
      state.reactionsLoading[reactionId] = loadingType;
    },
    removeReactionLoading: (state, { payload }: PayloadAction<string>) => {
      delete state.reactionsLoading[payload];
    },
  },
  initialState,
});

// internal actions only
const { updateReactions } = currentMessageStateSlice.actions;
// Exposed actions
export const { addReactionLoading, removeReactionLoading } = currentMessageStateSlice.actions;
const currentMessageStateReducer = currentMessageStateSlice.reducer;

const CurrentMessageContext = createContext<WickrMessage | null>(null);

const CurrentMessageSharedStateContext = createContext<
  [CurrentMessageSharedStateContextType, Dispatch<PayloadAction<any>>]
>([initialState, () => {}]);

export const useCurrentMessage = () => {
  const currMsg = useContext(CurrentMessageContext);
  if (!currMsg) throw new Error('useCurrentMessage:: CurrentMessageContext is null');
  return currMsg;
};
export const useCurrentMessageSharedState = () => {
  const state = useContext(CurrentMessageSharedStateContext);
  if (!state)
    throw new Error('useCurrentMessageSharedState:: CurrentMessageSharedStateContext is null');
  return state;
};
interface CurrentMessageProviderProps {
  convoId: string;
  msgId: string;
}

export const CurrentMessageProvider: ReactFC<CurrentMessageProviderProps> = ({
  convoId,
  msgId,
  children,
}) => {
  const message = useAppSelector((state) => {
    const msg = selectConvoMessage(state, convoId, msgId);
    if (!msg)
      throw new Error(
        `CurrentMessageProvider:: message is null for msgId: ${msgId}, convoId ${convoId}`
      );
    return msg;
  });
  const [state, dispatch] = useReducer(currentMessageStateReducer, initialState);
  const myId = useAppSelector(selectSelfUserIdHash);

  // Manage the removal of any reactionLoading states when new message.reactions have been updated
  useEffect(() => {
    const { reactionsLoading } = state;
    const { reactions } = message;

    // Copy reactions to the shared message state so reducers can contain logic for mutating
    dispatch(updateReactions(reactions));

    // Iterate through every loading state then check if the expected reaction was updated
    // If the expected reaction was made (removed or added), then remove the loading state
    // TODO (niambros@): Optimize this to iterate over reactions instead of loading reactions.
    for (const rxnId in reactionsLoading) {
      const reaction = reactions?.find((r) => r.identifier === rxnId);
      if (reactionsLoading[rxnId] === 'removing') {
        // If reaction is expected to be removed and not in userIds list, then remove loading state
        if (!reaction || !reaction.userIDs || !reaction.userIDs.includes(myId))
          dispatch(removeReactionLoading(rxnId));
      } else if (reactionsLoading[rxnId] === 'adding') {
        if (!reaction || !reaction.userIDs) continue;

        // If reaction is expected to be added and is now in the userIds list, then remove loading state
        if (reaction.userIDs.includes(myId)) dispatch(removeReactionLoading(rxnId));
      }
    }
  }, [message.reactions]);

  return (
    <CurrentMessageContext.Provider value={message}>
      {/* TODO: Potential optimization to be made w/ useMemo here. https://www.agney.dev/blog/useMemo-inside-context */}
      <CurrentMessageSharedStateContext.Provider value={[state, dispatch]}>
        {children}
      </CurrentMessageSharedStateContext.Provider>
    </CurrentMessageContext.Provider>
  );
};
