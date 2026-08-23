import React, { useState, Component } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, errorInfo: null, showDetails: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("Rendering Error:", error, errorInfo); this.setState({ error, errorInfo }); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-3xl text-center animate-in fade-in mt-6">
          <AlertTriangle size={48} className="text-rose-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-rose-800 dark:text-rose-400 mb-2">Couldn't display this result</h3>
          <div className="flex justify-center gap-4 mb-4">
            <Button variant="primary" onClick={() => window.location.reload()}>Reload Page</Button>
            <Button variant="secondary" onClick={() => this.setState({ showDetails: !this.state.showDetails })}>
              {this.state.showDetails ? 'Hide Details' : 'View Technical Details'}
            </Button>
          </div>
          {this.state.showDetails && (
            <pre className="text-left text-xs bg-white p-4 rounded-xl overflow-auto text-rose-900 border mt-4 max-h-64">
              {this.state.error && this.state.error.toString()}<br/><br/>{this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, icon = null }) => {
  const baseStyle = "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-teal-600 text-white hover:bg-teal-700 shadow-sm",
    secondary: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 hover:bg-slate-50 shadow-sm",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 border border-transparent"
  };
  return <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>{icon}{children}</button>;
};

export const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-all' : ''} ${className}`}>{children}</div>
);

export const Accordion = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-3">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <span className="font-bold text-slate-700 dark:text-slate-200">{title}</span>
        {open ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
      </button>
      {open && <div className="p-5 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{children}</div>}
    </div>
  );
};