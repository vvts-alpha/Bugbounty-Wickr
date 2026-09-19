import { useState } from 'react';
import useFuse from '@/hooks/useFuse';
import { useAppSelector } from '@/store';
import { ConvoEntity, selectAllConvos } from '@/store/slices/convos';
import useLatestCallback from './useLatestCallback';

/** Hook for handling search state, results, etc when searching conversations. */
export default function useConversationsSearch() {
  // If the user has a valid query typed
  const [isSearching, setIsSearching] = useState(false);
  // If web is waiting for search results
  const [isLoading, setIsLoading] = useState(false);
  // All search results in a single list
  const [searchResults, setSearchResults] = useState<ConvoEntity[]>([]);

  // Get all conversations from the store
  const allConvos = useAppSelector(selectAllConvos);

  // Use the existing useFuse hook for consistency with other parts of the app
  const searchFuse = useFuse(allConvos, {
    keys: ['title', 'dmTitle'],
    isCaseSensitive: false,
    threshold: 0.3,
    ignoreLocation: true,
  });

  /** Search conversations by title */
  const search = useLatestCallback(async (input: string) => {
    const query = input.trim();
    if (query.length === 0) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsLoading(true);

    // Perform the search
    const results = searchFuse.search(query).map((result) => result.item);

    setSearchResults(results);
    setIsLoading(false);
    setIsSearching(true);
  });

  return {
    search,
    searchResults,
    isSearching,
    isLoading,
  };
}
