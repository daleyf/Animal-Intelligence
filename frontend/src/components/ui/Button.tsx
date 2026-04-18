import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium rounded cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-none";

  const variants = {
    primary: "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
    ghost:
      "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
    danger: "bg-[var(--color-danger)] text-white hover:opacity-90",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      style={{
        background:
          variant === "primary"
            ? "var(--color-accent)"
            : variant === "danger"
            ? "var(--color-danger)"
            : "transparent",
        color:
          variant === "ghost" ? "var(--color-text-muted)" : "white",
        borderRadius: "var(--radius-sm)",
        border: "none",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.4 : 1,
        transition: "background 0.15s, opacity 0.15s",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 500,
        fontFamily: "inherit",
        fontSize: size === "sm" ? "12px" : "14px",
        padding: size === "sm" ? "6px 12px" : "8px 16px",
      }}
      {...props}
    >
      {children}
    </button>
  );
}
