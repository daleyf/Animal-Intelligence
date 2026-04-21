import { Link, useLocation } from "react-router-dom";
import { ConversationList } from "@/components/sidebar/ConversationList";
import { NewChatButton } from "@/components/sidebar/NewChatButton";
import { ConversationSearch } from "@/components/sidebar/ConversationSearch";
import { useState } from "react";
import anchorpointLogo from "@/assets/AnchorpointLogo.svg";

const NAV_ITEMS = [
  { label: "Chat", path: "/", icon: ChatIcon },
  { label: "Research", path: "/research", icon: SearchIcon },
  { label: "Daily Report", path: "/report", icon: SunIcon },
  { label: "Activity Log", path: "/activity", icon: ListIcon },
];

export function Sidebar() {
  const location = useLocation();
  const [search, setSearch] = useState("");

  return (
    <div
      style={{
        width: "var(--sidebar-width)",
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        height: "100%",
      }}
    >
      {/* ── Branding ── */}
      <div
        style={{
          padding: "20px 16px 16px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          gap: "11px",
        }}
      >
        <img
          src={anchorpointLogo}
          alt=""
          style={{ width: "26px", height: "26px", flexShrink: 0, opacity: 0.95 }}
        />
        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--color-text-strong)",
              letterSpacing: "-0.2px",
              lineHeight: 1.15,
            }}
          >
            Anchorpoint
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "var(--color-text-muted)",
              marginTop: "3px",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Local &amp; private
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ padding: "8px 8px 4px" }}>
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const isActive =
            path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                padding: "7px 9px",
                borderRadius: "var(--radius-sm)",
                color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                background: isActive ? "rgba(245,245,242,0.06)" : "transparent",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: isActive ? 500 : 400,
                transition: "background 0.12s, color 0.12s",
                marginBottom: "1px",
              }}
            >
              <Icon active={isActive} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── Conversations ── */}
      <div
        style={{
          padding: "10px 8px 4px",
          borderTop: "1px solid var(--color-border)",
          marginTop: "6px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "2px 4px 8px",
          }}
        >
          Conversations
        </div>
        <NewChatButton />
        <ConversationSearch value={search} onChange={setSearch} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "2px 8px 8px" }}>
        <ConversationList search={search} />
      </div>

      {/* ── Settings pinned at bottom ── */}
      <div
        style={{
          padding: "8px",
          borderTop: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      >
        {(() => {
          const isActive = location.pathname.startsWith("/settings");
          return (
            <Link
              to="/settings/general"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                padding: "7px 9px",
                borderRadius: "var(--radius-sm)",
                color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                background: isActive ? "rgba(245,245,242,0.06)" : "transparent",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: isActive ? 500 : 400,
                transition: "background 0.12s, color 0.12s",
              }}
            >
              <GearIcon active={isActive} />
              Settings
            </Link>
          );
        })()}
      </div>
    </div>
  );
}

/* ── Inline SVG icons ─────────────────────────────────────────────────────── */

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, opacity: active ? 1 : 0.55 }}>
      <path d="M1.5 2.5h12a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H9l-2 2-2-2H1.5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5Z" stroke="#0078FF" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

function SunIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, opacity: active ? 1 : 0.55 }}>
      <circle cx="7.5" cy="7.5" r="2.5" stroke="#0078FF" strokeWidth="1.2"/>
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.1 3.1l1.1 1.1M10.8 10.8l1.1 1.1M10.8 3.1l-1.1 1.1M4.2 10.8l-1.1 1.1" stroke="#0078FF" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, opacity: active ? 1 : 0.55 }}>
      <path d="M2 4h11M2 7.5h11M2 11h11" stroke="#0078FF" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, opacity: active ? 1 : 0.55 }}>
      <path d="M6.3 1.5h2.4l.4 1.6a5 5 0 0 1 1.2.7l1.6-.5 1.2 2-1.2 1.2a5 5 0 0 1 0 1.4l1.2 1.2-1.2 2-1.6-.5a5 5 0 0 1-1.2.7l-.4 1.6H6.3l-.4-1.6a5 5 0 0 1-1.2-.7l-1.6.5-1.2-2 1.2-1.2a5 5 0 0 1 0-1.4L1.9 5.5l1.2-2 1.6.5a5 5 0 0 1 1.2-.7l.4-1.6Z" stroke="#0078FF" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="7.5" cy="7.5" r="1.8" stroke="#0078FF" strokeWidth="1.2"/>
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, opacity: active ? 1 : 0.5 }}>
      <circle cx="5.5" cy="5.5" r="3.8" stroke="#0078FF" strokeWidth="1.2"/>
      <line x1="8.5" y1="8.5" x2="11.5" y2="11.5" stroke="#0078FF" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
