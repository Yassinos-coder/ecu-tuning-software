import React, { useState, useRef, useEffect } from 'react';
import { useEcuStore } from '../../store/ecuStore';
import { useUiStore } from '../../store/uiStore';
import { AiTuningService, ChatMessage } from '../../../infrastructure/ai/AiTuningService';

const aiService = new AiTuningService();

export function AiChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { getSelectedMap } = useEcuStore();
  const { aiApiKey, aiEndpoint, setAiConfig } = useUiStore();

  const selectedMap = getSelectedMap();

  // Configure AI service when settings change
  useEffect(() => {
    aiService.configure({
      apiKey: aiApiKey || undefined,
      endpoint: aiEndpoint,
      mockMode: !aiApiKey,
    });
  }, [aiApiKey, aiEndpoint]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmedContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await aiService.chat({
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        context: selectedMap
          ? {
              mapTitle: selectedMap.title,
              mapValues: selectedMap.values,
              mapUnits: selectedMap.units,
              mapCategory: selectedMap.category,
            }
          : undefined,
      });

      if (response.success && response.message) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.message!,
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${response.error || 'Failed to get response'}`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    await sendMessage(input);
  };

  const handleQuickAction = async (action: string) => {
    if (!selectedMap || isLoading) return;

    let prompt = '';
    switch (action) {
      case 'explain':
        prompt = `Please explain what the "${selectedMap.title}" map does and how to safely tune it.`;
        break;
      case 'analyze':
        prompt = `Analyze the "${selectedMap.title}" map for any anomalies or potentially dangerous values.`;
        break;
      case 'suggest':
        prompt = `What safe tuning adjustments would you suggest for the "${selectedMap.title}" map?`;
        break;
      default:
        return;
    }

    await sendMessage(prompt);
  };

  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(aiApiKey || '');
  const [tempEndpoint, setTempEndpoint] = useState(aiEndpoint);

  const handleSaveSettings = () => {
    setAiConfig(tempApiKey || null, tempEndpoint);
    setShowSettings(false);
  };

  return (
    <div className="ai-chat-panel">
      <div className="panel-header">
        <h3>🤖 AI Assistant</h3>
        <button
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
          title="AI Settings"
        >
          ⚙️
        </button>
      </div>

      {showSettings && (
        <div className="settings-panel">
          <div className="setting-group">
            <label>API Key</label>
            <input
              type="password"
              placeholder="sk-..."
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
            />
          </div>
          <div className="setting-group">
            <label>API Endpoint</label>
            <input
              type="text"
              placeholder="https://api.openai.com/v1"
              value={tempEndpoint}
              onChange={(e) => setTempEndpoint(e.target.value)}
            />
          </div>
          <div className="setting-actions">
            <button onClick={() => setShowSettings(false)}>Cancel</button>
            <button onClick={handleSaveSettings} className="primary">
              Save
            </button>
          </div>
          {!aiApiKey && (
            <p className="mock-mode-notice">
              Running in offline mode. Add an API key for full AI capabilities.
            </p>
          )}
        </div>
      )}

      {selectedMap && (
        <div className="quick-actions">
          <button onClick={() => handleQuickAction('explain')}>
            📖 Explain
          </button>
          <button onClick={() => handleQuickAction('analyze')}>
            🔍 Analyze
          </button>
          <button onClick={() => handleQuickAction('suggest')}>
            💡 Suggest
          </button>
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <p>👋 Hi! I'm your ECU tuning assistant.</p>
            <p>I can help you:</p>
            <ul>
              <li>Explain what maps and parameters do</li>
              <li>Suggest safe tuning adjustments</li>
              <li>Analyze your calibration for issues</li>
              <li>Answer questions about ECU tuning</li>
            </ul>
            <p>Select a map and ask me anything!</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-header">
                <span className="role">
                  {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                </span>
                {msg.timestamp && (
                  <span className="time">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="message-content">
                <MarkdownContent content={msg.content} />
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="message assistant loading">
            <div className="message-content">
              <span className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            selectedMap
              ? `Ask about ${selectedMap.title}...`
              : 'Select a map to ask questions...'
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isLoading}
        />
        <button
          id="ai-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="send-btn"
        >
          Send
        </button>
      </div>

      <style>{`
        .ai-chat-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .panel-header h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0;
        }

        .settings-btn {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 14px;
        }

        .settings-btn:hover {
          background-color: var(--bg-hover);
        }

        .settings-panel {
          padding: 12px 16px;
          background-color: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
        }

        .setting-group {
          margin-bottom: 12px;
        }

        .setting-group label {
          display: block;
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }

        .setting-group input {
          width: 100%;
          padding: 8px;
          font-size: 12px;
        }

        .setting-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .setting-actions button {
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
        }

        .setting-actions button.primary {
          background-color: var(--accent-primary);
          border-color: var(--accent-primary);
          color: white;
        }

        .mock-mode-notice {
          margin-top: 12px;
          padding: 8px;
          background-color: rgba(234, 179, 8, 0.1);
          border-radius: 4px;
          font-size: 11px;
          color: var(--accent-warning);
        }

        .quick-actions {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .quick-actions button {
          flex: 1;
          padding: 8px;
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-size: 12px;
          transition: all var(--transition-fast);
        }

        .quick-actions button:hover {
          background-color: var(--bg-hover);
          border-color: var(--border-light);
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .welcome-message {
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.6;
        }

        .welcome-message ul {
          padding-left: 20px;
          margin: 8px 0;
        }

        .welcome-message li {
          margin-bottom: 4px;
        }

        .message {
          margin-bottom: 16px;
        }

        .message-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .role {
          font-size: 12px;
          font-weight: 500;
        }

        .time {
          font-size: 10px;
          color: var(--text-muted);
        }

        .message-content {
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.6;
        }

        .message.user .message-content {
          background-color: var(--accent-primary);
          color: white;
          margin-left: 24px;
        }

        .message.assistant .message-content {
          background-color: var(--bg-tertiary);
          margin-right: 24px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background-color: var(--text-muted);
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .input-container {
          padding: 12px 16px;
          border-top: 1px solid var(--border-color);
          display: flex;
          gap: 8px;
        }

        .input-container textarea {
          flex: 1;
          min-height: 60px;
          max-height: 120px;
          resize: vertical;
          padding: 10px;
          font-size: 13px;
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
        }

        .input-container textarea:focus {
          border-color: var(--accent-primary);
        }

        .send-btn {
          padding: 0 16px;
          background-color: var(--accent-primary);
          color: white;
          border-radius: 6px;
          font-weight: 500;
          align-self: flex-end;
          height: 40px;
        }

        .send-btn:hover:not(:disabled) {
          background-color: var(--accent-secondary);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

/**
 * Simple markdown renderer
 */
function MarkdownContent({ content }: { content: string }) {
  const html = renderMarkdownToHtml(content);

  return (
    <div
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMarkdownToHtml(content: string): string {
  const lines = escapeHtml(content).split('\n');
  const htmlParts: string[] = [];
  const codeLines: string[] = [];
  let inList = false;
  let inCodeBlock = false;

  const closeList = () => {
    if (inList) {
      htmlParts.push('</ul>');
      inList = false;
    }
  };

  const closeCodeBlock = () => {
    if (inCodeBlock) {
      htmlParts.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
      codeLines.length = 0;
      inCodeBlock = false;
    }
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      closeList();
      if (inCodeBlock) {
        closeCodeBlock();
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    if (line.startsWith('### ')) {
      closeList();
      htmlParts.push(`<h4>${applyInlineMarkdown(line.slice(4))}</h4>`);
      continue;
    }

    if (line.startsWith('## ')) {
      closeList();
      htmlParts.push(`<h3>${applyInlineMarkdown(line.slice(3))}</h3>`);
      continue;
    }

    if (line.startsWith('# ')) {
      closeList();
      htmlParts.push(`<h2>${applyInlineMarkdown(line.slice(2))}</h2>`);
      continue;
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        htmlParts.push('<ul>');
        inList = true;
      }
      htmlParts.push(`<li>${applyInlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    closeList();
    htmlParts.push(`<p>${applyInlineMarkdown(line)}</p>`);
  }

  closeCodeBlock();
  closeList();

  return htmlParts.join('');
}

function applyInlineMarkdown(content: string): string {
  return content
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function escapeHtml(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
