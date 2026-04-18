import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { label: "General", path: "/settings/general" },
  { label: "Models", path: "/settings/models" },
  { label: "Profile", path: "/settings/profile" },
  { label: "Memory", path: "/settings/memory" },
  { label: "Integrations", path: "/settings/integrations" },
  { label: "Voice", path: "/settings/voice" },
];

export function SettingsPage() {
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Settings sub-nav */}
      <div
        style={{
          width: "180px",
          borderRight: "1px solid var(--color-border)",
          padding: "16px 8px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            padding: "4px 8px 10px",
          }}
        >
          Settings
        </div>
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            style={({ isActive }) => ({
              display: "block",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              background: isActive ? "var(--color-surface-2)" : "transparent",
              color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: isActive ? 500 : 400,
              transition: "background 0.1s, color 0.1s",
            })}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Settings content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        <Outlet />
      </div>
    </div>
  );
}
