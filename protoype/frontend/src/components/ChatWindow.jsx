import { useEffect, useRef } from 'react';
import MessageInput from './MessageInput.jsx';

function renderContent(text) {
  const parts = [];
  let key = 0;
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  codeBlockRegex.lastIndex = 0;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<InlineText key={key++} text={text.slice(lastIndex, match.index)} />);
    }
    parts.push(<pre key={key++}><code>{match[2].trim()}</code></pre>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<InlineText key={key++} text={text.slice(lastIndex)} />);
  }
  return parts.length > 0 ? parts : <InlineText text={text} />;
}

function InlineText({ text }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const parts = line.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {i > 0 && <br />}
            {parts.map((part, j) =>
              part.startsWith('`') && part.endsWith('`') && part.length > 2
                ? <code key={j}>{part.slice(1, -1)}</code>
                : <span key={j}>{part}</span>
            )}
          </span>
        );
      })}
    </>
  );
}

function SearchResults({ results }) {
  if (!results?.length) return null;
  return (
    <div className="search-results">
      <div className="search-results-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        Web sources
      </div>
      <div className="search-result-list">
        {results.map((r, i) => (
          <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="search-result-item">
            <span className="search-result-num">{i + 1}</span>
            <span className="search-result-title">{r.title || r.url}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Message({ msg }) {
  return (
    <div className={`message ${msg.role}`}>
      <div className="msg-avatar">
        {msg.role === 'user' ? '👤' : '🦙'}
      </div>
      <div className="msg-bubble-wrap">
        {msg.role === 'user' && msg.webSearch && (
          <div className="msg-web-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Web search
          </div>
        )}
        <div className="msg-bubble">
          {msg.error ? (
            <span className="msg-error">⚠ {msg.error}</span>
          ) : msg.statusText ? (
            <span className="msg-status">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              {' '}{msg.statusText}
            </span>
          ) : msg.content === '' && msg.streaming ? (
            <span>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          ) : (
            <>
              {msg.searchResults && <SearchResults results={msg.searchResults} />}
              {renderContent(msg.content)}
              {msg.streaming && <span className="cursor" />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatWindow({ messages, streaming, convTitle, model, webSearch, onWebSearchToggle, onSend }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat">
      <div className="chat-header">
        <span className="chat-header-title">{convTitle}</span>
        <span className="chat-header-model">{model}</span>
      </div>

      <div className="messages">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <MessageInput
          onSend={onSend}
          disabled={streaming}
          webSearch={webSearch}
          onWebSearchToggle={onWebSearchToggle}
        />
        <div className="input-hint">
          {streaming ? 'Generating…' : webSearch ? 'Web search on · Enter to send · Shift+Enter for new line' : 'Enter to send · Shift+Enter for new line'}
        </div>
      </div>
    </div>
  );
}
