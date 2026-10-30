import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { Send, Users, User, MessageSquare, ArrowLeft, Clock } from 'lucide-react';

interface DirectChat {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  availability?: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface GroupChat {
  group_id: string;
  name: string;
  subject?: string;
  last_message?: string;
  last_message_at?: string;
  last_sender_name?: string;
}

export const Messages: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [directChats, setDirectChats] = useState<DirectChat[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [activeChat, setActiveChat] = useState<{ type: 'direct' | 'group'; id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = async () => {
    try {
      const data = await apiRequest<{ directChats: DirectChat[]; groupChats: GroupChat[] }>('/messages/conversations');
      setDirectChats(data.directChats);
      setGroupChats(data.groupChats);

      if (!activeChat && (data.directChats.length > 0 || data.groupChats.length > 0)) {
        if (data.directChats.length > 0) {
          setActiveChat({ type: 'direct', id: data.directChats[0].user_id, name: data.directChats[0].full_name });
        } else {
          setActiveChat({ type: 'group', id: data.groupChats[0].group_id, name: data.groupChats[0].name });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadMessages = async () => {
    if (!activeChat) return;
    try {
      if (activeChat.type === 'direct') {
        const data = await apiRequest<{ messages: any[] }>(`/messages/direct/${activeChat.id}`);
        setMessages(data.messages);
      } else {
        const data = await apiRequest<{ messages: any[] }>(`/messages/group/${activeChat.id}`);
        setMessages(data.messages);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 3500);
    return () => clearInterval(interval);
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeChat) return;

    setSending(true);
    try {
      if (activeChat.type === 'direct') {
        const res = await apiRequest(`/messages/direct/${activeChat.id}`, {
          method: 'POST',
          body: JSON.stringify({ content: text.trim() }),
        });
        setMessages((prev) => [...prev, res.message]);
      } else {
        const res = await apiRequest(`/messages/group/${activeChat.id}`, {
          method: 'POST',
          body: JSON.stringify({ content: text.trim() }),
        });
        setMessages((prev) => [...prev, res.message]);
      }
      setText('');
      loadConversations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 140px)',
        border: '1px solid #E2E8F0',
        borderRadius: THEME.radius.card,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
      }}
    >
      {/* Conversations Sidebar */}
      <div
        className={`chat-sidebar ${mobileConversationOpen ? 'chat-sidebar-hidden-mobile' : ''}`}
        style={{
          width: '320px',
          borderRight: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
            Messages & Channels
          </h2>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Groups Section */}
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#94A3B8',
              padding: '6px 8px',
            }}
          >
            Study Groups
          </div>
          {groupChats.map((g) => {
            const active = activeChat?.type === 'group' && activeChat.id === g.group_id;
            return (
              <div
                key={g.group_id}
                onClick={() => {
                  setActiveChat({ type: 'group', id: g.group_id, name: g.name });
                  setMobileConversationOpen(true);
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: THEME.radius.md,
                  cursor: 'pointer',
                  backgroundColor: active ? '#0EA5E9' : 'transparent',
                  color: active ? '#FFFFFF' : '#F8FAFC',
                  border: `1px solid ${active ? '#0EA5E9' : 'transparent'}`,
                  transition: `background-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                }}
                className="chat-list-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} color={active ? '#FFFFFF' : '#94A3B8'} />
                  <span
                    style={{
                      fontSize: '13.5px',
                      fontWeight: 800,
                      color: active ? '#FFFFFF' : '#F8FAFC',
                    }}
                  >
                    {g.name}
                  </span>
                </div>
                {g.last_message && (
                  <div
                    style={{
                      fontSize: '11.5px',
                      marginTop: '4px',
                      color: active ? 'rgba(255, 255, 255, 0.8)' : '#94A3B8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {g.last_sender_name}: {g.last_message}
                  </div>
                )}
              </div>
            );
          })}

          {/* Direct Messages Section */}
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#94A3B8',
              padding: '12px 8px 6px',
            }}
          >
            Direct Peers
          </div>
          {directChats.map((d) => {
            const active = activeChat?.type === 'direct' && activeChat.id === d.user_id;
            return (
              <div
                key={d.user_id}
                onClick={() => {
                  setActiveChat({ type: 'direct', id: d.user_id, name: d.full_name });
                  setMobileConversationOpen(true);
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: THEME.radius.md,
                  cursor: 'pointer',
                  backgroundColor: active ? '#0EA5E9' : 'transparent',
                  color: active ? '#FFFFFF' : '#F8FAFC',
                  border: `1px solid ${active ? '#0EA5E9' : 'transparent'}`,
                  transition: `background-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                }}
                className="chat-list-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={16} color={active ? '#FFFFFF' : '#94A3B8'} />
                    <span
                      style={{
                        fontSize: '13.5px',
                        fontWeight: 800,
                        color: active ? '#FFFFFF' : '#F8FAFC',
                      }}
                    >
                      {d.full_name}
                    </span>
                  </div>
                  {d.unread_count > 0 && <span className="badge badge-urgent">{d.unread_count}</span>}
                </div>
                {d.last_message && (
                  <div
                    style={{
                      fontSize: '11.5px',
                      marginTop: '4px',
                      color: active ? 'rgba(255, 255, 255, 0.8)' : '#94A3B8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.last_message}
                  </div>
                )}
              </div>
            );
          })}

          {directChats.length === 0 && groupChats.length === 0 && (
            <div style={{ fontSize: '12px', textAlign: 'center', padding: '24px 12px', color: '#94A3B8' }}>
              No conversations yet. Join a study group or connect with a classmate!
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        className={`chat-content-area ${!mobileConversationOpen ? 'chat-content-hidden-mobile' : ''}`}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC' }}
      >
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Mobile Back Button */}
                <button
                  type="button"
                  onClick={() => setMobileConversationOpen(false)}
                  className="btn-ghost mobile-only-btn"
                  style={{ padding: '6px' }}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} color="#0F172A" />
                </button>

                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    {activeChat.name}
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                    {activeChat.type === 'direct' ? 'Direct Student Conversation' : 'Study Group Channel'}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: '#F8FAFC',
              }}
            >
              {messages.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare size={32} />}
                  title="Start the conversation!"
                  description="Send lecture notes, questions, or invite peers to a live study sprint."
                />
              ) : (
                messages.map((m) => {
                  const isMine = m.sender_id === user?.id;
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isMine ? 'flex-end' : 'flex-start',
                        maxWidth: '78%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMine ? 'flex-end' : 'flex-start',
                        animation: `studysync-slide-up ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                      }}
                    >
                      {!isMine && (
                        <span style={{ fontSize: '11px', fontWeight: 700, marginBottom: '2px', color: '#64748B' }}>
                          {m.sender_name}
                        </span>
                      )}
                      <div
                        style={{
                          padding: '9px 14px',
                          borderRadius: THEME.radius.md,
                          backgroundColor: isMine ? '#0284C7' : '#FFFFFF',
                          color: isMine ? '#FFFFFF' : '#0F172A',
                          border: `1px solid ${isMine ? 'rgba(2, 132, 199, 0.4)' : '#E2E8F0'}`,
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                          fontSize: '13.5px',
                          fontWeight: 500,
                          wordBreak: 'break-word',
                        }}
                      >
                        <span style={{ color: isMine ? '#FFFFFF' : '#0F172A' }}>
                          {m.content}
                        </span>
                      </div>
                      <span style={{ fontSize: '10.5px', marginTop: '2px', color: '#94A3B8', fontWeight: 500 }}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSend}
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                gap: '10px',
                backgroundColor: '#FFFFFF',
              }}
            >
              <input
                type="text"
                placeholder="Type a message or note..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ flex: 1 }}
              />
              <Button
                type="submit"
                variant="primary"
                shape="pill"
                disabled={!text.trim()}
                loading={sending}
                leftIcon={<Send size={15} color="#FFFFFF" />}
              >
                Send
              </Button>
            </form>
          </>
        ) : (
          <EmptyState
            icon={<MessageSquare size={36} />}
            title="Select a conversation"
            description="Choose a study group channel or direct peer from the sidebar to start collaborating."
          />
        )}
      </div>

      <style>{`
        .chat-list-item:hover {
          background-color: rgba(38, 53, 47, 0.05);
        }
        @media (max-width: 768px) {
          .chat-sidebar {
            width: 100% !important;
          }
          .chat-sidebar-hidden-mobile {
            display: none !important;
          }
          .chat-content-hidden-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Messages;
