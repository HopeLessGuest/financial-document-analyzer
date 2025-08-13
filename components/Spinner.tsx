
import React from 'react';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string; // Tailwind color class like 'text-blue-500'
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'medium', color = 'text-blue-500' }) => {
  let sizeClasses = 'h-8 w-8';
  if (size === 'small') sizeClasses = 'h-5 w-5';
  if (size === 'large') sizeClasses = 'h-12 w-12';

  return (
    <div className={`animate-spin rounded-full border-t-2 border-b-2 border-transparent ${sizeClasses} ${color}`} style={{ borderTopColor: 'currentColor', borderBottomColor: 'currentColor', borderLeftColor: 'transparent', borderRightColor: 'transparent' }}>
    </div>
  );
};