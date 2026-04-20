export default function Sidebar({
  models, modelError, selectedModel, onModelChange,
  conversations, activeConvId, onSelectConv, onNewChat, onDeleteConv,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">🦙</span>
          <span className="sidebar-logo-text">Ollama Chat</span>
        </div>
        <button
          className="new-chat-btn"
          onClick={onNewChat}
          disabled={!selectedModel || !!modelError}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Chat
        </button>
      </div>

      <div className="model-selector">
        <label>Model</label>
        {modelError ? (
          <div className="model-error">⚠ {modelError}</div>
        ) : models.length === 0 ? (
          <div className="model-hint">Loading models…</div>
        ) : (
          <>
            <select
              className="model-select"
              value={selectedModel}
              onChange={e => onModelChange(e.target.value)}
            >
              {models.map(m => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
            <div className="model-hint">{models.length} model{models.length !== 1 ? 's' : ''} available</div>
          </>
        )}
      </div>

      <div className="conv-list">
        {conversations.length === 0 ? (
          <div className="conv-list-empty">
            No conversations yet.<br />Start a new chat above.
          </div>
        ) : (
          conversations.map(conv => (
            <div
              key={conv.id}
              className={`conv-item${activeConvId === conv.id ? ' active' : ''}`}
              onClick={() => onSelectConv(conv.id)}
            >
              <span className="conv-item-icon">💬</span>
              <div className="conv-item-text">
                <div className="conv-item-title">{conv.title}</div>
                <div className="conv-item-meta">{conv.model} · {conv.messageCount} msg{conv.messageCount !== 1 ? 's' : ''}</div>
              </div>
              <button
                className="conv-item-delete"
                title="Delete conversation"
                onClick={e => { e.stopPropagation(); onDeleteConv(conv.id); }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
