import { useLayoutEffect } from 'react';
import { selectActiveConvoTitle } from '../store/slices/convos';
import { useAppSelector } from '@/store';

const BASE_TITLE = document.title;

export const DocumentTitleManager: React.FC = () => {
  const name = useAppSelector(selectActiveConvoTitle);

  useLayoutEffect(() => {
    // always change the title because document.title is out of date when using back/fwd buttons
    document.title = `${document.title}   `;

    if (name) {
      document.title = `${BASE_TITLE} - ${name}`;
    } else {
      document.title = BASE_TITLE;
    }
  }, [name]);

  return null;
};
