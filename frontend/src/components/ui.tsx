import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ---- Button ------------------------------------------------------------
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
};
export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
    secondary: "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button
      className={cx(base, variants[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

// ---- Inputs ------------------------------------------------------------
export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 mb-1.5">{children}</label>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30",
        props.className
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30",
        props.className
      )}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ---- Card --------------------------------------------------------------
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}

// ---- Alert -------------------------------------------------------------
export function Alert({
  kind = "info",
  children,
}: {
  kind?: "info" | "success" | "error" | "warn";
  children: ReactNode;
}) {
  const styles = {
    info: "bg-brand-50 text-brand-800 border-brand-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    error: "bg-red-50 text-red-700 border-red-200",
    warn: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return (
    <div className={cx("rounded-lg border px-4 py-3 text-sm", styles[kind])}>
      {children}
    </div>
  );
}

// ---- Badge -------------------------------------------------------------
export function Badge({
  children,
  kind = "neutral",
}: {
  children: ReactNode;
  kind?: "neutral" | "success" | "error" | "warn";
}) {
  const styles = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    error: "bg-red-100 text-red-700",
    warn: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[kind]
      )}
    >
      {children}
    </span>
  );
}

// ---- Spinner -----------------------------------------------------------
export function Spinner({ small }: { small?: boolean }) {
  return (
    <svg
      className={cx("animate-spin text-current", small ? "h-4 w-4" : "h-6 w-6")}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
      />
    </svg>
  );
}

export { cx };
