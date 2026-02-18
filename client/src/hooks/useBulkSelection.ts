import { useState, useCallback, useMemo } from 'react';

interface UseBulkSelectionReturn {
  selectedIds: Set<string>;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  isAllSelected: boolean;
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  toggleAll: (ids: string[]) => void;
}

export function useBulkSelection(): UseBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      if (prev.size === ids.length && ids.every((id) => prev.has(id))) {
        return new Set();
      }
      return new Set(ids);
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const isAllSelected = useMemo(() => selectedIds.size > 0, [selectedIds]);

  const selectedCount = selectedIds.size;

  return {
    selectedIds,
    selectedCount,
    isSelected,
    isAllSelected,
    toggleSelect,
    selectAll,
    clearSelection,
    toggleAll,
  };
}
