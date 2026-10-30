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
import { triggerSparks } from '../components/ui/SparkEffect';
import { ListTodo, Plus, CheckCircle, Clock, Circle, Calendar, Sparkles } from 'lucide-react';

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

  const handleStatusChange = async (topicId: string, newStatus: string, e: React.MouseEvent) => {
    try {
      await apiRequest(`/syllabus/topics/${topicId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      if (newStatus === 'completed') {
        triggerSparks(e, 'mint', 10);
        toast.success('Topic completed! Progress updated.');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
            Syllabus Conquer Board
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px', margin: 0 }}>
            Organize exam syllabus by units, assign preparation topics, and track collective progress.
          </p>
        </div>

        <Button
          variant="primary"
          shape="pill"
          onClick={() => setShowBoardModal(true)}
          leftIcon={<Plus size={15} color="#FFFFFF" />}
        >
          New Syllabus Board
        </Button>
      </div>

      {/* Boards Selector & Summary Progress Card */}
      {boards.length > 0 && (
        <div
          className="card-featured"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '24px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderTop: '3px solid #0284C7',
            borderRadius: THEME.radius.cardLg,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
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
                  fontWeight: 600,
                  color: '#94A3B8',
                }}
              >
                <Calendar size={15} color="#0EA5E9" />
                <span>Exam Date: {new Date(boardDetails.board.exam_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Progress Bar & Numerical Stats */}
          {boardDetails?.stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="#38BDF8" />
                  <span>Overall Syllabus Mastery</span>
                </span>
                <span className="tabular-nums">
                  {boardDetails.stats.percentage}% Completed ({boardDetails.stats.completed}/{boardDetails.stats.total} topics)
                </span>
              </div>

              {/* Progress Track */}
              <div
                style={{
                  height: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: THEME.radius.pill,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${boardDetails.stats.percentage}%`,
                    backgroundColor: '#10B981',
                    borderRadius: THEME.radius.pill,
                    transition: `width ${THEME.motion.durationSlow} ${THEME.motion.easeOut}`,
                    boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginTop: '2px', color: '#94A3B8', fontWeight: 500 }}>
                <span>Completed: <strong style={{ color: '#34D399' }}>{boardDetails.stats.completed}</strong></span>
                <span>In Progress: <strong style={{ color: '#FB7185' }}>{boardDetails.stats.inProgress}</strong></span>
                <span>Remaining: <strong style={{ color: '#94A3B8' }}>{boardDetails.stats.remaining}</strong></span>
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
            <Button
              variant="primary"
              shape="pill"
              onClick={(e) => {
                triggerSparks(e, 'azure', 10);
                setShowBoardModal(true);
              }}
            >
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
              padding: '14px 20px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
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
                  style={{ width: 'auto', fontSize: '12px', padding: '6px 12px' }}
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
              leftIcon={<Plus size={14} color="#FFFFFF" />}
            >
              Add Topic
            </Button>
          </div>

          {/* Topics List */}
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
                    className="item-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 20px',
                      backgroundColor: '#F8FAFC',
                      border: isCompleted
                        ? '1px solid rgba(16, 185, 129, 0.25)'
                        : isInProgress
                        ? '1px solid rgba(244, 63, 94, 0.25)'
                        : '1px solid #E2E8F0',
                      borderLeft: isCompleted
                        ? '4px solid #10B981'
                        : isInProgress
                        ? '4px solid #F43F5E'
                        : '4px solid #CBD5E1',
                      borderRadius: THEME.radius.md,
                      transition: `all ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, marginRight: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="badge">{t.subject}</span>
                        <span className="badge-outline" style={{ fontSize: '11px' }}>
                          {t.unit}
                        </span>
                        {t.assigned_to_name && (
                          <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                            Assigned: {t.assigned_to_name}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '14.5px',
                          fontWeight: 600,
                          marginBottom: '2px',
                          color: '#F8FAFC',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          opacity: isCompleted ? 0.8 : 1,
                        }}
                      >
                        {t.title}
                      </div>
                      {t.notes && (
                        <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#64748B' }}>
                          {t.notes}
                        </div>
                      )}
                    </div>

                    {/* Status Action Buttons */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={(e) => handleStatusChange(t.id, 'not_started', e)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11.5px',
                          borderRadius: THEME.radius.pill,
                          backgroundColor: t.status === 'not_started' ? '#1E293B' : 'transparent',
                          color: t.status === 'not_started' ? '#F8FAFC' : '#94A3B8',
                          border: `1px solid ${t.status === 'not_started' ? '#334155' : 'rgba(255, 255, 255, 0.1)'}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Circle size={10} color={t.status === 'not_started' ? '#F8FAFC' : '#94A3B8'} />
                        <span>Not Started</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleStatusChange(t.id, 'in_progress', e)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11.5px',
                          borderRadius: THEME.radius.pill,
                          backgroundColor: t.status === 'in_progress' ? 'rgba(244, 63, 94, 0.2)' : 'transparent',
                          color: t.status === 'in_progress' ? '#FB7185' : '#94A3B8',
                          border: `1px solid ${t.status === 'in_progress' ? '#F43F5E' : 'rgba(255, 255, 255, 0.1)'}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Clock size={10} color={t.status === 'in_progress' ? '#FB7185' : '#94A3B8'} />
                        <span>In Progress</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleStatusChange(t.id, 'completed', e)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '11.5px',
                          borderRadius: THEME.radius.pill,
                          backgroundColor: t.status === 'completed' ? '#10B981' : 'transparent',
                          color: t.status === 'completed' ? '#FFFFFF' : '#94A3B8',
                          border: `1px solid ${t.status === 'completed' ? '#10B981' : 'rgba(255, 255, 255, 0.1)'}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                          boxShadow: isCompleted ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <CheckCircle size={12} color={t.status === 'completed' ? '#FFFFFF' : '#10B981'} />
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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
