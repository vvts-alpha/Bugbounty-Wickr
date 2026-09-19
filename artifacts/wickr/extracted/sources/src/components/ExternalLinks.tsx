import useEventListener from '@/hooks/useEventListener';
import { useAppDispatch } from '@/store';
import { openLink } from '@/store/thunks/ui';
import { asElement } from '@/utils/dom';
import { shouldShowLinkConfirmation } from '@/utils/links';

export const ExternalLinkManager: React.FC = () => {
  const dispatch = useAppDispatch();

  const handleClick = (e: MouseEvent | TouchEvent) => {
    // If preventDefault was already called before the event bubbled up to here,
    // we should not take any action on it.
    if (e.defaultPrevented) return;

    // <a>s can have children, so find the actual <a>
    const anchor = asElement(e.target)?.closest('a');

    if (anchor && anchor.href) {
      const url = new URL(anchor.href);
      if (url.protocol !== 'qrc:') {
        dispatch(
          openLink({
            link: anchor.href,
            showConfirmation: shouldShowLinkConfirmation(anchor),
          })
        );
      }

      e.preventDefault();
    }
  };

  useEventListener(document, 'click', handleClick);
  useEventListener(document, 'touchend', handleClick);

  return null;
};
