import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { CalendarDays, Plus, CheckCircle, Circle, Trash2, Clock, AlertTriangle, Calendar } from 'lucide-react';

export const Exams: React.FC = () => {
  const toast = useToast();
  const [exams, setExams] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Exam Modal
  const [showExamModal, setShowExamModal] = useState(false);
  const [examName, setExamName] = useState('');
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState('');
  const [notes, setNotes] = useState('');
  const [creatingExam, setCreatingExam] = useState(false);

  // New Task Modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskExamId, setTaskExamId] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [creatingTask, setCreatingTask] = useState(false);

  // Delete Exam Confirmation Modal
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const data = await apiRequest<{ exams: any[]; tasks: any[] }>('/exams');
      setExams(data.exams);
      setTasks(data.tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingExam(true);
    try {
      await apiRequest('/exams', {
        method: 'POST',
        body: JSON.stringify({
          exam_name: examName,
          subject,
          exam_date: examDate,
          notes,
        }),
      });
      setShowExamModal(false);
      setExamName('');
      setSubject('');
      setExamDate('');
      setNotes('');
      toast.success('Exam scheduled!');
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingExam(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingTask(true);
    try {
      await apiRequest('/exams/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: taskTitle,
          due_date: taskDueDate || null,
          exam_id: taskExamId || null,
          priority: taskPriority,
        }),
      });
      setShowTaskModal(false);
      setTaskTitle('');
      setTaskDueDate('');
      setTaskExamId('');
      toast.success('Task created!');
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: number) => {
    try {
      await apiRequest(`/exams/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_completed: currentStatus === 1 ? 0 : 1 }),
      });
      toast.info(currentStatus === 1 ? 'Task marked pending' : 'Task completed!');
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await apiRequest(`/exams/tasks/${taskId}`, { method: 'DELETE' });
      toast.info('Task deleted');
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteExam = async () => {
    if (!deletingExamId) return;
    try {
      await apiRequest(`/exams/${deletingExamId}`, { method: 'DELETE' });
      toast.info('Examination schedule deleted');
      setDeletingExamId(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const calculateDaysLeft = (dateString: string) => {
    const target = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diff = target.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Exam Planner & Study Milestones
          </h1>
          <p style={{ fontSize: '13px', color: THEME.warmStone }}>
            Track countdowns to semester examinations, schedule revision milestones, and check off study tasks.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            shape="pill"
            onClick={() => setShowTaskModal(true)}
            leftIcon={<Plus size={15} color={THEME.deepForestCharcoal} />}
          >
            Add Task
          </Button>
          <Button
            variant="primary"
            shape="pill"
            onClick={() => setShowExamModal(true)}
            leftIcon={<CalendarDays size={15} color={THEME.warmIvory} />}
          >
            Schedule Exam
          </Button>
        </div>
      </div>

      {/* Examinations Grid with Real Countdowns */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ fontSize: '16.5px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
          Scheduled Examinations ({exams.length})
        </h2>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            <Skeleton height="160px" borderRadius={THEME.radius.card} />
            <Skeleton height="160px" borderRadius={THEME.radius.card} />
          </div>
        ) : exams.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={32} />}
            title="No examinations scheduled yet"
            description="Add your midterms, lab vivas, or final semester examination dates to start your countdowns."
            action={
              <Button variant="primary" shape="pill" onClick={() => setShowExamModal(true)}>
                Schedule Your First Exam
              </Button>
            }
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {exams.map((ex) => {
              const daysLeft = calculateDaysLeft(ex.exam_date);
              const isUrgent = daysLeft >= 0 && daysLeft <= 3;
              return (
                <div
                  key={ex.id}
                  className="card card-interactive"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    border: `1.5px solid ${isUrgent ? THEME.vermilion : THEME.deepForestCharcoal}`,
                    backgroundColor: THEME.warmIvory,
                    borderRadius: THEME.radius.card,
                    boxShadow: isUrgent ? THEME.shadow.lifted : THEME.shadow.card,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="badge">{ex.subject}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        shape="pill"
                        onClick={() => setDeletingExamId(ex.id)}
                        aria-label="Delete exam"
                      >
                        <Trash2 size={13} color={THEME.warmStone} />
                      </Button>
                    </div>

                    <h3
                      style={{
                        fontSize: '16.5px',
                        fontWeight: 800,
                        marginBottom: '4px',
                        color: THEME.deepForestCharcoal,
                      }}
                    >
                      {ex.exam_name}
                    </h3>
                    <div style={{ fontSize: '12.5px', marginBottom: '10px', color: THEME.warmStone }}>
                      Date: {new Date(ex.exam_date).toLocaleDateString()}
                    </div>

                    {/* Countdown Display Pill */}
                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: THEME.warmIvory,
                        borderRadius: THEME.radius.md,
                        border: `1.5px solid ${isUrgent ? THEME.vermilion : THEME.deepForestCharcoal}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 700, color: THEME.warmStone }}>Countdown:</span>
                      <span
                        style={{
                          fontSize: '15px',
                          fontWeight: 800,
                          color: isUrgent ? THEME.vermilion : THEME.deepForestCharcoal,
                          fontFamily: 'var(--font-serif)',
                        }}
                      >
                        {daysLeft > 0 ? `${daysLeft} Days Left` : daysLeft === 0 ? 'Today!' : 'Completed'}
                      </span>
                    </div>

                    {ex.notes && (
                      <div style={{ fontSize: '12px', marginTop: '8px', fontStyle: 'italic', color: THEME.warmStone }}>
                        {ex.notes}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      borderTop: `1px solid ${THEME.warmStone}`,
                      paddingTop: '8px',
                      color: THEME.warmStone,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Tasks Completed</span>
                    <span>{ex.completed_tasks} / {ex.total_tasks}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revision Tasks Checklist */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          backgroundColor: THEME.warmIvory,
          borderRadius: THEME.radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '16.5px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Revision Tasks Checklist ({tasks.length})
          </h2>
          <Button
            variant="secondary"
            size="sm"
            shape="pill"
            onClick={() => setShowTaskModal(true)}
            leftIcon={<Plus size={14} color={THEME.deepForestCharcoal} />}
          >
            Add Study Task
          </Button>
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={28} />}
            title="No study tasks scheduled yet"
            description="Break down your exam revisions into specific daily study actions."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tasks.map((task) => {
              const isDone = task.is_completed === 1;
              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: THEME.warmIvory,
                    borderRadius: THEME.radius.md,
                    border: `1px solid ${isDone ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
                    transition: `border-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flex: 1,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleToggleTask(task.id, task.is_completed)}
                  >
                    {/* Animated Checkbox Icon */}
                    <button
                      type="button"
                      aria-label={isDone ? 'Mark task incomplete' : 'Mark task complete'}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {isDone ? (
                        <CheckCircle size={20} color={THEME.emeraldGreen} />
                      ) : (
                        <Circle size={20} color={THEME.warmStone} />
                      )}
                    </button>
                    <div>
                      <div
                        style={{
                          fontSize: '13.5px',
                          fontWeight: 700,
                          color: THEME.deepForestCharcoal,
                          textDecoration: isDone ? 'line-through' : 'none',
                          opacity: isDone ? 0.75 : 1,
                        }}
                      >
                        {task.title}
                      </div>
                      {task.due_date && (
                        <div style={{ fontSize: '11px', color: THEME.warmStone, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Clock size={11} color={THEME.warmStone} />
                          <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={task.priority === 'high' ? 'badge badge-urgent' : 'badge'}>
                      {task.priority}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTask(task.id)}
                      aria-label="Delete task"
                    >
                      <Trash2 size={13} color={THEME.warmStone} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Accessible Schedule Exam Modal */}
      <Modal
        isOpen={showExamModal}
        onClose={() => setShowExamModal(false)}
        title="Schedule Examination"
        description="Add examination milestones to trigger countdown timers and study reminders."
      >
        <form onSubmit={handleCreateExam} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              Examination Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Midterm Examination — Linear Algebra"
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
              Subject / Course Code *
            </label>
            <input
              type="text"
              placeholder="e.g. MAT201"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
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
              Exam Date *
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
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
              Study Notes / Hall / Syllabus
            </label>
            <textarea
              rows={2}
              placeholder="Room 304, Hall Ticket required, Chapters 1 through 5..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowExamModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creatingExam}>
              Schedule Exam
            </Button>
          </div>
        </form>
      </Modal>

      {/* Accessible Add Task Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title="Add Revision Task"
        description="Create actionable milestones linked to your examinations."
      >
        <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              Task Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Solve 2024 previous year question paper"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
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
              Linked Exam (Optional)
            </label>
            <select value={taskExamId} onChange={(e) => setTaskExamId(e.target.value)}>
              <option value="">None / General Study</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.exam_name} ({ex.subject})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                Due Date
              </label>
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
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
                Priority
              </label>
              <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowTaskModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creatingTask}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Exam Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingExamId)}
        onClose={() => setDeletingExamId(null)}
        title="Delete Examination?"
        description="This will delete this exam and its scheduled countdown."
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => setDeletingExamId(null)}>
            Cancel
          </Button>
          <Button variant="vermilion" onClick={handleDeleteExam}>
            Confirm Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Exams;
