import { setRoomSearchItems } from '../slices/roomSearch';
import { createAppAsyncThunk } from '../utils';
import { getRoomSearchItems } from '@/apis/webFetch';
import { generateChatRoute } from '@/chat/routes';

export const fetchRoomSearchItems = createAppAsyncThunk(
  `roomSearch/fetchRoomSearchItems`,
  async (
    payload: {
      query: string;
      isStarred: boolean;
      activeTab: string;
      numConvoItems: number;
      numMessageItems: number;
      numFileItems: number;
      numStarredItems: number;
      numSearchItems: number;
      vgroupId?: string;
    },
    { dispatch }
  ) => {
    const {
      query,
      isStarred,
      activeTab,
      numConvoItems,
      numMessageItems,
      numFileItems,
      numStarredItems,
      numSearchItems,
      vgroupId,
    } = payload;
    const data = await getRoomSearchItems(
      query,
      isStarred,
      activeTab,
      numConvoItems,
      numMessageItems,
      numFileItems,
      numStarredItems,
      numSearchItems,
      vgroupId
    );
    if (Array.isArray(data)) {
      dispatch(setRoomSearchItems(data));
    }
  }
);

export const saveRecentSearchQuery = createAppAsyncThunk(
  `roomSearch/saveRecentSearchQuery`,
  async (searchQuery: string, { extra }) => {
    extra.bridge.updateRecentSearchQueries({
      searchQuery,
    });
  }
);

export const handleSearchResultClicked = createAppAsyncThunk(
  `roomsSearch/handleSearchResultClicked`,
  async ({ vGroupID, msgId }: { vGroupID: string; msgId: string }, { extra }) => {
    extra.navigate(generateChatRoute.convo(vGroupID, 'messages', { msgId }));
  }
);
