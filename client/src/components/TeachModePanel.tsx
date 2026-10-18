import React, { useState } from 'react';
import { GraduationCap, Hand, BookOpen, CheckSquare, Save } from 'lucide-react';

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
      <div className="card-secondary" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '8px',
            backgroundColor: '#E6E6FA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GraduationCap size={24} color="#FFFFFF" />
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 900 }}>Teach Mode Active</div>
          <div style={{ fontSize: '13px' }}>
            {subject ? `${subject} — ${topic || 'General Lecture'}` : 'Peer Teaching Session'}
          </div>
        </div>
      </div>

      {/* Raised Hands Queue */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Hand size={18} color="#E6E6FA" />
          <span style={{ fontSize: '14px', fontWeight: 900 }}>Raised Hands ({raisedHands.length})</span>
        </div>

        {raisedHands.length === 0 ? (
          <div style={{ fontSize: '13px' }}>No hands currently raised by students.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {raisedHands.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: '#F0F8FF',
                  borderRadius: '6px',
                  border: '1px solid #E6E6FA',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 800 }}>{p.full_name} (@{p.username})</span>
                <span className="badge">Wants to speak</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Teaching Notes & Agenda */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={18} color="#E6E6FA" />
          <span style={{ fontSize: '14px', fontWeight: 900 }}>Teaching Notes & Agenda</span>
        </div>

        <textarea
          rows={4}
          placeholder="Outline main points, theorem steps, formula derivations, code examples..."
          value={teachingNotes}
          onChange={(e) => setTeachingNotes(e.target.value)}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {savedNotes && <span style={{ fontSize: '12px' }}>Notes saved locally!</span>}
          <button
            type="button"
            onClick={handleSaveNotes}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', marginLeft: 'auto' }}
          >
            <Save size={14} color="#E6E6FA" />
            <span>Save Notes</span>
          </button>
        </div>
      </div>

      {/* Session Outcome & Takeaways */}
      <div className="card-secondary" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckSquare size={18} color="#E6E6FA" />
          <span style={{ fontSize: '14px', fontWeight: 900 }}>Session Outcome & Next Steps</span>
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
