import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { VideoMeeting } from '../components/VideoMeeting';
import { Whiteboard } from '../components/Whiteboard';
import { DoubtQueue } from '../components/DoubtQueue';
import { TeachModePanel } from '../components/TeachModePanel';
import { Video, PenTool, HelpCircle, GraduationCap, PhoneOff, Users } from 'lucide-react';

export const RoomSession: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [roomData, setRoomData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'video' | 'whiteboard' | 'doubts' | 'teach'>('video');

  const loadRoom = async () => {
    try {
      const data = await apiRequest(`/rooms/${id}`);
      setRoomData(data);
      if (data.room.teach_mode === 1 && activeTab === 'video') {
        // default to video or teach
      }
    } catch (err: any) {
      alert(err.message);
      navigate('/rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiRequest(`/rooms/${id}/join`, { method: 'POST' }).catch(console.error);
    loadRoom();
    const interval = setInterval(loadRoom, 4000);
    return () => {
      clearInterval(interval);
      apiRequest(`/rooms/${id}/leave`, { method: 'POST' }).catch(console.error);
    };
  }, [id]);

  const handleToggleHand = async () => {
    try {
      await apiRequest(`/rooms/${id}/hand`, { method: 'POST' });
      loadRoom();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLeave = async () => {
    try {
      await apiRequest(`/rooms/${id}/leave`, { method: 'POST' });
    } catch {
      // ignore
    }
    navigate('/rooms');
  };

  const handleEndRoom = async () => {
    if (!window.confirm('End this study session for all participants?')) return;
    try {
      await apiRequest(`/rooms/${id}/end`, { method: 'POST' });
      navigate('/rooms');
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading || !roomData) {
    return <div className="card" style={{ padding: '40px', textAlign: 'center' }}>Connecting to study room...</div>;
  }

  const { room, isHost, participants } = roomData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Session Top Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge">Active Study Session</span>
            {room.teach_mode === 1 && <span className="badge-outline">Teach Mode</span>}
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, marginTop: '2px' }}>{room.name}</h1>
          <div style={{ fontSize: '12px' }}>
            {room.subject ? `${room.subject} • ` : ''}{room.topic || 'Peer Study'} • Host: {room.host_name}
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('video')}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              backgroundColor: activeTab === 'video' ? '#E6E6FA' : '#FFFFFF',
              color: activeTab === 'video' ? '#FFFFFF' : '#E6E6FA',
            }}
          >
            <Video size={14} color={activeTab === 'video' ? '#FFFFFF' : '#E6E6FA'} />
            <span>Video & Screen</span>
          </button>

          <button
            onClick={() => setActiveTab('whiteboard')}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              backgroundColor: activeTab === 'whiteboard' ? '#E6E6FA' : '#FFFFFF',
              color: activeTab === 'whiteboard' ? '#FFFFFF' : '#E6E6FA',
            }}
          >
            <PenTool size={14} color={activeTab === 'whiteboard' ? '#FFFFFF' : '#E6E6FA'} />
            <span>Whiteboard</span>
          </button>

          <button
            onClick={() => setActiveTab('doubts')}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              backgroundColor: activeTab === 'doubts' ? '#E6E6FA' : '#FFFFFF',
              color: activeTab === 'doubts' ? '#FFFFFF' : '#E6E6FA',
            }}
          >
            <HelpCircle size={14} color={activeTab === 'doubts' ? '#FFFFFF' : '#E6E6FA'} />
            <span>Doubt Queue</span>
          </button>

          {room.teach_mode === 1 && (
            <button
              onClick={() => setActiveTab('teach')}
              style={{
                padding: '8px 12px',
                fontSize: '12px',
                backgroundColor: activeTab === 'teach' ? '#E6E6FA' : '#FFFFFF',
                color: activeTab === 'teach' ? '#FFFFFF' : '#E6E6FA',
              }}
            >
              <GraduationCap size={14} color={activeTab === 'teach' ? '#FFFFFF' : '#E6E6FA'} />
              <span>Teaching Tools</span>
            </button>
          )}

          {isHost ? (
            <button onClick={handleEndRoom} className="btn-primary" style={{ padding: '8px 12px', fontSize: '12px' }}>
              <PhoneOff size={14} color="#FFFFFF" />
              <span>End Room</span>
            </button>
          ) : (
            <button onClick={handleLeave} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }}>
              <PhoneOff size={14} color="#E6E6FA" />
              <span>Leave</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Stage */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === 'video' && (
            <VideoMeeting
              roomId={room.id}
              isHost={isHost}
              participants={participants}
              onToggleHand={handleToggleHand}
              onLeave={handleLeave}
            />
          )}

          {activeTab === 'whiteboard' && <Whiteboard roomId={room.id} />}

          {activeTab === 'doubts' && <DoubtQueue roomId={room.id} isHost={isHost} />}

          {activeTab === 'teach' && (
            <TeachModePanel
              subject={room.subject}
              topic={room.topic}
              participants={participants}
              isHost={isHost}
            />
          )}
        </div>

        {/* Side Panel: Connected Participants */}
        <div
          className="card-secondary"
          style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} color="#E6E6FA" />
            <h3 style={{ fontSize: '14px', fontWeight: 900 }}>Participants ({participants.length})</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {participants.map((p: any) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '6px',
                  border: '1px solid #E6E6FA',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 800 }}>{p.full_name}</div>
                  <div style={{ fontSize: '10px' }}>@{p.username}</div>
                </div>
                {p.is_hand_raised === 1 && <span className="badge" style={{ fontSize: '10px' }}>Hand</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
