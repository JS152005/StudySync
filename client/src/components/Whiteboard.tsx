import React, { useRef, useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
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
} from 'lucide-react';

interface WhiteboardProps {
  roomId: string;
}

type Tool = 'pen' | 'eraser' | 'rect' | 'circle' | 'line' | 'text';

export const Whiteboard: React.FC<WhiteboardProps> = ({ roomId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
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

    // Fill white background initially
    ctx.fillStyle = '#FFFFFF';
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

    // Colors strictly adhering to palette
    if (currentTool === 'eraser') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = lineWidth * 4;
    } else {
      ctx.strokeStyle = '#E6E6FA';
      ctx.fillStyle = '#E6E6FA';
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
        ctx.fillStyle = '#E6E6FA';
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

    ctx.fillStyle = '#FFFFFF';
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
        className="card-secondary"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '10px 16px',
        }}
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
                  backgroundColor: active ? '#E6E6FA' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#E6E6FA',
                  fontSize: '12px',
                }}
              >
                <Icon size={14} color={active ? '#FFFFFF' : '#E6E6FA'} />
                <span>{tool.label}</span>
              </button>
            );
          })}

          {/* Stroke Width Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
            {[2, 4, 8].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setLineWidth(size)}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: lineWidth === size ? '#E6E6FA' : '#FFFFFF',
                  color: lineWidth === size ? '#FFFFFF' : '#E6E6FA',
                }}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {saveStatus && <span style={{ fontSize: '12px', fontWeight: 800 }}>{saveStatus}</span>}

          <button type="button" onClick={handleSave} className="btn-accent" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Save size={14} color="#E6E6FA" />
            <span>Save</span>
          </button>

          <button type="button" onClick={handleDownload} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Download size={14} color="#E6E6FA" />
            <span>Export PNG</span>
          </button>

          <button type="button" onClick={handleClear} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }}>
            <RotateCcw size={14} color="#E6E6FA" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* HTML5 Canvas Surface */}
      <div
        style={{
          border: '3px solid #E6E6FA',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          justifyContent: 'center',
          boxShadow: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{
            cursor: currentTool === 'eraser' ? 'cell' : 'crosshair',
            backgroundColor: '#FFFFFF',
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
};
