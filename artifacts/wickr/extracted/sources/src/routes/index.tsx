import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import ChatContainer from '@/chat/components/ChatContainer';
import { CHAT_ROOT_SLUG, generateChatRoute } from '@/chat/routes';
import LoadingPage, { LOADING_ROUTE } from '@/components/LoadingPage';
import { SigninContainer } from '@/signin/components/SigninContainer';
import { generateSigninRoute, SIGNIN_ROOT_SLUG } from '@/signin/routes';
import { useFeature } from '@/store/hooks/useFeature';
import { RouteSpy } from './RouteSpy';

export const AppRouter: ReactFC = ({ children }) => {
  return (
    <HashRouter>
      <RouteSpy />
      {children}
    </HashRouter>
  );
};

export const AppRoutes = () => {
  // TODO: Remove signinEnabled once Signin feature is ready
  // Set isSigninEnabled to true manually on local dev (instead of using feature flag below) to be able to see web Signin content on app start, and to be able to navigate to it via dev menu
  const isSigninEnabled = useFeature('Signin');

  return (
    <Routes>
      <Route path={LOADING_ROUTE} element={<LoadingPage />} />
      <Route path={SIGNIN_ROOT_SLUG} element={<SigninContainer />} />
      <Route path={CHAT_ROOT_SLUG} element={<ChatContainer />} />

      {/* Redirect to signin page for all other routes (eg. invalid routes / 404) */}
      <Route
        path="*"
        element={
          isSigninEnabled ? (
            <Navigate to={generateSigninRoute.landing()} />
          ) : (
            <Navigate to={generateChatRoute.landing()} />
          )
        }
      />
    </Routes>
  );
};
