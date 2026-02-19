export function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`skeleton ${className ?? ''}`}
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  const widths = ['w-full', 'w-[85%]', 'w-[60%]'];
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonPulse
          key={i}
          className={`h-4 ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      <div className="flex items-start gap-3">
        <SkeletonPulse className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <SkeletonText lines={2} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-2xl shadow-card p-6 flex flex-col">
      <SkeletonPulse className="w-10 h-10 rounded-xl" />
      <SkeletonPulse className="h-8 w-24 mt-3 rounded-xl" />
      <SkeletonPulse className="h-4 w-16 mt-1.5 rounded-xl" />
    </div>
  );
}

export function SkeletonTableRows({
  columns = 5,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      {/* Header row */}
      <div className="flex gap-4 px-5 py-3.5 bg-gray-50/60">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonPulse
            key={i}
            className={`h-3 ${i === 0 ? 'w-32' : i === columns - 1 ? 'w-20' : 'w-24'}`}
          />
        ))}
      </div>

      {/* Body rows */}
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-4 px-5 py-4">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <SkeletonPulse
                key={colIdx}
                className={`h-4 ${
                  colIdx === 0
                    ? 'w-36'
                    : colIdx === columns - 1
                      ? 'w-16'
                      : 'w-24'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
