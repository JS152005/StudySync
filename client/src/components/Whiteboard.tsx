import React, { useRef, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { useMeeting, WhiteboardStrokeAction } from '../meeting/MeetingProvider';
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
  Maximize2,
  Minimize2,
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
  const {
    setWhiteboardSharing,
    whiteboardActions,
    addWhiteboardStroke,
    clearWhiteboard,
  } = useMeeting();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [inkColor, setInkColor] = useState<InkColor>('#0F172A');
  const [lineWidth, setLineWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Announce active whiteboard sharing to room participants
  useEffect(() => {
    setWhiteboardSharing(true);
    return () => {
      setWhiteboardSharing(false);
    };
  }, [setWhiteboardSharing]);

  // Execute a normalized action on canvas
  const applyStrokeToCanvas = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, action: StrokeAction) => {
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();

    if (action.type === 'draw') {
      const fromX = (action.fromX ?? 0) * w;
      const fromY = (action.fromY ?? 0) * h;
      const toX = (action.toX ?? 0) * w;
      const toY = (action.toY ?? 0) * h;

      if (action.tool === 'eraser') {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = (action.width ?? 3) * 6;
      } else {
        ctx.strokeStyle = action.color || '#0F172A';
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

      ctx.strokeStyle = action.color || '#0F172A';
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
      ctx.fillStyle = action.color || '#0F172A';
      ctx.fillText(action.text, x, y);
    }

    ctx.restore();
  }, []);

  // Redraw complete history of whiteboard actions
  const redrawAllActions = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const item of whiteboardActions) {
      if (item.actionType === 'clear') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (item.stroke) {
        applyStrokeToCanvas(ctx, canvas, item.stroke);
      }
    }
  }, [whiteboardActions, applyStrokeToCanvas]);

  // Re-render when whiteboard actions array changes
  useEffect(() => {
    redrawAllActions();
  }, [whiteboardActions, redrawAllActions]);

  // Adjust canvas size to container while keeping aspect ratio and redrawing
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const newWidth = Math.max(640, Math.floor(rect.width));
    const newHeight = Math.max(480, Math.floor(rect.height - 70)); // minus toolbar height

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
      canvas.width = newWidth;
      canvas.height = newHeight;
      redrawAllActions();
    }
  }, [redrawAllActions]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  // Fullscreen toggle handler
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
        setTimeout(handleResize, 100);
      }).catch((err) => {
        console.warn('[Fullscreen] Whiteboard fullscreen error:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        setTimeout(handleResize, 100);
      }).catch(() => {});
    }
  }, [handleResize]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setTimeout(handleResize, 100);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [handleResize]);

  // Drawing mouse event handlers
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
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = lineWidth * 6;
      } else {
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = lineWidth;
      }

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();

      // Emit stroke action to room and persist
      addWhiteboardStroke({
        type: 'draw',
        tool: currentTool,
        color: currentTool === 'eraser' ? '#FFFFFF' : inkColor,
        width: lineWidth,
        fromX: prev.x / canvas.width,
        fromY: prev.y / canvas.height,
        toX: x / canvas.width,
        toY: y / canvas.height,
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

        addWhiteboardStroke({
          type: 'text',
          text: text.trim(),
          x: startPos.x / canvas.width,
          y: startPos.y / canvas.height,
          color: inkColor,
        });
      }
    } else if (['rect', 'circle', 'line'].includes(currentTool) && startPos) {
      addWhiteboardStroke({
        type: 'shape',
        tool: currentTool,
        startX: startPos.x / canvas.width,
        startY: startPos.y / canvas.height,
        endX: endX / canvas.width,
        endY: endY / canvas.height,
        color: inkColor,
        width: lineWidth,
      });
    }

    setIsDrawing(false);
    setStartPos(null);
    setLastPos(null);
  };

  const handleClear = () => {
    if (!window.confirm('Clear whiteboard for all participants in this room?')) return;
    clearWhiteboard();
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `studysync-whiteboard-${roomId}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: isFullscreen ? '0' : THEME.radius.card,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Whiteboard Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 14px',
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          zIndex: 5,
        }}
        role="toolbar"
        aria-label="Whiteboard drawing tools"
      >
        {/* Tool selector buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
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
                  padding: '5px 10px',
                  backgroundColor: active ? '#0284C7' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#334155',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  borderRadius: THEME.radius.sm,
                  border: `1px solid ${active ? '#0284C7' : '#CBD5E1'}`,
                  cursor: 'pointer',
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                }}
                title={tool.label}
              >
                <Icon size={13} />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>

        {/* Color Palette, Line Width & Canvas Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Color palette */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {['#0F172A', '#0284C7', '#10B981', '#DC2626', '#F59E0B', '#8B5CF6'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setInkColor(c)}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: c,
                  border: inkColor === c ? '2.5px solid #000000' : '1px solid rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  transform: inkColor === c ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.15s ease',
                }}
                title={c}
              />
            ))}
          </div>

          {/* Stroke Width Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>Width</span>
            <input
              type="range"
              min="1"
              max="12"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              style={{ width: '60px', cursor: 'pointer' }}
            />
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: '#CBD5E1' }} />

          {/* Clear Board */}
          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: '5px 10px',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              border: '1px solid #FECACA',
              borderRadius: THEME.radius.sm,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Clear board for all participants"
          >
            <RotateCcw size={13} />
            <span>Clear</span>
          </button>

          {/* Download Canvas Image */}
          <button
            type="button"
            onClick={handleDownload}
            style={{
              padding: '5px 10px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              border: '1px solid #CBD5E1',
              borderRadius: THEME.radius.sm,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Export whiteboard image"
          >
            <Download size={13} />
            <span>Export</span>
          </button>

          {/* Fullscreen Mode Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            style={{
              padding: '5px 10px',
              backgroundColor: isFullscreen ? '#0F172A' : '#F1F5F9',
              color: isFullscreen ? '#FFFFFF' : '#0F172A',
              border: '1px solid #CBD5E1',
              borderRadius: THEME.radius.sm,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Main Drawing Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            cursor: currentTool === 'eraser' ? 'cell' : currentTool === 'text' ? 'text' : 'crosshair',
            touchAction: 'none',
          }}
        />
      </div>
    </div>
  );
};
