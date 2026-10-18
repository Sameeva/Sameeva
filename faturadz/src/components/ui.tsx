"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

type Variant = "primary" | "secondary" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-contrast hover:opacity-90",
  secondary: "border border-border bg-surface hover:bg-background",
  danger: "border border-danger text-danger hover:bg-background",
};

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

const inputClass = "w-full rounded-md border border-border px-2 py-1.5 text-sm focus:outline-2 focus:outline-accent";

interface FieldShellProps {
  label: string;
  hint?: string | null;
  warning?: string | null;
  error?: string | null;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

function FieldShell({ label, hint, warning, error, children }: FieldShellProps) {
  const id = useId();
  const message = error ?? warning ?? hint;
  const describedBy = message ? `${id}-msg` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children(id, describedBy)}
      {message && (
        <p id={describedBy} className={`text-xs ${error ? "text-danger" : warning ? "text-warn" : "text-muted"}`} role={error ? "alert" : undefined}>
          {message}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string | null;
  warning?: string | null;
  error?: string | null;
};

export function TextField({ label, value, onChange, hint, warning, error, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} warning={warning} error={error}>
      {(id, describedBy) => (
        <input
          id={id}
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
      )}
    </FieldShell>
  );
}

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function TextArea({ label, value, onChange, ...props }: TextAreaProps) {
  return (
    <FieldShell label={label}>
      {(id) => <textarea id={id} className={inputClass} rows={3} value={value} onChange={(e) => onChange(e.target.value)} {...props} />}
    </FieldShell>
  );
}

type SelectProps<T extends string> = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
};

export function SelectField<T extends string>({ label, value, options, onChange, ...props }: SelectProps<T>) {
  return (
    <FieldShell label={label}>
      {(id) => (
        <select
          id={id}
          className={inputClass}
          value={value}
          onChange={(e) => {
            const next = options.find((o) => o.value === e.target.value);
            if (next) onChange(next.value);
          }}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function Checkbox({ label, checked, onChange, hint, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-2 text-sm">
        <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {hint && <p className="ms-6 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "success"; children: ReactNode }) {
  const tones = {
    info: "border-border text-muted",
    warn: "border-warn text-warn",
    danger: "border-danger text-danger",
    success: "border-accent text-accent",
  };
  return (
    <p className={`rounded-md border px-3 py-2 text-sm ${tones[tone]}`} role={tone === "danger" ? "alert" : "status"}>
      {children}
    </p>
  );
}
