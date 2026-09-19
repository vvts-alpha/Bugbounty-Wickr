import { Route, Routes } from 'react-router';
import ChatPage from '@/components/ChatPage';
import IntegratedApps from '@/components/IntegratedApps';
import LandingPage from '@/components/LandingPage';
import WickrMeetings from '@/components/WickrMeetings';
import { ConvoTab } from '@/store/slices/uiChat';
import { createRouteGenerator } from '@/utils/route';

const CHAT_ROOT_PATH = '/chat/';
export const CHAT_ROOT_SLUG = `${CHAT_ROOT_PATH}*`;
export { CHAT_ROOT_PATH };

const genRoute = createRouteGenerator(CHAT_ROOT_PATH);

const routes = {
  landing: '/landing',
  convo: '/convo/:convoId?/:tab/:itemId?',
  meetings: '/meetings/:meetingId?',
  wickrMeetings: '/wickrMeeting/:meetingId?',
  integratedApps: '/integratedApps',
};

export type ConvoRouteParams = {
  convoId?: string;
  tab?: string;
  itemId?: string;
};

type ConvoRouteItemOpts = {
  msgId?: string;
  folderId?: string;
};

export const generateChatRoute = {
  convo: (convoId: string, tab: ConvoTab = 'messages', opts?: ConvoRouteItemOpts) =>
    genRoute(routes.convo, {
      convoId,
      tab,
      itemId: opts?.msgId ?? opts?.folderId ?? '',
    }),
  landing: () => genRoute(routes.landing),
  meetings: (meetingId?: string) =>
    genRoute(routes.meetings, {
      meetingId,
    }),
  wickrMeeting: (meetingId?: string) =>
    genRoute(routes.wickrMeetings, {
      meetingId,
    }),
  integratedApps: () => genRoute(routes.integratedApps),
};

export const ChatRoutes = () => {
  return (
    <Routes>
      <Route path={routes.convo} element={<ChatPage />} />
      <Route path={routes.landing} element={<LandingPage />} />
      <Route path={routes.wickrMeetings} element={<WickrMeetings />} />
      <Route path={routes.integratedApps} element={<IntegratedApps />} />
    </Routes>
  );
};
