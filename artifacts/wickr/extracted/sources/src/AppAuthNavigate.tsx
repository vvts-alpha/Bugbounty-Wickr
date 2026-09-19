import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { CHAT_ROOT_PATH, generateChatRoute } from './chat/routes';
import { devErrorTracker } from './lib/devErrors';
import { determineInitialState } from './signin/signinThunks';
import { useAppDispatch, useAppSelector } from './store';
import { selectUIAppName } from './store/slices/uiApp';

export const AppAuthNavigate = () => {
  const appAuth = useAppSelector(selectUIAppName);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const prevAppAuth = useRef<typeof appAuth | null>(null);

  useEffect(() => {
    const appAuthChanged = appAuth !== prevAppAuth.current;
    const prevAppAuthValue = prevAppAuth.current;
    prevAppAuth.current = appAuth;
    switch (appAuth) {
      case 'signin':
        // Cold start (prevAppAuth is null — first render) or transitioning from chat
        // (sign out): call determineInitialState to query the native session and
        // navigate to the appropriate route.
        // For signin → signin transitions (e.g. HMR), skip — already on signin.
        if (prevAppAuthValue === null || prevAppAuthValue === 'chat') {
          dispatch(determineInitialState());
        }
        break;
      case 'chat':
        if (appAuthChanged && !location.pathname.startsWith(CHAT_ROOT_PATH)) {
          navigate(generateChatRoute.landing(), { replace: true });
        }
        break;
      default:
        devErrorTracker.addError(new Error('appAuth has impossible state'), 'AppRoutes');
    }
    // Remove navigate from dependency list because new func ref whenever path changes
    // https://github.com/remix-run/react-router/issues/7634
    // This is also why we navigate in a leaf component separate from the AppRoutes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appAuth, dispatch, location.pathname]);

  return null;
};
