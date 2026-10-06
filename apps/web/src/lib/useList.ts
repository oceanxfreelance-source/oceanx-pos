import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs, type Paginated } from './api';

/** Server-paginated list with debounced search and filters. */
export function useList<T>(key: string, path: string, filters: Record<string, string | number | undefined> = {}, pageSize = 20) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [search]);
  const filterKey = JSON.stringify(filters);
  useEffect(() => setPage(1), [filterKey]);
  const query = useQuery({
    queryKey: ['biz', key, page, q, filterKey],
    queryFn: () => api.get<Paginated<T> & Record<string, unknown>>(`${path}${qs({ page, pageSize, q, ...filters })}`),
    placeholderData: keepPreviousData,
  });
  return { query, page, setPage, search, setSearch, q, pageSize };
}
