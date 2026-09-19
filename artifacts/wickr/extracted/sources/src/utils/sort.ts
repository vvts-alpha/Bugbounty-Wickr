import { WickrUser } from '@/lib/protobuf/users';
import { getContactDisplayName, getContactSectionString } from './strings';

/** Default sorting for contacts (anywhere in the app).
 * This sorts A-Z at the top, then everything else under
 * it (including names that start with numbers).
 */
export const contactSort = (a: WickrUser, b: WickrUser) => {
  const aSection = getContactSectionString(a);
  const bSection = getContactSectionString(b);

  if ((aSection && bSection) || (!aSection && !bSection)) {
    return getContactDisplayName(a).localeCompare(getContactDisplayName(b));
  } else if (!aSection && bSection) {
    return 1;
  } else if (aSection && !bSection) {
    return -1;
  } else {
    return 0;
  }
};
