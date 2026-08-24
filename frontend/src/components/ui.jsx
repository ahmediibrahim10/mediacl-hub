import React from 'react';
import { motion } from 'framer-motion';

export function Card({ children, className = "", onClick, hover = true }) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hover ? { y: -5, scale: 1.02, transition: { duration: 0.2 } } : {}}
      className={`bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-2xl rounded-3xl transition-all duration-300 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function Button({ children, variant = "primary", className = "", onClick, disabled, icon }) {
  const base = "px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center transition-all duration-300 cursor-pointer disabled:opacity-50 select-none";
  const styles = {
    primary: "bg-cyan-500 text-slate-950 font-bold hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] border border-transparent",
    secondary: "bg-white/[0.05] text-white hover:bg-white/[0.1] border border-white/[0.1] shadow-sm",
    danger: "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30",
    ghost: "text-slate-400 hover:text-white hover:bg-white/[0.05]"
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