import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { FolderOpen, Upload, Plus, Download, Trash2, FileText, Link, Image as ImageIcon, ExternalLink } from 'lucide-react';

export const Resources: React.FC = () => {
  const [searchParams] = useSearchParams();
  const defaultGroupId = searchParams.get('group_id') || '';

  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload File Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const [fileDesc, setFileDesc] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Add Link Modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDesc, setLinkDesc] = useState('');

  const loadResources = async () => {
    try {
      const query = defaultGroupId ? `?group_id=${defaultGroupId}` : '';
      const data = await apiRequest<{ resources: any[] }>(`/resources${query}`);
      setResources(data.resources);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, [defaultGroupId]);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', fileTitle || file.name);
    formData.append('description', fileDesc);
    if (defaultGroupId) formData.append('group_id', defaultGroupId);
    if (isPublic) formData.append('is_public', '1');

    try {
      await apiRequest('/resources/upload', {
        method: 'POST',
        body: formData,
      });
      setShowUploadModal(false);
      setFile(null);
      setFileTitle('');
      setFileDesc('');
      loadResources();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/resources/link', {
        method: 'POST',
        body: JSON.stringify({
          title: linkTitle,
          url: linkUrl,
          description: linkDesc,
          group_id: defaultGroupId || null,
        }),
      });
      setShowLinkModal(false);
      setLinkTitle('');
      setLinkUrl('');
      setLinkDesc('');
      loadResources();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this resource?')) return;
    try {
      await apiRequest(`/resources/${id}`, { method: 'DELETE' });
      loadResources();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'pdf':
      case 'document':
      case 'note':
        return <FileText size={20} color="#E6E6FA" />;
      case 'image':
      case 'whiteboard':
        return <ImageIcon size={20} color="#E6E6FA" />;
      case 'link':
      default:
        return <Link size={20} color="#E6E6FA" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900 }}>Resource Library & Notes</h1>
          <p style={{ fontSize: '13px' }}>Upload and share course notes, lecture slides, question banks, and whiteboard exports.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowLinkModal(true)} className="btn-secondary">
            <Link size={16} color="#E6E6FA" />
            <span>Add Link</span>
          </button>
          <button onClick={() => setShowUploadModal(true)} className="btn-primary">
            <Upload size={16} color="#FFFFFF" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Resources Grid */}
      {loading ? (
        <div className="card" style={{ padding: '36px', textAlign: 'center' }}>Loading resources...</div>
      ) : resources.length === 0 ? (
        <div className="card-secondary" style={{ textAlign: 'center', padding: '48px' }}>
          <FolderOpen size={40} color="#E6E6FA" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>No study resources uploaded yet</div>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>Upload PDF notes, cheatsheets, or textbook diagrams to share with your group.</p>
          <button onClick={() => setShowUploadModal(true)} className="btn-primary">
            <span>Upload File</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {resources.map((r) => (
            <div
              key={r.id}
              className="card"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {renderIcon(r.file_type)}
                    <span className="badge">{r.file_type}</span>
                  </div>
                  <button onClick={() => handleDelete(r.id)} className="btn-secondary" style={{ padding: '4px 6px' }}>
                    <Trash2 size={12} color="#E6E6FA" />
                  </button>
                </div>

                <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '4px' }}>{r.title}</h3>
                {r.description && <p style={{ fontSize: '12px', lineHeight: 1.4, marginBottom: '8px' }}>{r.description}</p>}

                <div style={{ fontSize: '11px', marginTop: '6px' }}>
                  Uploaded by {r.author_name} {r.group_name ? `• ${r.group_name}` : ''}
                </div>
              </div>

              {r.file_type === 'link' ? (
                <a
                  href={r.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-accent"
                  style={{ width: '100%', textAlign: 'center', textDecoration: 'none' }}
                >
                  <ExternalLink size={14} color="#E6E6FA" />
                  <span>Open Resource Link</span>
                </a>
              ) : (
                <a
                  href={r.file_url}
                  download
                  className="btn-primary"
                  style={{ width: '100%', textAlign: 'center', textDecoration: 'none' }}
                >
                  <Download size={14} color="#FFFFFF" />
                  <span>Download File</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload File Modal */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '16px' }}>Upload Study Resource</h2>
            <form onSubmit={handleFileUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Choose File *</label>
                <input
                  type="file"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] || null;
                    setFile(selected);
                    if (selected && !fileTitle) setFileTitle(selected.name);
                  }}
                  required
                />
                <div style={{ fontSize: '11px', marginTop: '4px' }}>Max size: 15MB. Allowed: PDF, Images, Word, Text.</div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Resource Title</label>
                <input
                  type="text"
                  placeholder="e.g. Unit 2 Summary Notes & Cheat Sheet"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  rows={2}
                  placeholder="What is covered in this document..."
                  value={fileDesc}
                  onChange={(e) => setFileDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowUploadModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={uploading || !file} className="btn-primary">
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Link Modal */}
      {showLinkModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '16px' }}>Add Educational Resource Link</h2>
            <form onSubmit={handleLinkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Resource Title *</label>
                <input
                  type="text"
                  placeholder="e.g. NPTEL Operating Systems Lecture Series"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>URL *</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  rows={2}
                  placeholder="Why is this resource useful..."
                  value={linkDesc}
                  onChange={(e) => setLinkDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowLinkModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
