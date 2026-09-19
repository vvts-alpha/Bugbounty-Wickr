import { useRef, useState } from 'react';
import { WickrUser } from '@/lib/protobuf/users';
import { useAppDispatch } from '@/store';
import { checkUserValidation, searchContactsAndDirectory } from '@/store/thunks/users';
import useLatestCallback from './useLatestCallback';

/** Hook for handling search state, results, etc when searching contacts and directory. */
export default function useContactsSearch() {
  const dispatch = useAppDispatch();
  // If the user has a valid query typed (eg. more than one character without whitespace)
  const [isSearching, setIsSearching] = useState(false);
  // If web is waiting for a response from the QT search API
  const [isLoading, setIsLoading] = useState(false);
  const [contactsSearchResults, setContactsSearchResults] = useState<WickrUser[]>([]);
  const [directorySearchResults, setDirectorySearchResults] = useState<WickrUser[]>([]);

  // Monotonically increasing counter to discard stale responses
  const searchIdRef = useRef(0);

  /** Called when the search is submitted (eg. with Enter). Used to search cross-federation. */
  const submitSearch = useLatestCallback(async (input: string) => {
    setIsLoading(true);
    await dispatch(checkUserValidation(input));
    await search(input);
  });

  /** Search contacts and directory. Include convoMemberIdHashes to limit results to those id hashes. */
  const search = useLatestCallback(async (input: string, convoMemberIdHashes: string[] = []) => {
    const query = input.trim();
    if (query.length === 0) {
      ++searchIdRef.current;
      setIsSearching(false);
      setIsLoading(false);
      setContactsSearchResults([]);
      setDirectorySearchResults([]);
      return;
    }

    const searchId = ++searchIdRef.current;
    setIsLoading(true);

    const results = await dispatch(searchContactsAndDirectory(query)).unwrap();

    // Discard if a newer search has already been initiated
    if (searchId !== searchIdRef.current) return;

    if (convoMemberIdHashes.length > 0) {
      // Only include non-guest members in the room in moderator lists
      setContactsSearchResults(
        results.filter((u) => convoMemberIdHashes.includes(u.idHash) && !u.isGuest)
      );
      setDirectorySearchResults([]);
    } else {
      // Let the directory results include the contacts results
      const contactsResults = results.filter((user) => !user.isDirectoryUser);
      const directoryResults = results;

      setContactsSearchResults(contactsResults);
      setDirectorySearchResults(directoryResults);
    }

    setIsLoading(false);
    setIsSearching(true);
  });

  return {
    search,
    submitSearch,
    contactsSearchResults,
    directorySearchResults,
    isSearching,
    isLoading,
  };
}
