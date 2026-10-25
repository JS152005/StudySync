import React, { useState } from 'react';
import { THEME } from '../theme';
import { Button } from './ui/Button';
import { GraduationCap, Hand, BookOpen, CheckSquare, Save, Check } from 'lucide-react';

interface TeachModePanelProps {
  subject?: string;
  topic?: string;
  participants: any[];
  isHost: boolean;
}

export const TeachModePanel: React.FC<TeachModePanelProps> = ({
  subject,
  topic,
  participants,
  isHost,
}) => {
  const [teachingNotes, setTeachingNotes] = useState('');
  const [sessionOutcome, setSessionOutcome] = useState('');
  const [savedNotes, setSavedNotes] = useState(false);

  const raisedHands = participants.filter((p) => p.is_hand_raised === 1);

  const handleSaveNotes = () => {
    setSavedNotes(true);
    setTimeout(() => setSavedNotes(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Session Header Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          border: `1.5px solid ${THEME.emeraldGreen}`,
          backgroundColor: THEME.warmIvory,
          borderRadius: THEME.radius.card,
          boxShadow: THEME.shadow.subtle,
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: THEME.radius.md,
            backgroundColor: THEME.emeraldGreen,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1.5px solid ${THEME.deepForestCharcoal}`,
          }}
        >
          <GraduationCap size={22} color={THEME.warmIvory} />
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal, fontFamily: 'var(--font-serif)' }}>
            Teach Mode Active
          </div>
          <div style={{ fontSize: '13px', color: THEME.warmStone }}>
            {subject ? `${subject} — ${topic || 'General Lecture'}` : 'Peer Teaching Session'}
          </div>
        </div>
      </div>

      {/* Raised Hands Queue */}
      <div
        className="card"
        style={{
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          backgroundColor: THEME.warmIvory,
          borderRadius: THEME.radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Hand size={18} color={THEME.vermilion} />
            <span style={{ fontSize: '14.5px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
              Raised Hands Queue ({raisedHands.length})
            </span>
          </div>
          {raisedHands.length > 0 && <span className="urgent-pulse-dot" />}
        </div>

        {raisedHands.length === 0 ? (
          <div style={{ fontSize: '13px', color: THEME.warmStone, fontStyle: 'italic' }}>
            No hands currently raised by students in this session.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {raisedHands.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: THEME.warmIvory,
                  borderRadius: THEME.radius.md,
                  border: `1.5px solid ${THEME.vermilion}`,
                  animation: `studysync-slide-up ${THEME.motion.durationFast} ${THEME.motion.easeSpring}`,
                }}
              >
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: THEME.deepForestCharcoal }}>
                  {p.full_name} (@{p.username})
                </span>
                <span className="badge badge-urgent" style={{ fontSize: '10.5px' }}>
                  Wants to speak
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Teaching Notes & Agenda */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          backgroundColor: THEME.warmIvory,
          borderRadius: THEME.radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={18} color={THEME.emeraldGreen} />
          <span style={{ fontSize: '14.5px', fontWeight: 800, color: THEME.deepForestCharcoal, fontFamily: 'var(--font-serif)' }}>
            Teaching Notes & Agenda
          </span>
        </div>

        <textarea
          rows={4}
          placeholder="Outline main lecture points, theorem steps, formula derivations, code examples..."
          value={teachingNotes}
          onChange={(e) => setTeachingNotes(e.target.value)}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {savedNotes && (
            <span
              style={{
                fontSize: '12px',
                color: THEME.emeraldGreen,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Check size={14} color={THEME.emeraldGreen} />
              Notes saved locally!
            </span>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSaveNotes}
            leftIcon={<Save size={13} color={THEME.deepForestCharcoal} />}
            style={{ marginLeft: 'auto' }}
          >
            Save Notes
          </Button>
        </div>
      </div>

      {/* Session Outcome & Takeaways */}
      <div
        className="card-secondary"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          border: `1.5px solid ${THEME.warmStone}`,
          backgroundColor: THEME.warmIvory,
          borderRadius: THEME.radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckSquare size={18} color={THEME.deepForestCharcoal} />
          <span style={{ fontSize: '14.5px', fontWeight: 800, color: THEME.deepForestCharcoal, fontFamily: 'var(--font-serif)' }}>
            Session Outcome & Next Steps
          </span>
        </div>

        <textarea
          rows={3}
          placeholder="Record what topics were understood, solved problems, follow-up readings..."
          value={sessionOutcome}
          onChange={(e) => setSessionOutcome(e.target.value)}
        />
      </div>
    </div>
  );
};

export default TeachModePanel;
