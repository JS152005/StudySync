import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../theme';
import { Send, Users, User, MessageSquare } from 'lucide-react';

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
  const [directChats, setDirectChats] = useState<DirectChat[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [activeChat, setActiveChat] = useState<{ type: 'direct' | 'group'; id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
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
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 140px)',
        border: `1.5px solid ${THEME.deepForestCharcoal}`,
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: THEME.warmIvory,
      }}
    >
      {/* Conversations Sidebar */}
      <div
        style={{
          width: '320px',
          borderRight: `1.5px solid ${THEME.deepForestCharcoal}`,
          backgroundColor: THEME.warmIvory,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px', borderBottom: `1.5px solid ${THEME.deepForestCharcoal}` }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>Messages</h2>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Groups Section */}
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: THEME.warmStone, padding: '6px 8px' }}>
            Study Groups
          </div>
          {groupChats.map((g) => {
            const active = activeChat?.type === 'group' && activeChat.id === g.group_id;
            return (
              <div
                key={g.group_id}
                onClick={() => setActiveChat({ type: 'group', id: g.group_id, name: g.name })}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: active ? THEME.emeraldGreen : THEME.warmIvory,
                  color: active ? THEME.warmIvory : THEME.deepForestCharcoal,
                  border: `1px solid ${active ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} color={active ? THEME.warmIvory : THEME.deepForestCharcoal} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: active ? THEME.warmIvory : THEME.deepForestCharcoal }}>
                    {g.name}
                  </span>
                </div>
                {g.last_message && (
                  <div style={{ fontSize: '11.5px', marginTop: '4px', color: active ? THEME.warmIvory : THEME.warmStone }}>
                    {g.last_sender_name}: {g.last_message.slice(0, 30)}...
                  </div>
                )}
              </div>
            );
          })}

          {/* Direct Messages Section */}
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: THEME.warmStone, padding: '10px 8px 6px' }}>
            Direct Chats
          </div>
          {directChats.map((d) => {
            const active = activeChat?.type === 'direct' && activeChat.id === d.user_id;
            return (
              <div
                key={d.user_id}
                onClick={() => setActiveChat({ type: 'direct', id: d.user_id, name: d.full_name })}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: active ? THEME.emeraldGreen : THEME.warmIvory,
                  color: active ? THEME.warmIvory : THEME.deepForestCharcoal,
                  border: `1px solid ${active ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={16} color={active ? THEME.warmIvory : THEME.deepForestCharcoal} />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: active ? THEME.warmIvory : THEME.deepForestCharcoal }}>
                      {d.full_name}
                    </span>
                  </div>
                  {d.unread_count > 0 && <span className="badge badge-urgent">{d.unread_count}</span>}
                </div>
                {d.last_message && (
                  <div style={{ fontSize: '11.5px', marginTop: '4px', color: active ? THEME.warmIvory : THEME.warmStone }}>
                    {d.last_message.slice(0, 30)}...
                  </div>
                )}
              </div>
            );
          })}

          {directChats.length === 0 && groupChats.length === 0 && (
            <div style={{ fontSize: '12px', textAlign: 'center', padding: '20px', color: THEME.warmStone }}>
              No conversations yet. Join a study group or connect with a friend!
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: THEME.warmIvory }}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: `1.5px solid ${THEME.deepForestCharcoal}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: THEME.warmIvory,
              }}
            >
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: THEME.deepForestCharcoal }}>{activeChat.name}</h3>
                <span style={{ fontSize: '12px', color: THEME.warmStone }}>
                  {activeChat.type === 'direct' ? 'Direct Student Chat' : 'Study Group Discussion'}
                </span>
              </div>
            </div>

            {/* Messages Feed */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', margin: 'auto' }}>
                  <MessageSquare size={32} color={THEME.warmStone} style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 800, color: THEME.deepForestCharcoal }}>Start the conversation!</div>
                  <div style={{ fontSize: '12px', color: THEME.warmStone }}>Send study notes, questions, or ideas.</div>
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = m.sender_id === user?.id;
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isMine ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMine ? 'flex-end' : 'flex-start',
                      }}
                    >
                      {!isMine && (
                        <span style={{ fontSize: '11px', fontWeight: 700, marginBottom: '2px', color: THEME.warmStone }}>
                          {m.sender_name}
                        </span>
                      )}
                      <div
                        style={{
                          padding: '9px 14px',
                          borderRadius: '8px',
                          backgroundColor: isMine ? THEME.emeraldGreen : THEME.warmIvory,
                          color: isMine ? THEME.warmIvory : THEME.deepForestCharcoal,
                          border: `1.5px solid ${isMine ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
                          fontSize: '13.5px',
                          fontWeight: 500,
                          wordBreak: 'break-word',
                        }}
                      >
                        <span style={{ color: isMine ? THEME.warmIvory : THEME.deepForestCharcoal }}>{m.content}</span>
                      </div>
                      <span style={{ fontSize: '10.5px', marginTop: '2px', color: THEME.warmStone, fontWeight: 500 }}>
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
                borderTop: `1.5px solid ${THEME.deepForestCharcoal}`,
                display: 'flex',
                gap: '10px',
                backgroundColor: THEME.warmIvory,
              }}
            >
              <input
                type="text"
                placeholder="Type a message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" disabled={sending || !text.trim()} className="btn-primary" style={{ padding: '0 18px' }}>
                <Send size={15} color={THEME.warmIvory} />
                <span>Send</span>
              </button>
            </form>
          </>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center' }}>
            <MessageSquare size={48} color={THEME.warmStone} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
              Select a conversation to begin chatting
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
