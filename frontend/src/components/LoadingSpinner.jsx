import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full border-4 border-t-4 border-purple-500 border-t-transparent w-12 h-12" />
    </div>
  );
}
