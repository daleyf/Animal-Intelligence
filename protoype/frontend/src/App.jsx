import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import Welcome from './components/Welcome.jsx';

const API = '/api';
const PREFERRED_MODEL = 'llama3.2:1b';

export default function App() {
  const [models, setModels] = useState([]);
  const [modelError, setModelError] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [webSearch, setWebSearch] = useState(false);

  // Load models — default to llama3.2:1b if available
  useEffect(() => {
    fetch(`${API}/models`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setModelError(data.error); return; }
        setModels(data);
        if (data.length > 0) {
          const preferred = data.find(m => m.name === PREFERRED_MODEL) ?? data[0];
          setSelectedModel(preferred.name);
        }
      })
      .catch(() => setModelError('Cannot connect to backend. Is it running?'));
  }, []);

  // Load conversations
  useEffect(() => {
    fetch(`${API}/conversations`)
      .then(r => r.json())
      .then(setConversations)
      .catch(() => {});
  }, []);

  const refreshConversations = useCallback(() => {
    fetch(`${API}/conversations`)
      .then(r => r.json())
      .then(setConversations)
      .catch(() => {});
  }, []);

  const loadConversation = useCallback((convId) => {
    fetch(`${API}/conversations/${convId}`)
      .then(r => r.json())
      .then(conv => {
        setActiveConvId(conv.id);
        setMessages(conv.messages || []);
        setSelectedModel(conv.model || selectedModel);
      })
      .catch(() => {});
  }, [selectedModel]);

  const newChat = useCallback(async () => {
    if (!selectedModel) return;
    const res = await fetch(`${API}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel }),
    });
    const conv = await res.json();
    setActiveConvId(conv.id);
    setMessages([]);
    refreshConversations();
  }, [selectedModel, refreshConversations]);

  const deleteConversation = useCallback(async (convId) => {
    await fetch(`${API}/conversations/${convId}`, { method: 'DELETE' });
    if (activeConvId === convId) {
      setActiveConvId(null);
      setMessages([]);
    }
    refreshConversations();
  }, [activeConvId, refreshConversations]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !selectedModel || streaming) return;

    let convId = activeConvId;
    if (!convId) {
      const res = await fetch(`${API}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      });
      const conv = await res.json();
      convId = conv.id;
      setActiveConvId(convId);
    }

    const userMsg = { role: 'user', content: text, webSearch };
    const assistantMsg = { role: 'assistant', content: '', streaming: true, searchResults: null, statusText: null };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const response = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, message: text, model: selectedModel, webSearch }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.error) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: '', error: data.error, streaming: false };
                return updated;
              });
              setStreaming(false);
              return;
            }

            if (data.status) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], statusText: data.status };
                return updated;
              });
            }

            if (data.searchResults) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], searchResults: data.searchResults, statusText: null };
                return updated;
              });
            }

            if (data.token) {
              setMessages(prev => {
                const updated = [...prev];
                const last = { ...updated[updated.length - 1] };
                last.content += data.token;
                updated[updated.length - 1] = last;
                return updated;
              });
            }

            if (data.done) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false, statusText: null };
                return updated;
              });
              setStreaming(false);
              refreshConversations();
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: '', error: err.message, streaming: false };
        return updated;
      });
      setStreaming(false);
    }
  }, [activeConvId, selectedModel, streaming, webSearch, refreshConversations]);

  return (
    <div className="app">
      <Sidebar
        models={models}
        modelError={modelError}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConv={loadConversation}
        onNewChat={newChat}
        onDeleteConv={deleteConversation}
      />
      <main className="main">
        {activeConvId ? (
          <ChatWindow
            messages={messages}
            streaming={streaming}
            convTitle={conversations.find(c => c.id === activeConvId)?.title || 'Chat'}
            model={selectedModel}
            webSearch={webSearch}
            onWebSearchToggle={() => setWebSearch(v => !v)}
            onSend={sendMessage}
          />
        ) : (
          <Welcome
            models={models}
            modelError={modelError}
            selectedModel={selectedModel}
            webSearch={webSearch}
            onWebSearchToggle={() => setWebSearch(v => !v)}
            onStart={newChat}
            onSend={sendMessage}
          />
        )}
      </main>
    </div>
  );
}
