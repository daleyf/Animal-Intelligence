import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, ...props }: InputProps) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--color-text)",
    padding: "8px 12px",
    fontSize: "14px",
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.15s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && (
        <label
          htmlFor={id}
          style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 500 }}
        >
          {label}
        </label>
      )}
      <input id={id} style={inputStyle} {...props} />
    </div>
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function TextArea({ label, id, ...props }: TextAreaProps) {
  const style: React.CSSProperties = {
    width: "100%",
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--color-text)",
    padding: "8px 12px",
    fontSize: "14px",
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical",
    minHeight: "80px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && (
        <label
          htmlFor={id}
          style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 500 }}
        >
          {label}
        </label>
      )}
      <textarea id={id} style={style} {...props} />
    </div>
  );
}
