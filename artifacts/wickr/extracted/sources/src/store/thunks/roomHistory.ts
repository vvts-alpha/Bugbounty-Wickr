import { RoomHistoryItem, setRoomHistoryForConvoId } from '../slices/roomHistory';
import { createAppAsyncThunk } from '../utils';
import { getRoomHistoryListItems } from '@/apis/webFetch';
import { pushPanel } from '@/store/slices/panels';

export type NavigateToRoomHistoryMessageActionPayload = {
  convoId: string;
  highlightedMsgId: string;
};

export const fetchRoomHistoryListItems = createAppAsyncThunk(
  `roomHistory/fetchRoomHistoryListItems`,
  async (convoId: string, { dispatch }) => {
    const data = await getRoomHistoryListItems(convoId);
    dispatch(
      setRoomHistoryForConvoId({
        convoId,
        items: data ? convertTimestampsToMilliseconds(data.roomHistory) : [],
      })
    );
  }
);

export const navigateToRoomHistoryMessage = createAppAsyncThunk(
  `roomHistory/navigateToRoomHistoryMessage`,
  async (payload: NavigateToRoomHistoryMessageActionPayload, { dispatch }) => {
    const { convoId, highlightedMsgId } = payload;
    dispatch(pushPanel({ name: 'RoomHistoryPanel', convoId, highlightedMsgId }));
  }
);

const convertTimestampsToMilliseconds = (roomHistoryItems: RoomHistoryItem[]) => {
  if (!roomHistoryItems) return [];

  return roomHistoryItems.map((item) => {
    return {
      ...item,
      timestamp: Number(item.timestamp) * 1000,
    };
  });
};
