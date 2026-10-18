import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  Hand,
  Users,
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
        <div className="alert-box" style={{ fontSize: '13px' }}>
          [MEDIA STATUS] {deviceError} Voice & Screen Share controls remain available.
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
              backgroundColor: '#F0F8FF',
              minHeight: '360px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                borderBottom: '2px solid #E6E6FA',
                marginBottom: '8px',
              }}
            >
              <span className="badge">Screen Share Active</span>
              <span style={{ fontSize: '12px', fontWeight: 800 }}>Presenting to Study Room</span>
            </div>
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                height: '100%',
                maxHeight: '480px',
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: '2px solid #E6E6FA',
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
            backgroundColor: '#F0F8FF',
            minHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            padding: 0,
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
                backgroundColor: '#FFFFFF',
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#E6E6FA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  border: '2px solid #E6E6FA',
                  fontSize: '24px',
                  color: '#FFFFFF',
                  fontWeight: 900,
                }}
              >
                You
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#E6E6FA' }}>
                Camera is off
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
              backgroundColor: '#FFFFFF',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '2px solid #E6E6FA',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#E6E6FA' }}>
              You {isHost ? '(Host)' : ''}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {!audioEnabled && <MicOff size={14} color="#E6E6FA" />}
              {!videoEnabled && <VideoOff size={14} color="#E6E6FA" />}
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
                backgroundColor: '#F0F8FF',
                minHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#E6E6FA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                  fontSize: '24px',
                  color: '#FFFFFF',
                  fontWeight: 900,
                }}
              >
                {peer.full_name ? peer.full_name[0].toUpperCase() : 'P'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800 }}>{peer.full_name}</div>
              <div style={{ fontSize: '12px' }}>@{peer.username}</div>

              {peer.is_hand_raised === 1 && (
                <div style={{ marginTop: '8px' }} className="badge">
                  Hand Raised
                </div>
              )}

              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  backgroundColor: '#FFFFFF',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #E6E6FA',
                  fontSize: '11px',
                }}
              >
                Connected
              </div>
            </div>
          ))}
      </div>

      {/* Control Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          padding: '12px',
          backgroundColor: '#FFFFFF',
        }}
      >
        <button
          onClick={toggleMic}
          className={audioEnabled ? 'btn-primary' : 'btn-secondary'}
          title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {audioEnabled ? <Mic size={18} color="#FFFFFF" /> : <MicOff size={18} color="#E6E6FA" />}
          <span>{audioEnabled ? 'Mute' : 'Unmuted'}</span>
        </button>

        <button
          onClick={toggleCamera}
          className={videoEnabled ? 'btn-primary' : 'btn-secondary'}
          title={videoEnabled ? 'Stop Video' : 'Start Video'}
        >
          {videoEnabled ? <Video size={18} color="#FFFFFF" /> : <VideoOff size={18} color="#E6E6FA" />}
          <span>{videoEnabled ? 'Stop Video' : 'Start Video'}</span>
        </button>

        <button
          onClick={toggleScreenShare}
          className={isSharingScreen ? 'btn-accent' : 'btn-secondary'}
          title={isSharingScreen ? 'Stop Sharing' : 'Share Screen'}
        >
          <ScreenShare size={18} color={isSharingScreen ? '#FFFFFF' : '#E6E6FA'} />
          <span>{isSharingScreen ? 'Stop Share' : 'Share Screen'}</span>
        </button>

        <button onClick={onToggleHand} className="btn-secondary" title="Raise or Lower Hand">
          <Hand size={18} color="#E6E6FA" />
          <span>Raise Hand</span>
        </button>

        <button
          onClick={onLeave}
          className="btn-primary"
          style={{ backgroundColor: '#FFFFFF', color: '#E6E6FA', borderColor: '#E6E6FA' }}
          title="Leave Study Room"
        >
          <PhoneOff size={18} color="#E6E6FA" />
          <span>Leave Room</span>
        </button>
      </div>
    </div>
  );
};
