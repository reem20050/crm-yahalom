import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Users,
  Building2,
  UserCircle,
  PartyPopper,
  X,
  Clock,
} from 'lucide-react';
import { searchApi } from '../services/api';

interface SearchResult {
  id: string;
  type: 'lead' | 'customer' | 'employee' | 'event';
  contact_name?: string;
  company_name?: string;
  phone?: string;
  status?: string;
  city?: string;
  first_name?: string;
  last_name?: string;
  event_name?: string;
  event_date?: string;
}

interface SearchCommandProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeConfig = {
  lead: {
    label: 'לידים',
    icon: Users,
    path: '/leads',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  customer: {
    label: 'לקוחות',
    icon: Building2,
    path: '/customers',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  employee: {
    label: 'עובדים',
    icon: UserCircle,
    path: '/employees',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  event: {
    label: 'אירועים',
    icon: PartyPopper,
    path: '/events',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
};

function getResultLabel(result: SearchResult): string {
  switch (result.type) {
    case 'lead':
      return result.contact_name || result.company_name || '';
    case 'customer':
      return result.company_name || '';
    case 'employee':
      return `${result.first_name || ''} ${result.last_name || ''}`.trim();
    case 'event':
      return result.event_name || '';
    default:
      return '';
  }
}

function getResultSubtitle(result: SearchResult): string {
  switch (result.type) {
    case 'lead':
      return [result.company_name, result.phone].filter(Boolean).join(' | ');
    case 'customer':
      return result.city || '';
    case 'employee':
      return result.phone || '';
    case 'event':
      return [
        result.company_name,
        result.event_date
          ? new Date(result.event_date).toLocaleDateString('he-IL')
          : '',
      ]
        .filter(Boolean)
        .join(' | ');
    default:
      return '';
  }
}

function getResultPath(result: SearchResult): string {
  const config = typeConfig[result.type];
  return `${config.path}/${result.id}`;
}

const RECENT_KEY = 'yahalom-recent-searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}

function addRecentSearch(q: string) {
  if (q.length < 2) return;
  const recent = getRecentSearches().filter(r => r !== q);
  recent.unshift(q);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export default function SearchCommand({ isOpen, onClose }: SearchCommandProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches] = useState(getRecentSearches);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setDebouncedQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Search query
  const { data, isLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => searchApi.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const results: SearchResult[] = data?.data?.results || [];

  // Group results by type
  const groupedResults = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>
  );

  const typeOrder: Array<'lead' | 'customer' | 'employee' | 'event'> = [
    'lead',
    'customer',
    'employee',
    'event',
  ];

  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    const flat: typeof results = [];
    typeOrder.forEach(type => {
      const group = groupedResults[type];
      if (group) flat.push(...group);
    });
    return flat;
  }, [results, groupedResults]);

  // Reset activeIndex when results change
  useEffect(() => { setActiveIndex(-1); }, [results]);

  // Auto-scroll active result into view
  useEffect(() => {
    if (activeIndex >= 0) {
      const el = document.querySelector(`[data-search-index="${activeIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Handle result click/navigation with recent search tracking
  const handleResultClick = useCallback((result: SearchResult) => {
    addRecentSearch(debouncedQuery);
    onClose();
    navigate(getResultPath(result));
  }, [debouncedQuery, onClose, navigate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-modal border border-gray-100 overflow-hidden animate-scale-in">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 border-b">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => Math.min(prev + 1, flatResults.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => Math.max(prev - 1, 0));
              } else if (e.key === 'Enter' && activeIndex >= 0 && flatResults[activeIndex]) {
                e.preventDefault();
                handleResultClick(flatResults[activeIndex]);
              }
            }}
            placeholder="חיפוש לידים, לקוחות, עובדים, אירועים..."
            className="flex-1 py-4 text-base outline-none placeholder-gray-400 bg-transparent font-heading"
            dir="rtl"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 rounded hover:bg-gray-100"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center rounded-lg bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs text-gray-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {/* Empty state - before search */}
          {debouncedQuery.length < 2 && recentSearches.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              <Search className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">הקלד לפחות 2 תווים כדי לחפש</p>
              <p className="text-xs text-gray-400 mt-1">
                Ctrl+K לפתיחה מהירה
              </p>
            </div>
          )}

          {/* Recent searches */}
          {debouncedQuery.length < 2 && recentSearches.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">חיפושים אחרונים</p>
              {recentSearches.map((q) => (
                <button
                  key={q}
                  onClick={() => setSearchQuery(q)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {isLoading && debouncedQuery.length >= 2 && (
            <div className="px-4 py-8 text-center text-gray-500">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">מחפש...</p>
            </div>
          )}

          {/* No results */}
          {!isLoading &&
            debouncedQuery.length >= 2 &&
            results.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500">
                <p className="text-sm">לא נמצאו תוצאות עבור "{debouncedQuery}"</p>
              </div>
            )}

          {/* Grouped results */}
          {!isLoading &&
            results.length > 0 &&
            (() => {
              let globalIndex = 0;
              return typeOrder.map((type) => {
                const items = groupedResults[type];
                if (!items || items.length === 0) return null;
                const config = typeConfig[type];
                const Icon = config.icon;

                return (
                  <div key={type}>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                      {config.label}
                    </div>
                    {items.map((result) => {
                      const currentIndex = globalIndex++;
                      return (
                        <Link
                          key={`${result.type}-${result.id}`}
                          to={getResultPath(result)}
                          onClick={() => {
                            addRecentSearch(debouncedQuery);
                            onClose();
                          }}
                          data-search-index={currentIndex}
                          className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl hover:bg-gray-50 transition-all cursor-pointer ${currentIndex === activeIndex ? 'bg-primary-50 ring-1 ring-primary-200' : ''}`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}
                          >
                            <Icon className={`w-4 h-4 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0 text-right">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {getResultLabel(result)}
                            </p>
                            {getResultSubtitle(result) && (
                              <p className="text-xs text-gray-500 truncate">
                                {getResultSubtitle(result)}
                              </p>
                            )}
                          </div>
                          {result.status && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                              {result.status}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                );
              });
            })()}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400 flex items-center justify-between">
            <span>{results.length} תוצאות נמצאו</span>
            <span className="flex items-center gap-2">
              <kbd className="rounded-lg bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px]">↑↓</kbd>
              <span>ניווט</span>
              <kbd className="rounded-lg bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px]">Enter</kbd>
              <span>בחירה</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
