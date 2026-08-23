import React from 'react';
import { motion } from 'framer-motion';

export function Card({ children, className = "", onClick, hover = true }) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hover ? { y: -3, transition: { duration: 0.2 } } : {}}
      className={`backdrop-blur-xl bg-slate-900/60 dark:bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40 rounded-2xl shadow-xl shadow-black/30 transition-colors duration-300 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function Button({ children, variant = "primary", className = "", onClick, disabled, icon }) {
  const base = "px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 select-none";
  const styles = {
    primary: "bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-lg shadow-teal-900/30 border border-teal-500/30",
    secondary: "bg-slate-800/80 text-slate-200 hover:bg-slate-700/90 border border-slate-700/80 hover:border-slate-600 shadow-sm",
    danger: "bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 border border-rose-800/50",
    ghost: "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
  };
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </motion.button>
  );
}

export class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error(error, info); }
  render() {
    if (this.state.hasError) return (
      <div className="p-6 bg-rose-950/50 border border-rose-800/60 text-rose-300 rounded-2xl backdrop-blur-md">
        حدث خطأ أثناء عرض هذا القسم. يرجى إعادة المحاولة.
      </div>
    );
    return this.props.children;
  }
}