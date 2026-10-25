import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { SegmentedControl, SegmentOption } from '../components/ui/SegmentedControl';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { ListTodo, Plus, CheckCircle, Clock, Circle, Filter, Calendar, Sparkles } from 'lucide-react';

export const Syllabus: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultGroupId = searchParams.get('group_id') || '';
  const autoCreate = searchParams.get('action') === 'create';

  const toast = useToast();
  const [boards, setBoards] = useState<any[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [boardDetails, setBoardDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  // Create Board Modal
  const [showBoardModal, setShowBoardModal] = useState(autoCreate);
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [creatingBoard, setCreatingBoard] = useState(false);

  // Add Topic Modal
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicSubject, setTopicSubject] = useState('');
  const [topicUnit, setTopicUnit] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [topicNotes, setTopicNotes] = useState('');
  const [addingTopic, setAddingTopic] = useState(false);

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
    if (autoCreate) {
      setShowBoardModal(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [autoCreate]);

  useEffect(() => {
    loadBoardDetails();
  }, [selectedBoardId]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBoard(true);
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
      toast.success('Syllabus board established!');
      loadBoards();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingBoard(false);
    }
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoardId) return;
    setAddingTopic(true);
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
      toast.success('Topic added to syllabus!');
      loadBoardDetails();
      loadBoards();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingTopic(false);
    }
  };

  const handleStatusChange = async (topicId: string, newStatus: string) => {
    try {
      await apiRequest(`/syllabus/topics/${topicId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      if (newStatus === 'completed') {
        toast.success('Topic conquered! Progress updated.');
      }
      loadBoardDetails();
      loadBoards();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const topics = boardDetails?.topics || [];
  const subjectsList = Array.from(new Set(topics.map((t: any) => t.subject)));

  const filteredTopics = topics.filter((t: any) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (subjectFilter !== 'all' && t.subject !== subjectFilter) return false;
    return true;
  });

  const filterStatusOptions: SegmentOption<string>[] = [
    { value: 'all', label: 'All' },
    { value: 'not_started', label: 'Not Started' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Syllabus Conquer Board
          </h1>
          <p style={{ fontSize: '13px', color: THEME.warmStone }}>
            Organize exam syllabus by units, assign preparation topics, and track collective group progress.
          </p>
        </div>

        <Button
          variant="primary"
          shape="pill"
          onClick={() => setShowBoardModal(true)}
          leftIcon={<Plus size={15} color={THEME.warmIvory} />}
        >
          New Syllabus Board
        </Button>
      </div>

      {/* Boards Selector & Summary Progress Card */}
      {boards.length > 0 && (
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '20px',
            border: `1.5px solid ${THEME.deepForestCharcoal}`,
            backgroundColor: THEME.warmIvory,
            borderRadius: THEME.radius.card,
            boxShadow: THEME.shadow.card,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                Active Board:
              </span>
              <select
                value={selectedBoardId}
                onChange={(e) => setSelectedBoardId(e.target.value)}
                style={{ width: 'auto', minWidth: '260px' }}
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.exam_name} {b.group_name ? `(${b.group_name})` : ''} — {b.completion_percentage}%
                  </option>
                ))}
              </select>
            </div>

            {boardDetails?.board?.exam_date && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: THEME.deepForestCharcoal,
                }}
              >
                <Calendar size={16} color={THEME.emeraldGreen} />
                <span>Exam Date: {new Date(boardDetails.board.exam_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Progress Bar & Numerical Stats */}
          {boardDetails?.stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color={THEME.emeraldGreen} />
                  <span>Overall Syllabus Mastery</span>
                </span>
                <span>
                  {boardDetails.stats.percentage}% Completed ({boardDetails.stats.completed}/{boardDetails.stats.total} topics)
                </span>
              </div>

              {/* Polished Editorial Progress Bar */}
              <div
                style={{
                  height: '14px',
                  backgroundColor: THEME.warmIvory,
                  borderRadius: THEME.radius.pill,
                  border: `1.5px solid ${THEME.deepForestCharcoal}`,
                  overflow: 'hidden',
                  padding: '1.5px',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${boardDetails.stats.percentage}%`,
                    backgroundColor: THEME.emeraldGreen,
                    borderRadius: THEME.radius.pill,
                    transition: `width ${THEME.motion.durationSlow} ${THEME.motion.easeOut}`,
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginTop: '2px', color: THEME.warmStone, fontWeight: 600 }}>
                <span>Completed: {boardDetails.stats.completed}</span>
                <span>In Progress: {boardDetails.stats.inProgress}</span>
                <span>Remaining: {boardDetails.stats.remaining}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Board Topics Container */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Skeleton height="60px" borderRadius={THEME.radius.card} />
          <Skeleton height="70px" borderRadius={THEME.radius.card} />
          <Skeleton height="70px" borderRadius={THEME.radius.card} />
        </div>
      ) : boards.length === 0 ? (
        <EmptyState
          icon={<ListTodo size={36} />}
          title="No syllabus boards created yet"
          description="Create an exam board to systematically break down course units and conquer your exam schedule!"
          action={
            <Button variant="primary" shape="pill" onClick={() => setShowBoardModal(true)}>
              Create Exam Board
            </Button>
          }
        />
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
              border: `1.5px solid ${THEME.deepForestCharcoal}`,
              backgroundColor: THEME.warmIvory,
              borderRadius: THEME.radius.card,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <SegmentedControl
                options={filterStatusOptions}
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                size="sm"
                variant="pill"
              />

              {/* Subject Filter */}
              {subjectsList.length > 0 && (
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  style={{ width: 'auto', fontSize: '12px', padding: '6px 10px' }}
                >
                  <option value="all">All Subjects</option>
                  {subjectsList.map((s: any) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Button
              variant="primary"
              size="sm"
              shape="pill"
              onClick={() => setShowTopicModal(true)}
              leftIcon={<Plus size={14} color={THEME.warmIvory} />}
            >
              Add Topic
            </Button>
          </div>

          {/* Topics List with Expressive Interactive Controls */}
          {filteredTopics.length === 0 ? (
            <EmptyState
              icon={<ListTodo size={28} />}
              title="No topics match current filters"
              description="Adjust your filters or add a new topic to this syllabus board."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredTopics.map((t: any) => {
                const isCompleted = t.status === 'completed';
                const isInProgress = t.status === 'in_progress';

                return (
                  <div
                    key={t.id}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      backgroundColor: THEME.warmIvory,
                      border: `1.5px solid ${isCompleted ? THEME.emeraldGreen : isInProgress ? THEME.vermilion : THEME.deepForestCharcoal}`,
                      borderRadius: THEME.radius.card,
                      boxShadow: isCompleted ? 'none' : THEME.shadow.subtle,
                      transition: `border-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, marginRight: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="badge">{t.subject}</span>
                        <span className="badge-outline" style={{ fontSize: '11px' }}>
                          {t.unit}
                        </span>
                        {t.assigned_to_name && (
                          <span style={{ fontSize: '12px', color: THEME.warmStone }}>
                            Assigned: {t.assigned_to_name}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 800,
                          marginBottom: '2px',
                          color: THEME.deepForestCharcoal,
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          opacity: isCompleted ? 0.85 : 1,
                        }}
                      >
                        {t.title}
                      </div>
                      {t.notes && (
                        <div style={{ fontSize: '12px', fontStyle: 'italic', color: THEME.warmStone }}>
                          {t.notes}
                        </div>
                      )}
                    </div>

                    {/* Tactile Status Action Buttons */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(t.id, 'not_started')}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11.5px',
                          borderRadius: THEME.radius.pill,
                          backgroundColor: t.status === 'not_started' ? THEME.deepForestCharcoal : THEME.warmIvory,
                          color: t.status === 'not_started' ? THEME.warmIvory : THEME.deepForestCharcoal,
                          border: `1.5px solid ${THEME.deepForestCharcoal}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 700,
                          transition: `transform ${THEME.motion.durationFast} ${THEME.motion.easeSpring}`,
                        }}
                      >
                        <Circle size={11} color={t.status === 'not_started' ? THEME.warmIvory : THEME.deepForestCharcoal} />
                        <span>Not Started</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(t.id, 'in_progress')}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11.5px',
                          borderRadius: THEME.radius.pill,
                          backgroundColor: t.status === 'in_progress' ? THEME.vermilion : THEME.warmIvory,
                          color: t.status === 'in_progress' ? THEME.warmIvory : THEME.deepForestCharcoal,
                          border: `1.5px solid ${t.status === 'in_progress' ? THEME.vermilion : THEME.deepForestCharcoal}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 700,
                          transition: `transform ${THEME.motion.durationFast} ${THEME.motion.easeSpring}`,
                        }}
                      >
                        <Clock size={11} color={t.status === 'in_progress' ? THEME.warmIvory : THEME.deepForestCharcoal} />
                        <span>In Progress</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(t.id, 'completed')}
                        style={{
                          padding: '6px 12px',
                          fontSize: '11.5px',
                          borderRadius: THEME.radius.pill,
                          backgroundColor: t.status === 'completed' ? THEME.emeraldGreen : THEME.warmIvory,
                          color: t.status === 'completed' ? THEME.warmIvory : THEME.deepForestCharcoal,
                          border: `1.5px solid ${t.status === 'completed' ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 700,
                          transform: isCompleted ? 'scale(1.02)' : 'scale(1)',
                          transition: `transform ${THEME.motion.durationFast} ${THEME.motion.easeSpring}`,
                        }}
                      >
                        <CheckCircle size={12} color={t.status === 'completed' ? THEME.warmIvory : THEME.emeraldGreen} />
                        <span>Done</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Accessible Create Exam Board Modal */}
      <Modal
        isOpen={showBoardModal}
        onClose={() => setShowBoardModal(false)}
        title="Create Exam Syllabus Board"
        description="Set up an examination milestone to map topics and measure mastery."
      >
        <form onSubmit={handleCreateBoard} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
              }}
            >
              Exam / Milestone Name *
            </label>
            <input
              type="text"
              placeholder="e.g. End Semester Exam — Computer Networks"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
              }}
            >
              Target Exam Date
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowBoardModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creatingBoard}>
              Create Board
            </Button>
          </div>
        </form>
      </Modal>

      {/* Accessible Add Topic Modal */}
      <Modal
        isOpen={showTopicModal}
        onClose={() => setShowTopicModal(false)}
        title="Add Topic to Board"
        description="Define a specific unit and concept to track."
      >
        <form onSubmit={handleAddTopic} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
              }}
            >
              Subject *
            </label>
            <input
              type="text"
              placeholder="e.g. Operating Systems"
              value={topicSubject}
              onChange={(e) => setTopicSubject(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
              }}
            >
              Unit / Module *
            </label>
            <input
              type="text"
              placeholder="e.g. Unit 3: Process Synchronization"
              value={topicUnit}
              onChange={(e) => setTopicUnit(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
              }}
            >
              Topic Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Dining Philosophers & Semaphores"
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
              }}
            >
              Notes / References
            </label>
            <textarea
              rows={2}
              placeholder="Textbook pages, key formulas, previous exam questions..."
              value={topicNotes}
              onChange={(e) => setTopicNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowTopicModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={addingTopic}>
              Add Topic
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Syllabus;
