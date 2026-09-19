import { useState } from 'react';
import { getUniqueId } from '@/utils/math';

// ensure that this never changes on re-render by
// omitting a function to update state
export default function useUniqueId() {
  const [uniqueId] = useState(getUniqueId());
  return uniqueId;
}
