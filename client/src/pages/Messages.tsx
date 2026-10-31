import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { getSocket } from '../api/socket';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastContext';
import { triggerSparks } from '../components/ui/SparkEffect';
import {
  Send,
  Users,
  User,
  MessageSquare,
  ArrowLeft,
  Search,
  Plus,
  UserPlus,
  Check,
  CheckCheck,
  Info,
  X,
  Copy,
  Video,
  Shield,
  Trash2,
  LogOut,
  UsersRound,
} from 'lucide-react';

interface DirectChat {
  user_id: string;
  student_id: string;
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
  invite_code?: string;
  last_message?: string;
  last_message_at?: string;
  last_sender_name?: string;
  member_count?: number;
}

interface ChatMessage {
  id: string;
  conversation_type: 'direct' | 'group';
  sender_id: string;
  recipient_id?: string;
  group_id?: string;
  content: string;
  created_at: string;
  sender_name?: string;
  sender_username?: string;
  sender_avatar?: string;
}

interface FoundStudent {
  id: string;
  student_id: string;
  username: string;
  full_name: string;
  course?: string;
  college?: string;
  bio?: string;
  avatar_url?: string;
}

export const Messages: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryUserId = searchParams.get('user_id');
  const queryGroupId = searchParams.get('group_id');
  const actionParam = searchParams.get('action');

  // Conversation Lists
  const [directChats, setDirectChats] = useState<DirectChat[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'direct' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active Chat State
  const [activeChat, setActiveChat] = useState<{
    type: 'direct' | 'group';
    id: string;
    name: string;
    student_id?: string;
    subtitle?: string;
  } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // New Direct Chat Modal
  const [showNewChatModal, setShowNewChatModal] = useState(actionParam === 'new-chat');
  const [searchStudentId, setSearchStudentId] = useState('');
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [foundStudent, setFoundStudent] = useState<FoundStudent | null>(null);

  // Create Group Modal
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(actionParam === 'create-group');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSubject, setNewGroupSubject] = useState('');
  const [groupMemberIdInput, setGroupMemberIdInput] = useState('');
  const [searchingGroupMember, setSearchingGroupMember] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<FoundStudent[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Group Details & Management Drawer
  const [showGroupDrawer, setShowGroupDrawer] = useState(false);
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [loadingGroupDetails, setLoadingGroupDetails] = useState(false);
  const [addMemberInput, setAddMemberInput] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Load All Conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await apiRequest<{ directChats: DirectChat[]; groupChats: GroupChat[] }>('/messages/conversations');
      setDirectChats(data.directChats || []);
      setGroupChats(data.groupChats || []);
    } catch (err: any) {
      console.error('Load conversations error:', err);
    }
  }, []);

  // Load Messages for Active Chat
  const loadMessages = useCallback(async () => {
    if (!activeChat) return;
    try {
      if (activeChat.type === 'direct') {
        const data = await apiRequest<{ friend: any; messages: ChatMessage[] }>(`/messages/direct/${activeChat.id}`);
        setMessages(data.messages || []);
        setDirectChats((prev) =>
          prev.map((c) => (c.user_id === activeChat.id ? { ...c, unread_count: 0 } : c))
        );
      } else {
        const data = await apiRequest<{ messages: ChatMessage[] }>(`/messages/group/${activeChat.id}`);
        setMessages(data.messages || []);
      }
    } catch (err: any) {
      console.error('Load messages error:', err);
    }
  }, [activeChat]);

  // Initial mount & Socket registration
  useEffect(() => {
    loadConversations();
    const socket = getSocket();

    const handleDirectMessage = (msg: ChatMessage) => {
      if (activeChat?.type === 'direct' && (activeChat.id === msg.sender_id || activeChat.id === msg.recipient_id)) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
      loadConversations();
    };

    const handleGroupMessage = (msg: ChatMessage) => {
      if (activeChat?.type === 'group' && activeChat.id === msg.group_id) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
      loadConversations();
    };

    socket.on('direct_message_received', handleDirectMessage);
    socket.on('group_message_received', handleGroupMessage);

    return () => {
      socket.off('direct_message_received', handleDirectMessage);
      socket.off('group_message_received', handleGroupMessage);
    };
  }, [activeChat, loadConversations]);

  // Handle URL query parameters (e.g. from Dashboard or New Chat link)
  useEffect(() => {
    if (queryUserId) {
      apiRequest<{ profile: any }>(`/users/profile/${queryUserId}`)
        .then((res) => {
          if (res.profile) {
            setActiveChat({
              type: 'direct',
              id: res.profile.id,
              name: res.profile.full_name,
              student_id: res.profile.student_id,
              subtitle: res.profile.course || res.profile.student_id,
            });
            setMobileConversationOpen(true);
          }
        })
        .catch(console.error);
    } else if (queryGroupId) {
      apiRequest<{ group: any }>(`/groups/${queryGroupId}`)
        .then((res) => {
          if (res.group) {
            setActiveChat({
              type: 'group',
              id: res.group.id,
              name: res.group.name,
              subtitle: `${res.group.subject || 'Study Group'}`,
            });
            setMobileConversationOpen(true);
          }
        })
        .catch(console.error);
    }
  }, [queryUserId, queryGroupId]);

  // Message polling interval & auto-scroll
  useEffect(() => {
    if (activeChat) {
      loadMessages();
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [activeChat, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Join group chat socket room when active chat changes
  useEffect(() => {
    if (activeChat?.type === 'group') {
      const socket = getSocket();
      socket.emit('join_group_chat', { groupId: activeChat.id });
    }
  }, [activeChat]);

  // Send Message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeChat || sending) return;

    const content = text.trim();
    setText('');
    setSending(true);

    try {
      if (activeChat.type === 'direct') {
        const res = await apiRequest<{ message: ChatMessage }>(`/messages/direct/${activeChat.id}`, {
          method: 'POST',
          body: JSON.stringify({ content }),
        });
        setMessages((prev) => [...prev, res.message]);
        const socket = getSocket();
        socket.emit('direct_message_sent', { recipientId: activeChat.id, message: res.message });
      } else {
        const res = await apiRequest<{ message: ChatMessage }>(`/messages/group/${activeChat.id}`, {
          method: 'POST',
          body: JSON.stringify({ content }),
        });
        setMessages((prev) => [...prev, res.message]);
        const socket = getSocket();
        socket.emit('group_message_sent', { groupId: activeChat.id, message: res.message });
      }
      loadConversations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
      setText(content); // Restore on error
    } finally {
      setSending(false);
    }
  };

  // Search Student by Student ID
  const handleFindStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = searchStudentId.trim().toUpperCase();
    if (!cleanId) return;

    setSearchingStudent(true);
    setFoundStudent(null);
    try {
      const res = await apiRequest<{ student: FoundStudent }>(`/users/by-student-id/${encodeURIComponent(cleanId)}`);
      setFoundStudent(res.student);
    } catch (err: any) {
      toast.error(err.message || 'No student found with that ID');
    } finally {
      setSearchingStudent(false);
    }
  };

  // Start 1-to-1 conversation with found student
  const handleStartChatWithFoundStudent = () => {
    if (!foundStudent) return;
    setActiveChat({
      type: 'direct',
      id: foundStudent.id,
      name: foundStudent.full_name,
      student_id: foundStudent.student_id,
      subtitle: foundStudent.course || foundStudent.student_id,
    });
    setShowNewChatModal(false);
    setFoundStudent(null);
    setSearchStudentId('');
    setMobileConversationOpen(true);
  };

  // Add Member by Student ID in Create Group Modal
  const handleAddMemberToNewGroup = async () => {
    const cleanId = groupMemberIdInput.trim().toUpperCase();
    if (!cleanId) return;

    if (selectedGroupMembers.some((m) => m.student_id.toUpperCase() === cleanId)) {
      toast.info('Student already added to the group list.');
      setGroupMemberIdInput('');
      return;
    }

    setSearchingGroupMember(true);
    try {
      const res = await apiRequest<{ student: FoundStudent }>(`/users/by-student-id/${encodeURIComponent(cleanId)}`);
      setSelectedGroupMembers((prev) => [...prev, res.student]);
      setGroupMemberIdInput('');
      toast.success(`Added ${res.student.full_name} (${res.student.student_id})`);
    } catch (err: any) {
      toast.error(err.message || 'No student found with that ID');
    } finally {
      setSearchingGroupMember(false);
    }
  };

  // Create Group Form Submission
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || creatingGroup) return;

    setCreatingGroup(true);
    try {
      const res = await apiRequest<{ message: string; group: any }>('/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: newGroupName.trim(),
          subject: newGroupSubject.trim(),
          member_student_ids: selectedGroupMembers.map((m) => m.student_id),
        }),
      });

      toast.success('Private study group created!');
      setShowCreateGroupModal(false);
      setNewGroupName('');
      setNewGroupSubject('');
      setSelectedGroupMembers([]);
      loadConversations();

      // Open new group immediately
      setActiveChat({
        type: 'group',
        id: res.group.id,
        name: res.group.name,
        subtitle: res.group.subject || 'Study Group',
      });
      setMobileConversationOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create study group');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Load Group Info Drawer
  const openGroupInfo = async () => {
    if (!activeChat || activeChat.type !== 'group') return;
    setLoadingGroupDetails(true);
    setShowGroupDrawer(true);
    try {
      const data = await apiRequest(`/groups/${activeChat.id}`);
      setGroupDetails(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load group info');
    } finally {
      setLoadingGroupDetails(false);
    }
  };

  // Add Member in Group Info Drawer
  const handleAddMemberToActiveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberInput.trim() || !activeChat) return;

    setAddingMember(true);
    try {
      await apiRequest(`/groups/${activeChat.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ student_id: addMemberInput.trim().toUpperCase() }),
      });
      toast.success('Student added to group!');
      setAddMemberInput('');
      const data = await apiRequest(`/groups/${activeChat.id}`);
      setGroupDetails(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add student to group');
    } finally {
      setAddingMember(false);
    }
  };

  // Remove Member from Group
  const handleRemoveMember = async (targetUserId: string) => {
    if (!activeChat || !confirm('Are you sure you want to remove this member?')) return;
    try {
      await apiRequest(`/groups/${activeChat.id}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      toast.success('Member removed');
      const data = await apiRequest(`/groups/${activeChat.id}`);
      setGroupDetails(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  // Leave Group
  const handleLeaveGroup = async () => {
    if (!activeChat || !confirm('Are you sure you want to leave this study group?')) return;
    try {
      await apiRequest(`/groups/${activeChat.id}/leave`, {
        method: 'POST',
      });
      toast.info('You left the group');
      setShowGroupDrawer(false);
      setActiveChat(null);
      loadConversations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave group');
    }
  };

  // Filter conversations
  const filteredDirect = directChats.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.full_name.toLowerCase().includes(q) || c.student_id.toLowerCase().includes(q) || c.last_message?.toLowerCase().includes(q);
  });

  const filteredGroups = groupChats.filter((g) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return g.name.toLowerCase().includes(q) || g.subject?.toLowerCase().includes(q) || g.last_message?.toLowerCase().includes(q);
  });

  const formatChatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return isToday
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 108px)',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: THEME.radius.cardLg,
        overflow: 'hidden',
        boxShadow: THEME.shadow.card,
        position: 'relative',
      }}
    >
      {/* ============================================================== */}
      {/* 1. LEFT PANE: WhatsApp-style Conversation List                */}
      {/* ============================================================== */}
      <div
        style={{
          width: '340px',
          minWidth: '300px',
          borderRight: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FFFFFF',
        }}
        className={mobileConversationOpen ? 'hide-on-mobile' : ''}
      >
        {/* Top Header with New Chat & New Group Buttons */}
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={18} color="#0284C7" />
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Chats
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#0284C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="New Chat with Student ID"
            >
              <UserPlus size={16} color="#0284C7" />
            </button>

            <button
              type="button"
              onClick={() => setShowCreateGroupModal(true)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#0284C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Create Private Study Group"
            >
              <UsersRound size={16} color="#0284C7" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#F1F5F9',
              borderRadius: THEME.radius.pill,
              padding: '6px 12px',
            }}
          >
            <Search size={14} color="#94A3B8" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '12.5px',
                width: '100%',
                color: '#0F172A',
              }}
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: 'flex',
            padding: '6px 12px',
            gap: '6px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#FAFAFA',
          }}
        >
          {(['all', 'direct', 'groups'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              style={{
                flex: 1,
                padding: '4px 0',
                border: 'none',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: filterTab === tab ? 700 : 500,
                backgroundColor: filterTab === tab ? '#FFFFFF' : 'transparent',
                color: filterTab === tab ? '#0284C7' : '#64748B',
                boxShadow: filterTab === tab ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'all' ? 'All' : tab === 'direct' ? 'Direct' : 'Groups'}
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* If Direct Chats Tab or All */}
          {(filterTab === 'all' || filterTab === 'direct') && filteredDirect.length > 0 && (
            <div>
              {filterTab === 'all' && (
                <div style={{ padding: '8px 16px 4px 16px', fontSize: '10.5px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>
                  Direct Messages
                </div>
              )}
              {filteredDirect.map((chat) => {
                const isActive = activeChat?.type === 'direct' && activeChat.id === chat.user_id;
                return (
                  <div
                    key={chat.user_id}
                    onClick={() => {
                      setActiveChat({
                        type: 'direct',
                        id: chat.user_id,
                        name: chat.full_name,
                        student_id: chat.student_id,
                        subtitle: chat.student_id,
                      });
                      setMobileConversationOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      backgroundColor: isActive ? '#F0F9FF' : '#FFFFFF',
                      borderLeft: isActive ? '3px solid #0284C7' : '3px solid transparent',
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: '#E0F2FE',
                        color: '#0284C7',
                        fontWeight: 800,
                        fontSize: '15px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {chat.full_name[0]?.toUpperCase() || 'S'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {chat.full_name}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '6px' }}>
                          {formatChatTime(chat.last_message_at)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            color: chat.unread_count > 0 ? '#0F172A' : '#64748B',
                            fontWeight: chat.unread_count > 0 ? 600 : 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {chat.last_message || 'Start conversation'}
                        </span>
                        {chat.unread_count > 0 && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              backgroundColor: '#0284C7',
                              color: '#FFFFFF',
                              borderRadius: THEME.radius.pill,
                              padding: '1px 6px',
                              marginLeft: '4px',
                            }}
                          >
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* If Groups Tab or All */}
          {(filterTab === 'all' || filterTab === 'groups') && filteredGroups.length > 0 && (
            <div>
              {filterTab === 'all' && (
                <div style={{ padding: '12px 16px 4px 16px', fontSize: '10.5px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>
                  Study Groups
                </div>
              )}
              {filteredGroups.map((group) => {
                const isActive = activeChat?.type === 'group' && activeChat.id === group.group_id;
                return (
                  <div
                    key={group.group_id}
                    onClick={() => {
                      setActiveChat({
                        type: 'group',
                        id: group.group_id,
                        name: group.name,
                        subtitle: `${group.subject || 'Private Group'}`,
                      });
                      setMobileConversationOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      backgroundColor: isActive ? '#F0F9FF' : '#FFFFFF',
                      borderLeft: isActive ? '3px solid #0284C7' : '3px solid transparent',
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        backgroundColor: '#E0E7FF',
                        color: '#4338CA',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <UsersRound size={20} color="#4338CA" />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {group.name}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '6px' }}>
                          {formatChatTime(group.last_message_at)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#64748B',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {group.last_sender_name ? `${group.last_sender_name}: ` : ''}
                          {group.last_message || 'Group created'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty Conversation State */}
          {filteredDirect.length === 0 && filteredGroups.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
              <MessageSquare size={36} color="#CBD5E1" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>
                No conversations yet
              </div>
              <p style={{ fontSize: '12px', marginTop: '6px', lineHeight: 1.4 }}>
                Find students by their unique Student ID to start chatting.
              </p>
              <Button
                variant="primary"
                size="sm"
                shape="pill"
                style={{ marginTop: '14px' }}
                onClick={() => setShowNewChatModal(true)}
              >
                Find Student by ID
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. RIGHT PANE: WhatsApp-style Active Conversation Window      */}
      {/* ============================================================== */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#F8FAFC',
          minWidth: 0,
        }}
        className={!mobileConversationOpen ? 'hide-on-mobile' : ''}
      >
        {activeChat ? (
          <>
            {/* Active Conversation Top Bar */}
            <div
              style={{
                height: '62px',
                padding: '0 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                {/* Back button for mobile */}
                <button
                  type="button"
                  onClick={() => setMobileConversationOpen(false)}
                  className="btn-ghost mobile-only-btn"
                  style={{ padding: '6px', display: 'none' }}
                >
                  <ArrowLeft size={18} color="#0F172A" />
                </button>

                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: activeChat.type === 'direct' ? '50%' : '8px',
                    backgroundColor: activeChat.type === 'direct' ? '#E0F2FE' : '#E0E7FF',
                    color: activeChat.type === 'direct' ? '#0284C7' : '#4338CA',
                    fontWeight: 800,
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {activeChat.type === 'direct' ? activeChat.name[0]?.toUpperCase() : <UsersRound size={18} />}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeChat.name}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {activeChat.student_id ? (
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284C7' }}>
                        {activeChat.student_id}
                      </span>
                    ) : (
                      <span>{activeChat.subtitle || 'Study Chat'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button
                  size="sm"
                  variant="secondary"
                  shape="pill"
                  leftIcon={<Video size={13} color="#0284C7" />}
                  onClick={() => navigate('/rooms?action=create')}
                >
                  Launch Room
                </Button>

                {activeChat.type === 'group' && (
                  <button
                    type="button"
                    onClick={openGroupInfo}
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title="Group Settings & Members"
                  >
                    <Info size={16} color="#475569" />
                  </button>
                )}
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: '#F8FAFC',
              }}
            >
              {messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: '#94A3B8' }}>
                  <MessageSquare size={32} color="#CBD5E1" style={{ margin: '0 auto 8px auto' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
                    This is the start of your private conversation.
                  </div>
                  <div style={{ fontSize: '11.5px', marginTop: '4px' }}>
                    Messages are end-to-end authorized and private to conversation members.
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                      }}
                    >
                      {/* Sender Name in Group Chat */}
                      {activeChat.type === 'group' && !isMe && msg.sender_name && (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284C7', marginBottom: '3px', marginLeft: '8px' }}>
                          {msg.sender_name}
                        </span>
                      )}

                      {/* Bubble */}
                      <div
                        style={{
                          maxWidth: '70%',
                          padding: '10px 14px',
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          backgroundColor: isMe ? '#0284C7' : '#FFFFFF',
                          color: isMe ? '#FFFFFF' : '#0F172A',
                          border: isMe ? 'none' : '1px solid #E2E8F0',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                          fontSize: '13.5px',
                          lineHeight: 1.45,
                          wordBreak: 'break-word',
                        }}
                      >
                        <div>{msg.content}</div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px',
                            marginTop: '4px',
                            fontSize: '10px',
                            color: isMe ? 'rgba(255, 255, 255, 0.75)' : '#94A3B8',
                          }}
                        >
                          <span>{formatChatTime(msg.created_at)}</span>
                          {isMe && <CheckCheck size={12} color="rgba(255, 255, 255, 0.9)" />}
                        </div>
                      </div>
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
                padding: '12px 20px',
                backgroundColor: '#FFFFFF',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <input
                type="text"
                placeholder={activeChat.type === 'direct' ? `Message ${activeChat.name}...` : 'Type a group message...'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: THEME.radius.pill,
                  border: '1.5px solid #CBD5E1',
                  backgroundColor: '#F8FAFC',
                  fontSize: '13.5px',
                  color: '#0F172A',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: text.trim() ? '#0284C7' : '#E2E8F0',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: text.trim() ? 'pointer' : 'default',
                  transition: 'background-color 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <Send size={16} color={text.trim() ? '#FFFFFF' : '#94A3B8'} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#F0F9FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <MessageSquare size={30} color="#0284C7" />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              StudySync Private Chats
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '380px', margin: '8px auto 20px auto', lineHeight: 1.5 }}>
              Select an existing conversation from the left, or search a student using their unique Student ID to start messaging.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <Button
                variant="primary"
                shape="pill"
                leftIcon={<UserPlus size={15} color="#FFFFFF" />}
                onClick={() => setShowNewChatModal(true)}
              >
                Find Student by ID
              </Button>
              <Button
                variant="secondary"
                shape="pill"
                leftIcon={<UsersRound size={15} color="#0284C7" />}
                onClick={() => setShowCreateGroupModal(true)}
              >
                Create Group
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 3. MODAL: New Chat with Student ID                             */}
      {/* ============================================================== */}
      {showNewChatModal && (
        <Modal
          isOpen={showNewChatModal}
          onClose={() => {
            setShowNewChatModal(false);
            setFoundStudent(null);
            setSearchStudentId('');
          }}
          title="New Direct Chat"
          maxWidth="460px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              Enter the unique <strong>Student ID</strong> (e.g. STU-ABC123) of the student you want to chat with.
            </p>

            <form onSubmit={handleFindStudent} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="STU-XXXXXX"
                value={searchStudentId}
                onChange={(e) => setSearchStudentId(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  fontFamily: 'monospace',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: '#0F172A',
                  border: '1.5px solid #CBD5E1',
                  borderRadius: '8px',
                  textTransform: 'uppercase',
                  outline: 'none',
                }}
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                shape="pill"
                loading={searchingStudent}
                disabled={!searchStudentId.trim() || searchingStudent}
              >
                Find Student
              </Button>
            </form>

            {/* Found Student Result Card */}
            {foundStudent && (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#F0F9FF',
                  border: '1.5px solid #BAE6FD',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: '#0284C7',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {foundStudent.full_name[0]?.toUpperCase() || 'S'}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                      {foundStudent.full_name}
                    </div>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#0284C7' }}>
                      {foundStudent.student_id}
                    </div>
                    {foundStudent.college && (
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{foundStudent.college}</div>
                    )}
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  shape="pill"
                  onClick={handleStartChatWithFoundStudent}
                >
                  Start Chat
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* 4. MODAL: Create Private Group                                 */}
      {/* ============================================================== */}
      {showCreateGroupModal && (
        <Modal
          isOpen={showCreateGroupModal}
          onClose={() => {
            setShowCreateGroupModal(false);
            setSelectedGroupMembers([]);
          }}
          title="Create Private Study Group"
          maxWidth="520px"
        >
          <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
                Group Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Quantum Computing & Cryptography"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13.5px',
                  color: '#0F172A',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
                Subject / Topic (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Physics & Computer Science"
                value={newGroupSubject}
                onChange={(e) => setNewGroupSubject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13.5px',
                  color: '#0F172A',
                  outline: 'none',
                }}
              />
            </div>

            {/* Add Students by Student ID */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
                Add Classmates by Student ID
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Enter Student ID (e.g. STU-XXXXXX)"
                  value={groupMemberIdInput}
                  onChange={(e) => setGroupMemberIdInput(e.target.value.toUpperCase())}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    textTransform: 'uppercase',
                    outline: 'none',
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  shape="pill"
                  loading={searchingGroupMember}
                  onClick={handleAddMemberToNewGroup}
                >
                  Add
                </Button>
              </div>

              {/* Added Student Chips */}
              {selectedGroupMembers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                  {selectedGroupMembers.map((m) => (
                    <span
                      key={m.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        backgroundColor: '#E0F2FE',
                        color: '#0369A1',
                        borderRadius: THEME.radius.pill,
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      <span>{m.full_name} ({m.student_id})</span>
                      <button
                        type="button"
                        onClick={() => setSelectedGroupMembers((prev) => prev.filter((item) => item.id !== m.id))}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                      >
                        <X size={12} color="#0369A1" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <Button
                type="button"
                variant="secondary"
                shape="pill"
                onClick={() => setShowCreateGroupModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                shape="pill"
                loading={creatingGroup}
                disabled={!newGroupName.trim() || creatingGroup}
              >
                Create Group
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* 5. DRAWER: Group Management & Members                          */}
      {/* ============================================================== */}
      {showGroupDrawer && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '320px',
            backgroundColor: '#FFFFFF',
            borderLeft: '1px solid #E2E8F0',
            boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.05)',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#F8FAFC',
            }}
          >
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
              Group Information
            </span>
            <button
              type="button"
              onClick={() => setShowGroupDrawer(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            >
              <X size={18} color="#64748B" />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Group Identity */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  backgroundColor: '#E0E7FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px auto',
                }}
              >
                <UsersRound size={28} color="#4338CA" />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                {groupDetails?.group?.name}
              </div>
              {groupDetails?.group?.subject && (
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  {groupDetails.group.subject}
                </div>
              )}

              {/* Invite Code Pill */}
              {groupDetails?.group?.invite_code && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#F1F5F9',
                    padding: '4px 10px',
                    borderRadius: THEME.radius.pill,
                    marginTop: '8px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    navigator.clipboard.writeText(groupDetails.group.invite_code);
                    toast.success(`Copied group invite code: ${groupDetails.group.invite_code}`);
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#475569' }}>INVITE CODE:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0284C7' }}>
                    {groupDetails.group.invite_code}
                  </span>
                  <Copy size={11} color="#0284C7" />
                </div>
              )}
            </div>

            {/* Add Member Form (For Owners/Moderators) */}
            {(groupDetails?.membership?.role === 'owner' || groupDetails?.membership?.role === 'moderator') && (
              <form onSubmit={handleAddMemberToActiveGroup} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Add Member by Student ID
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="STU-XXXXXX"
                    value={addMemberInput}
                    onChange={(e) => setAddMemberInput(e.target.value.toUpperCase())}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1.5px solid #CBD5E1',
                      outline: 'none',
                    }}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    shape="pill"
                    loading={addingMember}
                    disabled={!addMemberInput.trim() || addingMember}
                  >
                    Add
                  </Button>
                </div>
              </form>
            )}

            {/* Member List */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                Members ({groupDetails?.members?.length || 0})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {groupDetails?.members?.map((m: any) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.full_name}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748B' }}>
                        {m.course || m.username}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor: m.role === 'owner' ? '#E0F2FE' : '#F1F5F9',
                          color: m.role === 'owner' ? '#0369A1' : '#64748B',
                          padding: '1px 6px',
                          borderRadius: THEME.radius.pill,
                          textTransform: 'capitalize',
                        }}
                      >
                        {m.role}
                      </span>

                      {/* Remove member button for owner */}
                      {groupDetails?.membership?.role === 'owner' && m.user_id !== user?.id && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.user_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#F43F5E',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                          title="Remove member"
                        >
                          <Trash2 size={13} color="#F43F5E" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Leave Group Button */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
              <Button
                variant="secondary"
                shape="pill"
                leftIcon={<LogOut size={14} color="#F43F5E" />}
                style={{ width: '100%', color: '#F43F5E', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                onClick={handleLeaveGroup}
              >
                Leave Group
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
