import { ReactNode } from 'react';

interface TooltipProps {
  text: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
}

export default function Tooltip({ text, children, position = 'top' }: TooltipProps) {
  return (
    <div className="relative group/tooltip inline-flex">
      {children}
      <span
        className={`absolute z-50 px-2.5 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg
          opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150
          pointer-events-none whitespace-nowrap
          ${position === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' : ''}
          ${position === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-2' : ''}
        `}
      >
        {text}
      </span>
    </div>
  );
}
