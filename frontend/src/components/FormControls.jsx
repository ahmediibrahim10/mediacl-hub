import React from 'react';

// Base styling for dark‑glass form controls
const base = "bg-[#1A2035] bg-white/5 border border-white/10 text-white placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 p-2.5 w-full";

export const Input = React.forwardRef(({ className = '', ...props }, ref) => (
  <input ref={ref} className={`${base} ${className}`} {...props} />
));

export const TextArea = React.forwardRef(({ className = '', ...props }, ref) => (
  <textarea ref={ref} className={`${base} ${className}`} {...props} />
));

export const Select = React.forwardRef(({ className = '', children, ...props }, ref) => (
  <select ref={ref} className={`${base} ${className}`} {...props}>
    {React.Children.map(children, child =>
      React.isValidElement(child)
        ? React.cloneElement(child, { className: `${child.props.className || ''} bg-slate-900 text-white` })
        : child
    )}
  </select>
));
