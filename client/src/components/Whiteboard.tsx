import React, { useRef, useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
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
type InkColor = typeof THEME.deepForestCharcoal | typeof THEME.emeraldGreen | typeof THEME.vermilion;

export const Whiteboard: React.FC<WhiteboardProps> = ({ roomId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [inkColor, setInkColor] = useState<InkColor>(THEME.deepForestCharcoal);
  const [lineWidth, setLineWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');

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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setStartPos({ x, y });
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Strict palette adherence
    if (currentTool === 'eraser') {
      ctx.strokeStyle = THEME.warmIvory;
      ctx.lineWidth = lineWidth * 5;
    } else {
      ctx.strokeStyle = inkColor;
      ctx.fillStyle = inkColor;
      ctx.lineWidth = lineWidth;
    }

    if (currentTool === 'pen' || currentTool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (snapshot && startPos) {
      ctx.putImageData(snapshot, 0, 0);

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
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (currentTool === 'text' && startPos) {
      const text = prompt('Enter text annotation:');
      if (text) {
        ctx.font = 'bold 16px -apple-system, sans-serif';
        ctx.fillStyle = inkColor;
        ctx.fillText(text, startPos.x, startPos.y);
      }
    }

    setIsDrawing(false);
    setStartPos(null);
  };

  const handleClear = () => {
    if (!window.confirm('Clear entire whiteboard?')) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = THEME.warmIvory;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
          backgroundColor: THEME.warmIvory,
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
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
                  padding: '6px 10px',
                  backgroundColor: active ? THEME.emeraldGreen : THEME.warmIvory,
                  color: active ? THEME.warmIvory : THEME.deepForestCharcoal,
                  borderColor: active ? THEME.emeraldGreen : THEME.deepForestCharcoal,
                  fontSize: '12px',
                  borderRadius: THEME.radius.sm,
                  fontWeight: active ? 700 : 600,
                  transition: `background-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                }}
              >
                <Icon size={14} color={active ? THEME.warmIvory : THEME.deepForestCharcoal} />
                <span>{tool.label}</span>
              </button>
            );
          })}

          {/* Stroke Width Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
            {[2, 4, 8].map((size) => {
              const active = lineWidth === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setLineWidth(size)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    backgroundColor: active ? THEME.deepForestCharcoal : THEME.warmIvory,
                    color: active ? THEME.warmIvory : THEME.deepForestCharcoal,
                    borderColor: active ? THEME.deepForestCharcoal : THEME.warmStone,
                    borderRadius: THEME.radius.sm,
                    fontWeight: 700,
                  }}
                >
                  {size}px
                </button>
              );
            })}
          </div>

          {/* Color Chooser (Approved Palette ONLY) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
            {[THEME.deepForestCharcoal, THEME.emeraldGreen, THEME.vermilion].map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setInkColor(col as InkColor)}
                aria-label={`Select ink color ${col}`}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: THEME.radius.full,
                  backgroundColor: col,
                  border: inkColor === col ? `3px solid ${THEME.warmIvory}` : `1.5px solid ${THEME.deepForestCharcoal}`,
                  outline: inkColor === col ? `2px solid ${THEME.deepForestCharcoal}` : 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {saveStatus && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: THEME.emeraldGreen,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Check size={14} color={THEME.emeraldGreen} />
              {saveStatus}
            </span>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleClear}
            leftIcon={<RotateCcw size={13} color={THEME.deepForestCharcoal} />}
          >
            Clear
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            leftIcon={<Download size={13} color={THEME.deepForestCharcoal} />}
          >
            Export
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            leftIcon={<Save size={13} color={THEME.warmIvory} />}
          >
            Save Board
          </Button>
        </div>
      </div>

      {/* Canvas Frame */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          backgroundColor: THEME.warmIvory,
          border: `2px solid ${THEME.deepForestCharcoal}`,
          borderRadius: THEME.radius.card,
          boxShadow: THEME.shadow.card,
        }}
      >
        <canvas
          ref={canvasRef}
          width={900}
          height={560}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            maxHeight: '600px',
            cursor: currentTool === 'eraser' ? 'cell' : 'crosshair',
            backgroundColor: THEME.warmIvory,
          }}
        />
      </div>
    </div>
  );
};

export default Whiteboard;
