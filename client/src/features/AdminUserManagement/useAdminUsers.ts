import { useEffect, useState } from 'react';

import { adminUserApi } from '../../services/api/adminUserApi';

import type {
  AdminUser,
  Pagination,
  UserAction,
  UserStatus
} from './types';

const DEFAULT_LIMIT = 5;
const SEARCH_DEBOUNCE_MS = 400;

export const useAdminUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: DEFAULT_LIMIT,
    total: 0,
    totalPages: 1
  });

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [status, setStatus] =
    useState<UserStatus | undefined>(undefined);

  const [isLoading, setIsLoading] = useState(true);

  const [actionLoadingId, setActionLoadingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  // Debounce search input.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  /*
   * Fetch data for the current query.
   *
   * This function only performs the API request.
   * The caller decides how to update UI state.
   */
  const requestUsers = async () => {
    return adminUserApi.getUsers({
      page: pagination.page,
      limit: pagination.limit,
      search: debouncedSearch,
      status
    });
  };

  // Initial load / reload when query changes.
  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      try {
        const response = await adminUserApi.getUsers({
          page: pagination.page,
          limit: pagination.limit,
          search: debouncedSearch,
          status
        });

        if (cancelled) {
          return;
        }

        setUsers(response.users);
        setPagination(response.pagination);
        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error('Failed to fetch users:', err);

        setError(
          'Không thể tải danh sách người dùng. Vui lòng thử lại.'
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [
    pagination.page,
    pagination.limit,
    debouncedSearch,
    status
  ]);

  const handleSearchChange = (value: string) => {
    setIsLoading(true);

    setPagination((previous) => ({
      ...previous,
      page: 1
    }));

    setSearch(value);
  };

  const handleStatusChange = (
    value: UserStatus | undefined
  ) => {
    setIsLoading(true);

    setPagination((previous) => ({
      ...previous,
      page: 1
    }));

    setStatus(value);
  };

  const handlePageChange = (page: number) => {
    setIsLoading(true);

    setPagination((previous) => ({
      ...previous,
      page
    }));
  };

  const handleUserAction = async (
    user: AdminUser,
    action: UserAction
  ) => {
    setActionLoadingId(user._id);
    setError(null);
    setSuccessMessage(null);

    try {
      if (action === 'LOCK') {
        await adminUserApi.lockUser(user._id);

        setSuccessMessage(
          `${user.name} đã được khóa.`
        );
      } else {
        await adminUserApi.unlockUser(user._id);

        setSuccessMessage(
          `${user.name} đã được mở khóa.`
        );
      }

      setIsLoading(true);

      const response = await requestUsers();

      setUsers(response.users);
      setPagination(response.pagination);
    } catch (err) {
      console.error(
        'Failed to perform user action:',
        err
      );

      setError(
        'Thao tác không thành công. Vui lòng thử lại.'
      );
    } finally {
      setIsLoading(false);
      setActionLoadingId(null);
    }
  };

  return {
    users,
    pagination,

    search,
    status,

    isLoading,
    actionLoadingId,

    error,
    successMessage,

    handleSearchChange,
    handleStatusChange,
    handlePageChange,
    handleUserAction
  };
};