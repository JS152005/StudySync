import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { CalendarDays, Plus, CheckCircle, Circle, Trash2 } from 'lucide-react';

export const Exams: React.FC = () => {
  const [exams, setExams] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Exam Modal
  const [showExamModal, setShowExamModal] = useState(false);
  const [examName, setExamName] = useState('');
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState('');
  const [notes, setNotes] = useState('');

  // New Task Modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskExamId, setTaskExamId] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');

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
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
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
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: number) => {
    try {
      await apiRequest(`/exams/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_completed: currentStatus === 1 ? 0 : 1 }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await apiRequest(`/exams/tasks/${taskId}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm('Delete this examination and associated schedule?')) return;
    try {
      await apiRequest(`/exams/${examId}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message);
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
            Exam Planner & Study Schedule
          </h1>
          <p style={{ fontSize: '13px', color: THEME.warmStone }}>
            Track countdowns to semester examinations, schedule revision milestones, and check off study tasks.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowTaskModal(true)} className="btn-secondary">
            <Plus size={15} color={THEME.deepForestCharcoal} />
            <span>Add Task</span>
          </button>
          <button onClick={() => setShowExamModal(true)} className="btn-primary">
            <CalendarDays size={15} color={THEME.warmIvory} />
            <span>Schedule Exam</span>
          </button>
        </div>
      </div>

      {/* Examinations Grid with Real Countdowns */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
          Scheduled Examinations ({exams.length})
        </h2>

        {exams.length === 0 ? (
          <div className="card-secondary" style={{ textAlign: 'center', padding: '36px' }}>
            <CalendarDays size={36} color={THEME.warmStone} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '6px', color: THEME.deepForestCharcoal }}>
              No examinations scheduled yet
            </div>
            <p style={{ fontSize: '13px', marginBottom: '14px', color: THEME.warmStone }}>
              Add your midterm, lab viva, or final semester examination dates.
            </p>
            <button onClick={() => setShowExamModal(true)} className="btn-primary">
              <span>Schedule Your First Exam</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {exams.map((ex) => {
              const daysLeft = calculateDaysLeft(ex.exam_date);
              const isUrgent = daysLeft >= 0 && daysLeft <= 3;
              return (
                <div
                  key={ex.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    border: `1.5px solid ${isUrgent ? THEME.vermilion : THEME.deepForestCharcoal}`,
                    backgroundColor: THEME.warmIvory,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className="badge">{ex.subject}</span>
                      <button onClick={() => handleDeleteExam(ex.id)} className="btn-secondary" style={{ padding: '2px 6px' }}>
                        <Trash2 size={12} color={THEME.deepForestCharcoal} />
                      </button>
                    </div>

                    <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                      {ex.exam_name}
                    </h3>
                    <div style={{ fontSize: '12px', marginBottom: '8px', color: THEME.warmStone }}>
                      Date: {new Date(ex.exam_date).toLocaleDateString()}
                    </div>

                    {/* Countdown Display */}
                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: THEME.warmIvory,
                        borderRadius: '6px',
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

                  <div style={{ fontSize: '11.5px', fontWeight: 600, borderTop: `1px solid ${THEME.warmStone}`, paddingTop: '8px', color: THEME.warmStone }}>
                    Tasks completed: {ex.completed_tasks} / {ex.total_tasks}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revision Tasks Checklist */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: `1.5px solid ${THEME.deepForestCharcoal}`, backgroundColor: THEME.warmIvory }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Revision Tasks Checklist ({tasks.length})
          </h2>
          <button onClick={() => setShowTaskModal(true)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Plus size={14} color={THEME.deepForestCharcoal} />
            <span>Add Study Task</span>
          </button>
        </div>

        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', fontSize: '13px', color: THEME.warmStone }}>
            No study tasks added yet. Create specific milestones to conquer your syllabus!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tasks.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: THEME.warmIvory,
                  borderRadius: '6px',
                  border: `1px solid ${t.is_completed === 1 ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <button
                    onClick={() => handleToggleTask(t.id, t.is_completed)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    {t.is_completed === 1 ? (
                      <CheckCircle size={19} color={THEME.emeraldGreen} />
                    ) : (
                      <Circle size={19} color={THEME.deepForestCharcoal} />
                    )}
                  </button>

                  <div style={{ textDecoration: t.is_completed === 1 ? 'line-through' : 'none' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: THEME.deepForestCharcoal }}>{t.title}</div>
                    <div style={{ fontSize: '11px', color: THEME.warmStone }}>
                      {t.exam_name ? `${t.exam_name} • ` : ''}Due: {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No date'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={t.priority === 'high' ? 'badge badge-urgent' : t.priority === 'medium' ? 'badge' : 'badge-outline'}>
                    {t.priority}
                  </span>
                  <button onClick={() => handleDeleteTask(t.id)} className="btn-secondary" style={{ padding: '4px 8px' }}>
                    <Trash2 size={12} color={THEME.deepForestCharcoal} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Exam Modal */}
      {showExamModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: THEME.deepForestCharcoal }}>
              Schedule Examination
            </h2>
            <form onSubmit={handleCreateExam} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Exam Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Artificial Intelligence Final Exam"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Subject *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Exam hall, allowed calculators, syllabus references..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowExamModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: THEME.deepForestCharcoal }}>
              Add Study Task
            </h2>
            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Solve previous year question paper 2024"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>

              {exams.length > 0 && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                    Associate with Exam
                  </label>
                  <select
                    value={taskExamId}
                    onChange={(e) => setTaskExamId(e.target.value)}
                  >
                    <option value="">None / General Study</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.subject})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Priority
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowTaskModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
