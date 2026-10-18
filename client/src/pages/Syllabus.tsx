import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { ListTodo, Plus, CheckCircle, Clock, Circle, Filter, UserCheck, Calendar } from 'lucide-react';

export const Syllabus: React.FC = () => {
  const [searchParams] = useSearchParams();
  const defaultGroupId = searchParams.get('group_id') || '';

  const [boards, setBoards] = useState<any[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [boardDetails, setBoardDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  // Create Board Modal
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');

  // Add Topic Modal
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicSubject, setTopicSubject] = useState('');
  const [topicUnit, setTopicUnit] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [topicNotes, setTopicNotes] = useState('');

  const loadBoards = async () => {
    try {
      const query = defaultGroupId ? `?group_id=${defaultGroupId}` : '';
      const data = await apiRequest<{ boards: any[] }>(`/syllabus/boards${query}`);
      setBoards(data.boards);
      if (data.boards.length > 0 && !selectedBoardId) {
        setSelectedBoardId(data.boards[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBoardDetails = async () => {
    if (!selectedBoardId) return;
    try {
      const data = await apiRequest(`/syllabus/boards/${selectedBoardId}`);
      setBoardDetails(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadBoards();
  }, [defaultGroupId]);

  useEffect(() => {
    loadBoardDetails();
  }, [selectedBoardId]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ board: any }>('/syllabus/boards', {
        method: 'POST',
        body: JSON.stringify({
          exam_name: examName,
          exam_date: examDate,
          group_id: defaultGroupId || null,
        }),
      });
      setShowBoardModal(false);
      setExamName('');
      setExamDate('');
      setSelectedBoardId(res.board.id);
      loadBoards();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoardId) return;
    try {
      await apiRequest(`/syllabus/boards/${selectedBoardId}/topics`, {
        method: 'POST',
        body: JSON.stringify({
          subject: topicSubject,
          unit: topicUnit,
          title: topicTitle,
          notes: topicNotes,
        }),
      });
      setShowTopicModal(false);
      setTopicSubject('');
      setTopicUnit('');
      setTopicTitle('');
      setTopicNotes('');
      loadBoardDetails();
      loadBoards();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (topicId: string, newStatus: string) => {
    try {
      await apiRequest(`/syllabus/topics/${topicId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      loadBoardDetails();
      loadBoards();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const topics = boardDetails?.topics || [];
  const subjectsList = Array.from(new Set(topics.map((t: any) => t.subject)));

  const filteredTopics = topics.filter((t: any) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (subjectFilter !== 'all' && t.subject !== subjectFilter) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900 }}>Syllabus Conquer Board</h1>
          <p style={{ fontSize: '13px' }}>Organize exam syllabus by units, assign preparation topics, and track collective group progress.</p>
        </div>

        <button onClick={() => setShowBoardModal(true)} className="btn-primary">
          <Plus size={16} color="#FFFFFF" />
          <span>New Syllabus Board</span>
        </button>
      </div>

      {/* Boards Selector & Summary Bar */}
      {boards.length > 0 && (
        <div className="card-secondary" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800 }}>Active Board:</span>
              <select
                value={selectedBoardId}
                onChange={(e) => setSelectedBoardId(e.target.value)}
                style={{ width: 'auto', minWidth: '240px' }}
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.exam_name} {b.group_name ? `(${b.group_name})` : ''} — {b.completion_percentage}%
                  </option>
                ))}
              </select>
            </div>

            {boardDetails?.board?.exam_date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800 }}>
                <Calendar size={16} color="#E6E6FA" />
                <span>Exam Date: {new Date(boardDetails.board.exam_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Progress Bar & Stats */}
          {boardDetails?.stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800 }}>
                <span>Overall Syllabus Completion</span>
                <span>{boardDetails.stats.percentage}% Completed ({boardDetails.stats.completed}/{boardDetails.stats.total} topics)</span>
              </div>

              {/* Strict 3-color Progress Bar */}
              <div
                style={{
                  height: '14px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '7px',
                  border: '2px solid #E6E6FA',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${boardDetails.stats.percentage}%`,
                    backgroundColor: '#E6E6FA',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginTop: '4px' }}>
                <span>Completed: {boardDetails.stats.completed}</span>
                <span>In Progress: {boardDetails.stats.inProgress}</span>
                <span>Remaining: {boardDetails.stats.remaining}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Board Topics Container */}
      {boards.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <ListTodo size={40} color="#E6E6FA" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>No syllabus boards created yet</div>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>
            Create an exam board to systematically break down units and conquer your exam schedule!
          </p>
          <button onClick={() => setShowBoardModal(true)} className="btn-primary">
            <span>Create Exam Board</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters & Actions Bar */}
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '12px 18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Filter size={16} color="#E6E6FA" />

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: 'auto', fontSize: '12px', padding: '6px 10px' }}
              >
                <option value="all">All Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>

              {/* Subject Filter */}
              {subjectsList.length > 0 && (
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  style={{ width: 'auto', fontSize: '12px', padding: '6px 10px' }}
                >
                  <option value="all">All Subjects</option>
                  {subjectsList.map((s: any) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
            </div>

            <button onClick={() => setShowTopicModal(true)} className="btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }}>
              <Plus size={14} color="#FFFFFF" />
              <span>Add Topic</span>
            </button>
          </div>

          {/* Topics List */}
          {filteredTopics.length === 0 ? (
            <div className="card-secondary" style={{ textAlign: 'center', padding: '36px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800 }}>No topics match current filters.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredTopics.map((t: any) => (
                <div
                  key={t.id}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    backgroundColor: t.status === 'completed' ? '#F0F8FF' : '#FFFFFF',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, marginRight: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge">{t.subject}</span>
                      <span className="badge-outline" style={{ fontSize: '11px' }}>{t.unit}</span>
                      {t.assigned_to_name && (
                        <span style={{ fontSize: '12px' }}>Assigned: {t.assigned_to_name}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 900, marginBottom: '2px' }}>
                      {t.title}
                    </div>
                    {t.notes && <div style={{ fontSize: '12px', fontStyle: 'italic' }}>{t.notes}</div>}
                  </div>

                  {/* Status Toggle Buttons */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(t.id, 'not_started')}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        backgroundColor: t.status === 'not_started' ? '#E6E6FA' : '#FFFFFF',
                        color: t.status === 'not_started' ? '#FFFFFF' : '#E6E6FA',
                      }}
                    >
                      <Circle size={12} color={t.status === 'not_started' ? '#FFFFFF' : '#E6E6FA'} />
                      <span>Not Started</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(t.id, 'in_progress')}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        backgroundColor: t.status === 'in_progress' ? '#E6E6FA' : '#FFFFFF',
                        color: t.status === 'in_progress' ? '#FFFFFF' : '#E6E6FA',
                      }}
                    >
                      <Clock size={12} color={t.status === 'in_progress' ? '#FFFFFF' : '#E6E6FA'} />
                      <span>In Progress</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(t.id, 'completed')}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        backgroundColor: t.status === 'completed' ? '#E6E6FA' : '#FFFFFF',
                        color: t.status === 'completed' ? '#FFFFFF' : '#E6E6FA',
                      }}
                    >
                      <CheckCircle size={12} color={t.status === 'completed' ? '#FFFFFF' : '#E6E6FA'} />
                      <span>Completed</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Board Modal */}
      {showBoardModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '16px' }}>New Exam Syllabus Board</h2>
            <form onSubmit={handleCreateBoard} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                  Exam Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. End Semester Theory Examination 2026"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                  Exam Date (Optional)
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowBoardModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Board
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Topic Modal */}
      {showTopicModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '16px' }}>Add Syllabus Topic</h2>
            <form onSubmit={handleAddTopic} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Subject *</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Networks"
                  value={topicSubject}
                  onChange={(e) => setTopicSubject(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Unit / Chapter *</label>
                <input
                  type="text"
                  placeholder="e.g. Unit 3: Transport Layer Protocols"
                  value={topicUnit}
                  onChange={(e) => setTopicUnit(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Topic Title *</label>
                <input
                  type="text"
                  placeholder="e.g. TCP 3-Way Handshake & Congestion Control"
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Notes</label>
                <textarea
                  rows={2}
                  placeholder="Key theorems, textbook chapter references..."
                  value={topicNotes}
                  onChange={(e) => setTopicNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowTopicModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
