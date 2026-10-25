import React, { useState, useEffect, useRef } from 'react';
import { THEME } from '../theme';
import { Button } from './ui/Button';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  Hand,
  Users,
  Volume2,
} from 'lucide-react';

interface Participant {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  is_hand_raised: number;
}

interface VideoMeetingProps {
  roomId: string;
  isHost: boolean;
  participants: Participant[];
  onToggleHand: () => void;
  onLeave: () => void;
}

export const VideoMeeting: React.FC<VideoMeetingProps> = ({
  roomId,
  isHost,
  participants,
  onToggleHand,
  onLeave,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [deviceError, setDeviceError] = useState<string>('');

  // Initialize camera and mic
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        activeStream = stream;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.warn('Camera/Microphone access not available or denied:', err.message);
        setDeviceError('Camera or microphone permissions not granted or device not detected.');
      });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isSharingScreen) {
      // Stop screen sharing
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
        setScreenStream(null);
      }
      setIsSharingScreen(false);
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setScreenStream(stream);
        setIsSharingScreen(true);
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }

        stream.getVideoTracks()[0].onended = () => {
          setIsSharingScreen(false);
          setScreenStream(null);
        };
      } catch (err: any) {
        console.warn('Screen share cancelled or failed:', err.message);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* Device notice if camera/mic is offline */}
      {deviceError && (
        <div className="alert-box-vermilion" style={{ fontSize: '13px' }}>
          <span style={{ color: THEME.vermilion, fontWeight: 700 }}>[MEDIA STATUS]</span> {deviceError} Voice & Screen Share controls remain available.
        </div>
      )}

      {/* Video Streams Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isSharingScreen ? '2fr 1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Screen Share Window */}
        {isSharingScreen && (
          <div
            className="card"
            style={{
              position: 'relative',
              backgroundColor: THEME.warmIvory,
              border: `2px solid ${THEME.emeraldGreen}`,
              minHeight: '360px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: '10px',
              borderRadius: THEME.radius.card,
              boxShadow: THEME.shadow.lifted,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                borderBottom: `1.5px solid ${THEME.emeraldGreen}`,
                marginBottom: '8px',
              }}
            >
              <span className="badge">Screen Share Active</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: THEME.deepForestCharcoal }}>
                Presenting to Study Room
              </span>
            </div>
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                height: '100%',
                maxHeight: '480px',
                backgroundColor: THEME.deepForestCharcoal,
                borderRadius: THEME.radius.md,
                border: `1.5px solid ${THEME.deepForestCharcoal}`,
                objectFit: 'contain',
              }}
            />
          </div>
        )}

        {/* Local Participant Tile */}
        <div
          className="card"
          style={{
            position: 'relative',
            backgroundColor: THEME.warmIvory,
            border: `2px solid ${audioEnabled ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
            minHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            padding: 0,
            borderRadius: THEME.radius.card,
            boxShadow: THEME.shadow.card,
            transition: `border-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
          }}
        >
          {localStream && videoEnabled ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                minHeight: '260px',
                objectFit: 'cover',
                backgroundColor: THEME.deepForestCharcoal,
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: THEME.radius.full,
                  backgroundColor: THEME.emeraldGreen,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  border: `2px solid ${THEME.deepForestCharcoal}`,
                  fontSize: '20px',
                  color: THEME.warmIvory,
                  fontWeight: 800,
                  boxShadow: THEME.shadow.subtle,
                }}
              >
                You
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: THEME.warmStone }}>
                Camera is muted
              </div>
            </div>
          )}

          {/* Participant Label Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              right: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: THEME.warmIvory,
              padding: '6px 12px',
              borderRadius: THEME.radius.md,
              border: `1.5px solid ${THEME.deepForestCharcoal}`,
              boxShadow: THEME.shadow.subtle,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                You {isHost ? '(Host)' : ''}
              </span>
              {audioEnabled && <Volume2 size={13} color={THEME.emeraldGreen} />}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {!audioEnabled && <MicOff size={14} color={THEME.vermilion} />}
              {!videoEnabled && <VideoOff size={14} color={THEME.vermilion} />}
            </div>
          </div>
        </div>

        {/* Remote Peers in Room */}
        {participants
          .filter((p) => p.user_id !== 'local')
          .slice(0, 3)
          .map((peer) => (
            <div
              key={peer.id}
              className="card"
              style={{
                backgroundColor: THEME.warmIvory,
                border: `1.5px solid ${peer.is_hand_raised === 1 ? THEME.vermilion : THEME.deepForestCharcoal}`,
                minHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                borderRadius: THEME.radius.card,
                boxShadow: THEME.shadow.card,
              }}
            >
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: THEME.radius.full,
                  backgroundColor: THEME.emeraldGreen,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                  fontSize: '22px',
                  color: THEME.warmIvory,
                  fontWeight: 800,
                  border: `1.5px solid ${THEME.deepForestCharcoal}`,
                }}
              >
                {peer.full_name ? peer.full_name[0].toUpperCase() : 'P'}
              </div>
              <div style={{ fontSize: '14.5px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                {peer.full_name}
              </div>
              <div style={{ fontSize: '12px', color: THEME.warmStone }}>@{peer.username}</div>

              {peer.is_hand_raised === 1 && (
                <div style={{ marginTop: '8px' }} className="badge badge-urgent">
                  Hand Raised
                </div>
              )}

              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  backgroundColor: THEME.warmIvory,
                  padding: '3px 8px',
                  borderRadius: THEME.radius.pill,
                  border: `1px solid ${THEME.deepForestCharcoal}`,
                  fontSize: '11px',
                  fontWeight: 700,
                  color: THEME.emeraldGreen,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span className="live-pulse-dot" />
                <span>Connected</span>
              </div>
            </div>
          ))}
      </div>

      {/* Expressive Media Control Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          padding: '14px 20px',
          backgroundColor: THEME.warmIvory,
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          borderRadius: THEME.radius.pill,
          boxShadow: THEME.shadow.lifted,
        }}
        role="toolbar"
        aria-label="Media controls"
      >
        <Button
          variant={audioEnabled ? 'primary' : 'secondary'}
          shape="pill"
          size="sm"
          onClick={toggleMic}
          leftIcon={audioEnabled ? <Mic size={16} color={THEME.warmIvory} /> : <MicOff size={16} color={THEME.deepForestCharcoal} />}
          title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {audioEnabled ? 'Mute Mic' : 'Unmuted'}
        </Button>

        <Button
          variant={videoEnabled ? 'primary' : 'secondary'}
          shape="pill"
          size="sm"
          onClick={toggleCamera}
          leftIcon={videoEnabled ? <Video size={16} color={THEME.warmIvory} /> : <VideoOff size={16} color={THEME.deepForestCharcoal} />}
          title={videoEnabled ? 'Stop Video' : 'Start Video'}
        >
          {videoEnabled ? 'Stop Video' : 'Start Video'}
        </Button>

        <Button
          variant={isSharingScreen ? 'primary' : 'secondary'}
          shape="pill"
          size="sm"
          onClick={toggleScreenShare}
          leftIcon={<ScreenShare size={16} color={isSharingScreen ? THEME.warmIvory : THEME.deepForestCharcoal} />}
          title={isSharingScreen ? 'Stop Screen Share' : 'Share Screen'}
        >
          {isSharingScreen ? 'Stop Screen' : 'Share Screen'}
        </Button>

        <Button
          variant="secondary"
          shape="pill"
          size="sm"
          onClick={onToggleHand}
          leftIcon={<Hand size={16} color={THEME.deepForestCharcoal} />}
          title="Raise or Lower Hand"
        >
          Raise Hand
        </Button>

        <Button
          variant="vermilion"
          shape="pill"
          size="sm"
          onClick={onLeave}
          leftIcon={<PhoneOff size={16} color={THEME.warmIvory} />}
          title="Leave Study Room"
        >
          Leave Room
        </Button>
      </div>
    </div>
  );
};

export default VideoMeeting;
