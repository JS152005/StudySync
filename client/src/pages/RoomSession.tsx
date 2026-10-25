import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { VideoMeeting } from '../components/VideoMeeting';
import { Whiteboard } from '../components/Whiteboard';
import { DoubtQueue } from '../components/DoubtQueue';
import { TeachModePanel } from '../components/TeachModePanel';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { SegmentedControl, SegmentOption } from '../components/ui/SegmentedControl';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/ToastContext';
import { Video, PenTool, HelpCircle, GraduationCap, PhoneOff, Users, Hand } from 'lucide-react';

export const RoomSession: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [roomData, setRoomData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'video' | 'whiteboard' | 'doubts' | 'teach'>('video');
  const [showEndModal, setShowEndModal] = useState(false);
  const [ending, setEnding] = useState(false);

  const loadRoom = async () => {
    try {
      const data = await apiRequest(`/rooms/${id}`);
      setRoomData(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load study room');
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
      toast.error(err.message);
    }
  };

  const handleLeave = async () => {
    try {
      await apiRequest(`/rooms/${id}/leave`, { method: 'POST' });
    } catch {
      // ignore
    }
    toast.info('Left study room');
    navigate('/rooms');
  };

  const handleEndRoom = async () => {
    setEnding(true);
    try {
      await apiRequest(`/rooms/${id}/end`, { method: 'POST' });
      toast.info('Study session concluded');
      navigate('/rooms');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEnding(false);
      setShowEndModal(false);
    }
  };

  if (loading || !roomData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Skeleton height="70px" borderRadius={THEME.radius.card} />
        <div style={{ display: 'flex', gap: '20px' }}>
          <Skeleton height="500px" style={{ flex: 1 }} borderRadius={THEME.radius.card} />
          <Skeleton height="500px" width="280px" borderRadius={THEME.radius.card} />
        </div>
      </div>
    );
  }

  const { room, isHost, participants } = roomData;

  const tabOptions: SegmentOption<'video' | 'whiteboard' | 'doubts' | 'teach'>[] = [
    {
      value: 'video',
      label: 'Video & Screen',
      icon: <Video size={14} />,
    },
    {
      value: 'whiteboard',
      label: 'Whiteboard',
      icon: <PenTool size={14} />,
    },
    {
      value: 'doubts',
      label: 'Doubt Queue',
      icon: <HelpCircle size={14} />,
    },
  ];

  if (room.teach_mode === 1) {
    tabOptions.push({
      value: 'teach',
      label: 'Teaching Tools',
      icon: <GraduationCap size={14} />,
    });
  }

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
          gap: '14px',
          padding: '14px 20px',
          backgroundColor: THEME.warmIvory,
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          borderRadius: THEME.radius.card,
          boxShadow: THEME.shadow.subtle,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="live-pulse-dot" />
            <span className="badge">Active Study Session</span>
            {room.teach_mode === 1 && <span className="badge-outline">Teach Mode</span>}
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: THEME.deepForestCharcoal }}>
            {room.name}
          </h1>
          <div style={{ fontSize: '12px', color: THEME.warmStone }}>
            {room.subject ? `${room.subject} • ` : ''}
            {room.topic || 'Peer Study'} • Host: {room.host_name}
          </div>
        </div>

        {/* View Switcher Tabs & Exit Action */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <SegmentedControl
            options={tabOptions}
            value={activeTab}
            onChange={(val) => setActiveTab(val)}
            variant="pill"
            size="sm"
          />

          {isHost ? (
            <Button
              variant="vermilion"
              size="sm"
              shape="pill"
              leftIcon={<PhoneOff size={13} color={THEME.warmIvory} />}
              onClick={() => setShowEndModal(true)}
            >
              End Room
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              leftIcon={<PhoneOff size={13} color={THEME.deepForestCharcoal} />}
              onClick={handleLeave}
            >
              Leave
            </Button>
          )}
        </div>
      </div>

      {/* Main Workspace Stage */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '320px' }}>
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
          className="card"
          style={{
            width: '280px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            flexShrink: 0,
            border: `1.5px solid ${THEME.deepForestCharcoal}`,
            backgroundColor: THEME.warmIvory,
            borderRadius: THEME.radius.card,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color={THEME.emeraldGreen} />
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                Participants ({participants.length})
              </h3>
            </div>
            <span className="live-pulse-dot" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
            {participants.map((p: any) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  backgroundColor: THEME.warmIvory,
                  borderRadius: THEME.radius.md,
                  border: `1.5px solid ${p.is_hand_raised === 1 ? THEME.vermilion : THEME.deepForestCharcoal}`,
                  transition: `border-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                    {p.full_name}
                  </div>
                  <div style={{ fontSize: '11px', color: THEME.warmStone }}>@{p.username}</div>
                </div>
                {p.is_hand_raised === 1 && (
                  <span className="badge badge-urgent" style={{ fontSize: '10px', gap: '3px', padding: '2px 7px' }}>
                    <Hand size={10} color={THEME.warmIvory} />
                    Hand
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* End Room Confirmation Modal */}
      <Modal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        title="End Study Session?"
        description="This will immediately conclude the live room and disconnect all participants."
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => setShowEndModal(false)}>
            Stay in Room
          </Button>
          <Button variant="vermilion" onClick={handleEndRoom} loading={ending}>
            End Room for Everyone
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default RoomSession;
