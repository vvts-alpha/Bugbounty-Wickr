import { Ref, forwardRef } from 'react';
import { SearchIcon } from '../icons';
import Input, { InputProps } from '.';

export const SearchInput = forwardRef((props: InputProps, ref: Ref<HTMLInputElement>) => {
  const searchProps: InputProps = {
    ...props,
    type: 'search',
    leadingIcon: <SearchIcon data-testid="search-icon" size="12px" />,
  };

  return <Input {...searchProps} ref={ref} />;
});

export default SearchInput;
