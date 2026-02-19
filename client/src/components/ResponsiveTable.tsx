import { ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface ResponsiveColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  hideOnMobile?: boolean;
  isPrimary?: boolean;
  isBadge?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
}

export default function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'אין נתונים להצגה',
  className = '',
}: ResponsiveTableProps<T>) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const primaryCol = columns.find((c) => c.isPrimary) || columns[0];
  const badgeCol = columns.find((c) => c.isBadge);
  const mobileVisibleCols = columns.filter((c) => !c.hideOnMobile && !c.isPrimary && !c.isBadge);

  const toggleCard = (key: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Desktop Table */}
      <div className="hidden md:block table-container">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={onRowClick ? 'cursor-pointer' : ''}
              >
                {columns.map((col) => (
                  <td key={col.key}>{col.render(item)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2.5">
        {data.map((item) => {
          const key = keyExtractor(item);
          const isExpanded = expandedCards.has(key);
          const previewCols = mobileVisibleCols.slice(0, 3);
          const extraCols = mobileVisibleCols.slice(3);

          return (
            <div
              key={key}
              className="responsive-table-card"
              onClick={() => onRowClick?.(item)}
            >
              {/* Header row: primary + badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-gray-900 truncate flex-1">
                  {primaryCol.render(item)}
                </div>
                {badgeCol && <div className="flex-shrink-0">{badgeCol.render(item)}</div>}
              </div>

              {/* Preview fields */}
              <div className="responsive-table-card-fields">
                {previewCols.map((col) => (
                  <div key={col.key}>
                    <div className="responsive-table-card-label">{col.header}</div>
                    <div className="responsive-table-card-value">{col.render(item)}</div>
                  </div>
                ))}
              </div>

              {/* Expandable extra fields */}
              {extraCols.length > 0 && (
                <>
                  {isExpanded && (
                    <div className="responsive-table-card-fields border-t border-gray-50 pt-2 mt-1">
                      {extraCols.map((col) => (
                        <div key={col.key}>
                          <div className="responsive-table-card-label">{col.header}</div>
                          <div className="responsive-table-card-value">{col.render(item)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCard(key);
                    }}
                    className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600 transition-colors mx-auto pt-1"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        פחות
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        עוד {extraCols.length} שדות
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
