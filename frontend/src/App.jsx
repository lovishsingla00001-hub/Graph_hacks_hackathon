import React, { useState, useEffect, useRef } from 'react';
import ChatWindow from './components/ChatWindow';
import EvidenceInspector from './components/EvidenceInspector';
import MemoryList from './components/MemoryList';
import { getHealth, getMemories, sendChatMessage, API_MODE } from './api';

const DEMO_USERS = [
  { id: 'student_alice', label: 'Alice (visual learner)' },
  { id: 'student_bob', label: 'Bob (fresh graph)' }
];

function generateSessionId() {
  return `sess_${Date.now()}`;
}

export default function App() {
  // localStorage holds only the selected demo user id
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem('recallai_demo_user_id') || 'student_alice';
  });

  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hello! I am RecallAI, your Python tutor powered by FalkorDB graph memory. What concepts are you exploring today?'
    }
  ]);

  const [currentTurnData, setCurrentTurnData] = useState(null);
  const [memories, setMemories] = useState([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [memoriesError, setMemoriesError] = useState(null);

  const [isSending, setIsSending] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);

  // Active user ref to ignore stale async responses if user switches mid-request
  const activeUserRef = useRef(userId);
  useEffect(() => {
    activeUserRef.current = userId;
    localStorage.setItem('recallai_demo_user_id', userId);
  }, [userId]);

  // Initial health check
  useEffect(() => {
    getHealth()
      .then(data => setSystemHealth(data))
      .catch(() => setSystemHealth({ status: 'degraded', database: 'disconnected' }));
  }, []);

  // Initial load and whenever userId changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingMemories(true);
    setMemoriesError(null);

    getMemories(userId)
      .then(res => {
        if (!isCancelled) {
          setMemories(res.memories || []);
        }
      })
      .catch(err => {
        if (!isCancelled) {
          setMemoriesError(err.message || 'Error loading memories');
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingMemories(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  const loadMemories = (targetUser = userId) => {
    setIsLoadingMemories(true);
    setMemoriesError(null);
    getMemories(targetUser)
      .then(res => {
        if (activeUserRef.current === targetUser) {
          setMemories(res.memories || []);
        }
      })
      .catch(err => {
        if (activeUserRef.current === targetUser) {
          setMemoriesError(err.message || 'Error loading memories');
        }
      })
      .finally(() => {
        if (activeUserRef.current === targetUser) {
          setIsLoadingMemories(false);
        }
      });
  };

  // User Switch Handler
  const handleUserChange = (newUserId) => {
    if (newUserId === userId) return;
    setUserId(newUserId);
    setSessionId(generateSessionId());
    setMessages([
      {
        role: 'assistant',
        text: `Switched demo identity to ${newUserId}. Loaded their isolated FalkorDB graph.`
      }
    ]);
    setCurrentTurnData(null);
  };

  // New Conversation Handler (same user_id, new session_id, memory untouched)
  const handleNewConversation = () => {
    const newSess = generateSessionId();
    setSessionId(newSess);
    setMessages([
      {
        role: 'assistant',
        text: 'Started a new conversation session. Your persistent graph memory from previous sessions is preserved.'
      }
    ]);
    setCurrentTurnData(null);
    loadMemories(userId);
  };

  // Send message
  const handleSendMessage = async (text) => {
    const requestUser = userId;
    const requestSession = sessionId;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsSending(true);

    try {
      const turnResponse = await sendChatMessage(requestUser, requestSession, text);

      // Ignore stale responses if user switched
      if (activeUserRef.current !== requestUser) return;

      setMessages(prev => [...prev, { role: 'assistant', text: turnResponse.reply }]);
      setCurrentTurnData(turnResponse);

      // Re-fetch memories to show newly saved/resolved nodes immediately
      loadMemories(requestUser);
    } catch (err) {
      if (activeUserRef.current !== requestUser) return;
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `Error: ${err.message || 'Failed to complete chat turn.'}`,
          isError: true,
          failedText: text
        }
      ]);
    } finally {
      if (activeUserRef.current === requestUser) {
        setIsSending(false);
      }
    }
  };

  const handleRetryLastMessage = () => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.isError && lastMsg.failedText) {
      // Remove the error message and retry
      setMessages(prev => prev.slice(0, -1));
      handleSendMessage(lastMsg.failedText);
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="header-brand">
          <span className="logo-badge">RecallAI</span>
          <div>
            <div className="app-title">RecallAI — Agent Memory & Coordination</div>
            <div className="app-subtitle">FalkorDB Graph Memory • Hackathon Track 2</div>
          </div>
        </div>

        <div className="header-controls">
          <span className={`mode-badge ${API_MODE === 'live' ? 'live' : 'mock'}`}>
            ● {API_MODE.toUpperCase()} MODE
          </span>

          {systemHealth && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: systemHealth.database === 'connected' ? 'var(--accent-emerald)' : 'var(--accent-rose)'
              }}
              title={`FalkorDB: ${systemHealth.database}, LLM Configured: ${systemHealth.llm_configured}`}
            >
              DB: {systemHealth.database}
            </span>
          )}

          <div className="user-selector-group">
            <span className="user-selector-label">Demo Identity:</span>
            <select
              className="user-select"
              value={userId}
              onChange={(e) => handleUserChange(e.target.value)}
              title="Demo identity for testing user isolation, not authentication"
            >
              {DEMO_USERS.map(u => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn-secondary"
            onClick={handleNewConversation}
            title="Start a new session without losing graph memory"
          >
            + New Session
          </button>
        </div>
      </header>

      <main className="app-container">
        {/* Column 1: Chat Window */}
        <ChatWindow
          messages={messages}
          isLoading={isSending}
          onSendMessage={handleSendMessage}
          onRetryLastMessage={handleRetryLastMessage}
        />

        {/* Column 2: "Why this answer?" Evidence Inspector */}
        <EvidenceInspector
          currentTurnData={currentTurnData}
        />

        {/* Column 3: Saved Memories Inspector */}
        <MemoryList
          userId={userId}
          memories={memories}
          isLoading={isLoadingMemories}
          error={memoriesError}
          onRefresh={() => loadMemories(userId)}
        />
      </main>
    </>
  );
}
