import MessageInput from './MessageInput.jsx';

export default function Welcome({ models, modelError, selectedModel, webSearch, onWebSearchToggle, onStart, onSend }) {
  return (
    <div className="chat">
      <div className="welcome">
        <div className="welcome-icon">🦙</div>
        <h1>Ollama Chat</h1>
        {modelError ? (
          <p style={{ color: 'var(--error)' }}>
            ⚠ {modelError}
          </p>
        ) : models.length === 0 ? (
          <p>Loading available models…</p>
        ) : (
          <p>
            Chat with local LLMs running on your machine.
            <br />
            Select a model in the sidebar and start chatting.
          </p>
        )}
        {!modelError && models.length > 0 && (
          <button className="welcome-start-btn" onClick={onStart} disabled={!selectedModel}>
            Start chatting with {selectedModel || '…'}
          </button>
        )}
        {!modelError && models.length === 0 && (
          <p style={{ color: 'var(--text-3)', fontSize: '12px' }}>
            Pull a model with: <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg-2)', padding: '2px 6px', borderRadius: '4px' }}>ollama pull llama3.2</code>
          </p>
        )}
      </div>
      <div style={{ padding: '0 20px 16px' }}>
        <MessageInput onSend={onSend} disabled={!selectedModel || !!modelError} webSearch={webSearch} onWebSearchToggle={onWebSearchToggle} />
      </div>
    </div>
  );
}
