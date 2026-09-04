import React from 'react';

export const ErrorAlert: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => {
  return (
    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-bold text-rose-700 hover:text-rose-900 underline shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
};
