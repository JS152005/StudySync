import React, { useRef, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';
import { getSocket } from '../api/socket';
import { THEME } from '../theme';
import { Button } from './ui/Button';
import {
  Pen,
  Eraser,
  Square,
  Circle,
  Minus,
  Type,
  RotateCcw,
  Download,
  Save,
  Check,
} from 'lucide-react';

interface WhiteboardProps {
  roomId: string;
}

type Tool = 'pen' | 'eraser' | 'rect' | 'circle' | 'line' | 'text';
type InkColor = string;

interface StrokeAction {
  type: 'draw' | 'shape' | 'text';
  tool?: Tool;
  color?: string;
  width?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  x?: number;
  y?: number;
  text?: string;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({ roomId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [inkColor, setInkColor] = useState<InkColor>(THEME.deepForestCharcoal);
  const [lineWidth, setLineWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // Execute a normalized remote action on canvas
  const applyRemoteStroke = useCallback((action: StrokeAction) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.save();

    if (action.type === 'draw') {
      const fromX = (action.fromX ?? 0) * w;
      const fromY = (action.fromY ?? 0) * h;
      const toX = (action.toX ?? 0) * w;
      const toY = (action.toY ?? 0) * h;

      if (action.tool === 'eraser') {
        ctx.strokeStyle = THEME.warmIvory;
        ctx.lineWidth = (action.width ?? 3) * 5;
      } else {
        ctx.strokeStyle = action.color || THEME.deepForestCharcoal;
        ctx.lineWidth = action.width ?? 3;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    } else if (action.type === 'shape') {
      const startX = (action.startX ?? 0) * w;
      const startY = (action.startY ?? 0) * h;
      const endX = (action.endX ?? 0) * w;
      const endY = (action.endY ?? 0) * h;

      ctx.strokeStyle = action.color || THEME.deepForestCharcoal;
      ctx.lineWidth = action.width ?? 3;

      if (action.tool === 'rect') {
        ctx.strokeRect(startX, startY, endX - startX, endY - startY);
      } else if (action.tool === 'circle') {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        ctx.beginPath();
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (action.tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    } else if (action.type === 'text' && action.text) {
      const x = (action.x ?? 0) * w;
      const y = (action.y ?? 0) * h;
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = action.color || THEME.deepForestCharcoal;
      ctx.fillText(action.text, x, y);
    }

    ctx.restore();
  }, []);

  // Socket.IO real-time synchronization
  useEffect(() => {
    const socket = getSocket();
    socket.emit('join_study_room', { roomId });

    const handleStroke = (action: StrokeAction) => {
      applyRemoteStroke(action);
    };

    const handleClear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = THEME.warmIvory;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    socket.on('whiteboard_stroke', handleStroke);
    socket.on('whiteboard_clear', handleClear);

    return () => {
      socket.off('whiteboard_stroke', handleStroke);
      socket.off('whiteboard_clear', handleClear);
    };
  }, [roomId, applyRemoteStroke]);

  // Load saved canvas data on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill Warm Ivory background initially
    ctx.fillStyle = THEME.warmIvory;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    apiRequest<{ canvasData: string }>(`/rooms/${roomId}/whiteboard`)
      .then((data) => {
        if (data.canvasData && data.canvasData !== '[]') {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
          img.src = data.canvasData;
        }
      })
      .catch((err) => console.error('Failed to load whiteboard:', err));
  }, [roomId]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setIsDrawing(true);
    setStartPos({ x, y });
    setLastPos({ x, y });
    setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));

    if (currentTool === 'pen' || currentTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (currentTool === 'pen' || currentTool === 'eraser') {
      const prev = lastPos || startPos || { x, y };

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (currentTool === 'eraser') {
        ctx.strokeStyle = THEME.warmIvory;
        ctx.lineWidth = lineWidth * 5;
      } else {
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = lineWidth;
      }

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();

      // Emit stroke action over socket
      const socket = getSocket();
      socket.emit('whiteboard_stroke', {
        roomId,
        stroke: {
          type: 'draw',
          tool: currentTool,
          color: currentTool === 'eraser' ? THEME.warmIvory : inkColor,
          width: lineWidth,
          fromX: prev.x / canvas.width,
          fromY: prev.y / canvas.height,
          toX: x / canvas.width,
          toY: y / canvas.height,
        },
      });

      setLastPos({ x, y });
    } else if (snapshot && startPos) {
      // Shape preview locally
      ctx.putImageData(snapshot, 0, 0);
      ctx.save();
      ctx.strokeStyle = inkColor;
      ctx.fillStyle = inkColor;
      ctx.lineWidth = lineWidth;

      if (currentTool === 'rect') {
        ctx.strokeRect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
      } else if (currentTool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (currentTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const endX = (e.clientX - rect.left) * scaleX;
    const endY = (e.clientY - rect.top) * scaleY;

    if (currentTool === 'text' && startPos) {
      const text = prompt('Enter text note for whiteboard:');
      if (text && text.trim()) {
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = inkColor;
        ctx.fillText(text.trim(), startPos.x, startPos.y);

        const socket = getSocket();
        socket.emit('whiteboard_stroke', {
          roomId,
          stroke: {
            type: 'text',
            text: text.trim(),
            x: startPos.x / canvas.width,
            y: startPos.y / canvas.height,
            color: inkColor,
          },
        });
      }
    } else if (['rect', 'circle', 'line'].includes(currentTool) && startPos) {
      const socket = getSocket();
      socket.emit('whiteboard_stroke', {
        roomId,
        stroke: {
          type: 'shape',
          tool: currentTool,
          startX: startPos.x / canvas.width,
          startY: startPos.y / canvas.height,
          endX: endX / canvas.width,
          endY: endY / canvas.height,
          color: inkColor,
          width: lineWidth,
        },
      });
    }

    setIsDrawing(false);
    setStartPos(null);
    setLastPos(null);
  };

  const handleClear = () => {
    if (!window.confirm('Clear whiteboard for all participants in this room?')) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = THEME.warmIvory;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const socket = getSocket();
    socket.emit('whiteboard_clear', { roomId });
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');

    try {
      setSaveStatus('Saving...');
      await apiRequest(`/rooms/${roomId}/whiteboard`, {
        method: 'PUT',
        body: JSON.stringify({ canvasData: dataUrl }),
      });
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 2500);
    } catch {
      setSaveStatus('Failed to save');
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `studysync-whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {/* Whiteboard Toolbar */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '10px 16px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: THEME.radius.card,
        }}
        role="toolbar"
        aria-label="Whiteboard drawing tools"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'pen', label: 'Pen', icon: Pen },
            { id: 'eraser', label: 'Eraser', icon: Eraser },
            { id: 'rect', label: 'Rectangle', icon: Square },
            { id: 'circle', label: 'Circle', icon: Circle },
            { id: 'line', label: 'Line', icon: Minus },
            { id: 'text', label: 'Text', icon: Type },
          ].map((tool) => {
            const Icon = tool.icon;
            const active = currentTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setCurrentTool(tool.id as Tool)}
                style={{
                  padding: '6px 11px',
                  backgroundColor: active ? '#0284C7' : '#F1F5F9',
                  color: active ? '#FFFFFF' : '#475569',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: THEME.radius.sm,
                  border: `1px solid ${active ? '#0284C7' : '#E2E8F0'}`,
                  cursor: 'pointer',
                  fontWeight: 700,
                  transition: `all ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                }}
              >
                <Icon size={14} color={active ? '#FFFFFF' : '#475569'} />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Stroke Palette */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>COLOR</span>
            {[
              { color: '#F8FAFC', name: 'White' },
              { color: '#38BDF8', name: 'Azure' },
              { color: '#10B981', name: 'Mint' },
              { color: '#F59E0B', name: 'Amber' },
              { color: '#F43F5E', name: 'Rose' },
            ].map((c) => (
              <button
                key={c.color}
                type="button"
                onClick={() => setInkColor(c.color)}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: THEME.radius.full,
                  backgroundColor: c.color,
                  border: inkColor === c.color ? '2px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.2)',
                  cursor: 'pointer',
                  outline: inkColor === c.color ? '2px solid #0EA5E9' : 'none',
                  padding: 0,
                }}
                title={c.name}
              />
            ))}
          </div>

          {/* Stroke Width Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>SIZE</span>
            <input
              type="range"
              min="1"
              max="14"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              style={{ width: '65px', accentColor: '#0EA5E9', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC', width: '16px', fontVariantNumeric: 'tabular-nums' }}>
              {lineWidth}
            </span>
          </div>

          <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Button
              variant="secondary"
              size="sm"
              shape="rounded"
              onClick={handleClear}
              leftIcon={<RotateCcw size={13} color="#F8FAFC" />}
              title="Clear entire whiteboard"
            >
              Clear
            </Button>
            <Button
              variant="secondary"
              size="sm"
              shape="rounded"
              onClick={handleSave}
              leftIcon={saveStatus === 'Saved!' ? <Check size={13} color="#10B981" /> : <Save size={13} color="#F8FAFC" />}
            >
              {saveStatus || 'Save'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              shape="rounded"
              onClick={handleDownload}
              leftIcon={<Download size={13} color="#F8FAFC" />}
              title="Download snapshot as PNG"
            >
              PNG
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        className="card"
        style={{
          position: 'relative',
          padding: 0,
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: THEME.radius.card,
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          boxShadow: THEME.shadow.card,
        }}
      >
        <canvas
          ref={canvasRef}
          width={1200}
          height={700}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '620px',
            backgroundColor: '#FFFFFF',
            cursor: currentTool === 'eraser' ? 'cell' : currentTool === 'text' ? 'text' : 'crosshair',
            touchAction: 'none',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
};

export default Whiteboard;
