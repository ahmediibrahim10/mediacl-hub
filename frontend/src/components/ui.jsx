import React from 'react';

export function Card({ children, className = "", onClick }) {
  return (
    <div onClick={onClick} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", onClick, disabled, icon }) {
  const base = "px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center transition-all cursor-pointer disabled:opacity-50";
  const styles = {
    primary: "bg-teal-600 text-white hover:bg-teal-700 shadow-md",
    secondary: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700",
    danger: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 hover:bg-rose-100",
    ghost: "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
}

export class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error(error, info); }
  render() {
    if (this.state.hasError) return <div className="p-6 bg-rose-50 text-rose-600 rounded-xl">حدث خطأ في عرض المكون.</div>;
    return this.props.children;
  }
}