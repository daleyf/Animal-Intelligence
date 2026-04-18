import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "info" | "error" | "success";
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = "info", onClose, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  const bgColors = {
    info: "var(--color-surface-2)",
    error: "rgba(224,85,85,0.15)",
    success: "rgba(76,175,125,0.15)",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        background: bgColors[type],
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "12px 18px",
        maxWidth: "340px",
        fontSize: "13px",
        color: "var(--color-text)",
        zIndex: 2000,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.3s, transform 0.3s",
      }}
    >
      {message}
    </div>
  );
}

/** Simple toast manager hook. */
export function useToast() {
  const [toasts, setToasts] = useState<
    Array<{ id: number; message: string; type: "info" | "error" | "success" }>
  >([]);
  let nextId = 0;

  const show = (message: string, type: "info" | "error" | "success" = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const remove = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const ToastContainer = () => (
    <>
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />
      ))}
    </>
  );

  return { show, ToastContainer };
}
