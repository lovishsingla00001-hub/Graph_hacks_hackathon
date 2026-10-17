import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import EvidenceDrawer from './components/EvidenceDrawer';
import { RenameModal, DeleteModal } from './components/Modals';
import {
  getHealth,
  getMemories,
  sendChatMessage,
  listSessions,
  getSession,
  renameSession,
  deleteSession,
  getLocalSessions,
  saveLocalSession,
  deleteLocalSession
} from './api';

const DEMO_USERS = [
  { id: 'student_alice', label: 'Alice (visual learner)' },
  { id: 'student_bob', label: 'Bob (fresh graph)' }
];

function generateSessionId() {
  return `sess_${Date.now()}`;
}

export default function App() {
  // Selected demo student identity
  const [userId, setUserId] = useState(() => {
    try {
      return localStorage.getItem('recallai_demo_user_id') || 'student_alice';
    } catch {
      return 'student_alice';
    }
  });

  // Active session and conversation messages
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTurnData, setCurrentTurnData] = useState(null);

  // FalkorDB Memories
  const [memories, setMemories] = useState([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [memoriesError, setMemoriesError] = useState(null);

  // Health and Storage Status
  const [systemHealth, setSystemHealth] = useState(null);
  const [isHistoryOffline, setIsHistoryOffline] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // UI Drawer and Sidebar state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('evidence');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modals state
  const [renameModal, setRenameModal] = useState({ isOpen: false, session: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, session: null });

  // Refs for tracking active user and search input
  const activeUserRef = useRef(userId);
  const activeSessionRef = useRef(sessionId);
  const searchInputRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => {
    activeUserRef.current = userId;
    try {
      localStorage.setItem('recallai_demo_user_id', userId);
    } catch {
      // Ignore
    }
  }, [userId]);

  useEffect(() => {
    activeSessionRef.current = sessionId;
  }, [sessionId]);

  // Load backend and database health
  useEffect(() => {
    getHealth()
      .then(data => setSystemHealth(data))
      .catch(() => setSystemHealth({ status: 'degraded', database: 'disconnected', supabase: 'unavailable' }));
  }, []);

  // Fetch FalkorDB graph memories for a user
  const loadMemories = useCallback((targetUser = userId) => {
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
          setMemoriesError(err.message || 'Error loading graph memories');
        }
      })
      .finally(() => {
        if (activeUserRef.current === targetUser) {
          setIsLoadingMemories(false);
        }
      });
  }, [userId]);

  // Fetch chat sessions from Supabase with graceful localStorage fallback
  const loadSessions = useCallback((targetUser = userId) => {
    listSessions(targetUser)
      .then(remoteSessions => {
        if (activeUserRef.current === targetUser) {
          setSessions(remoteSessions);
          setIsHistoryOffline(false);
        }
      })
      .catch(() => {
        // Supabase unreachable -> Fallback gracefully to localStorage
        if (activeUserRef.current === targetUser) {
          const local = getLocalSessions(targetUser);
          setSessions(local);
          setIsHistoryOffline(true);
        }
      });
  }, [userId]);

  // Initial load and user identity changes
  useEffect(() => {
    loadMemories(userId);
    loadSessions(userId);
  }, [userId, loadMemories, loadSessions]);

  // Global Keyboard Shortcuts (Esc closes modals/drawers; Ctrl+K / Cmd+K focuses search)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (renameModal.isOpen) {
          setRenameModal({ isOpen: false, session: null });
        } else if (deleteModal.isOpen) {
          setDeleteModal({ isOpen: false, session: null });
        } else if (isDrawerOpen) {
          setIsDrawerOpen(false);
        } else if (isSidebarOpen) {
          setIsSidebarOpen(false);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [renameModal.isOpen, deleteModal.isOpen, isDrawerOpen, isSidebarOpen]);

  // User Switch Handler
  const handleUserChange = (newUserId) => {
    if (newUserId === userId) return;
    setUserId(newUserId);
    const newSess = generateSessionId();
    setSessionId(newSess);
    setMessages([]);
    setCurrentTurnData(null);
    setIsSidebarOpen(false);
  };

  // Start a New Chat
  const handleNewChat = () => {
    const newSess = generateSessionId();
    setSessionId(newSess);
    setMessages([]);
    setCurrentTurnData(null);
    setIsSidebarOpen(false);
    setTimeout(() => chatInputRef.current?.focus(), 50);
  };

  // Select a Chat from Sidebar
  const handleSelectSession = (targetSessionId) => {
    if (targetSessionId === sessionId && messages.length > 0) {
      setIsSidebarOpen(false);
      return;
    }

    setSessionId(targetSessionId);
    setIsSidebarOpen(false);

    getSession(targetSessionId, userId)
      .then(detail => {
        if (activeSessionRef.current === targetSessionId && activeUserRef.current === userId) {
          const historyMsgs = (detail.messages || []).map(m => ({
            role: m.role,
            text: m.text,
            turn: m.turn,
            created_at: m.created_at
          }));
          setMessages(historyMsgs);

          // Find latest assistant turn evidence
          const lastAsst = [...historyMsgs].reverse().find(m => m.role === 'assistant' && m.turn);
          setCurrentTurnData(lastAsst ? lastAsst.turn : null);
        }
      })
      .catch(() => {
        // Fallback to local session if remote load fails
        const local = getLocalSessions(userId);
        const match = local.find(s => s.id === targetSessionId);
        if (match && activeSessionRef.current === targetSessionId) {
          setMessages(match.messages || []);
          const lastAsst = [...(match.messages || [])].reverse().find(m => m.role === 'assistant' && m.turn);
          setCurrentTurnData(lastAsst ? lastAsst.turn : null);
        }
      });
  };

  // Send Message
  const handleSendMessage = async (text) => {
    const reqUser = userId;
    const reqSession = sessionId;

    const userMsg = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setIsSending(true);

    try {
      const turnResponse = await sendChatMessage(reqUser, reqSession, text);

      // Epoch guard: ignore if user switched mid-request
      if (activeUserRef.current !== reqUser || activeSessionRef.current !== reqSession) {
        return;
      }

      const asstMsg = {
        role: 'assistant',
        text: turnResponse.reply,
        turn: turnResponse
      };

      setMessages(prev => [...prev, asstMsg]);
      setCurrentTurnData(turnResponse);

      // Refresh graph memories in FalkorDB
      loadMemories(reqUser);

      // Refresh session list so newly created session appears with backend-generated title
      loadSessions(reqUser);

      // If offline storage active, save locally
      if (isHistoryOffline) {
        saveLocalSession(reqUser, {
          id: reqSession,
          title: text.slice(0, 40),
          messages: [...messages, userMsg, asstMsg]
        });
      }
    } catch (err) {
      if (activeUserRef.current !== reqUser || activeSessionRef.current !== reqSession) {
        return;
      }

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
      if (activeUserRef.current === reqUser && activeSessionRef.current === reqSession) {
        setIsSending(false);
      }
    }
  };

  // Retry Last Message
  const handleRetryLastMessage = () => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.isError && lastMsg.failedText) {
      setMessages(prev => prev.slice(0, -1));
      handleSendMessage(lastMsg.failedText);
    }
  };

  // Rename Session Handlers
  const handleOpenRename = (session) => {
    setRenameModal({ isOpen: true, session });
  };

  const handleSaveRename = async (newTitle) => {
    const sessionToRename = renameModal.session;
    if (!sessionToRename) return;

    try {
      await renameSession(sessionToRename.id, userId, newTitle);
      setSessions(prev =>
        prev.map(s => (s.id === sessionToRename.id ? { ...s, title: newTitle } : s))
      );
      if (isHistoryOffline) {
        saveLocalSession(userId, { ...sessionToRename, title: newTitle });
      }
    } catch (err) {
      console.error('Rename failed:', err);
    } finally {
      setRenameModal({ isOpen: false, session: null });
    }
  };

  // Delete Session Handlers
  const handleOpenDelete = (session) => {
    setDeleteModal({ isOpen: true, session });
  };

  const handleConfirmDelete = async () => {
    const sessionToDelete = deleteModal.session;
    if (!sessionToDelete) return;

    try {
      await deleteSession(sessionToDelete.id, userId);
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
      if (isHistoryOffline) {
        deleteLocalSession(userId, sessionToDelete.id);
      }
      // If deleted active session, start a new chat
      if (sessionToDelete.id === sessionId) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleteModal({ isOpen: false, session: null });
    }
  };

  // "Why this answer?" Evidence trigger
  const handleOpenEvidence = (turnData) => {
    if (turnData) {
      setCurrentTurnData(turnData);
    }
    setDrawerTab('evidence');
    setIsDrawerOpen(true);
  };

  const currentUserObj = DEMO_USERS.find(u => u.id === userId) || { label: userId };
  const activeMemoriesCount = memories.filter(m => m.status === 'active').length;

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        systemHealth={systemHealth}
        isHistoryOffline={isHistoryOffline}
        activeMemoriesCount={activeMemoriesCount}
        isDrawerOpen={isDrawerOpen}
        onToggleDrawer={() => setIsDrawerOpen(prev => !prev)}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
      />

      {/* Main Layout Body */}
      <div className="app-body">
        {/* Left Sidebar */}
        <Sidebar
          sessions={sessions}
          activeSessionId={sessionId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onOpenRename={handleOpenRename}
          onOpenDelete={handleOpenDelete}
          userId={userId}
          demoUsers={DEMO_USERS}
          onUserChange={handleUserChange}
          isHistoryOffline={isHistoryOffline}
          isOpen={isSidebarOpen}
          searchInputRef={searchInputRef}
        />

        {/* Center Chat Area */}
        <ChatArea
          messages={messages}
          isLoading={isSending}
          onSendMessage={handleSendMessage}
          onRetry={handleRetryLastMessage}
          onOpenEvidence={handleOpenEvidence}
          demoUserLabel={currentUserObj.label}
          inputRef={chatInputRef}
        />

        {/* Right Slide-out Graph Evidence Drawer */}
        <EvidenceDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          activeTab={drawerTab}
          onTabChange={setDrawerTab}
          currentTurnData={currentTurnData}
          memories={memories}
          isLoadingMemories={isLoadingMemories}
          memoriesError={memoriesError}
          onRefreshMemories={() => loadMemories(userId)}
          userId={userId}
        />
      </div>

      {/* Modals */}
      <RenameModal
        isOpen={renameModal.isOpen}
        initialTitle={renameModal.session?.title || ''}
        onSave={handleSaveRename}
        onClose={() => setRenameModal({ isOpen: false, session: null })}
      />

      <DeleteModal
        isOpen={deleteModal.isOpen}
        sessionTitle={deleteModal.session?.title || ''}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModal({ isOpen: false, session: null })}
      />
    </div>
  );
}
