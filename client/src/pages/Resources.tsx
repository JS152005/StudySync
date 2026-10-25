import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { SegmentedControl, SegmentOption } from '../components/ui/SegmentedControl';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { FolderOpen, Upload, Download, Trash2, FileText, Link, Image as ImageIcon, ExternalLink, Plus } from 'lucide-react';

export const Resources: React.FC = () => {
  const [searchParams] = useSearchParams();
  const defaultGroupId = searchParams.get('group_id') || '';
  const toast = useToast();

  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

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
  const [savingLink, setSavingLink] = useState(false);

  // Delete Resource Modal
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      toast.success('Document uploaded to library!');
      loadResources();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLink(true);
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
      toast.success('Resource link saved!');
      loadResources();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingLink(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await apiRequest(`/resources/${deletingId}`, { method: 'DELETE' });
      toast.info('Resource removed');
      setDeletingId(null);
      loadResources();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'pdf':
      case 'document':
      case 'note':
        return <FileText size={18} color={THEME.emeraldGreen} />;
      case 'image':
      case 'whiteboard':
        return <ImageIcon size={18} color={THEME.emeraldGreen} />;
      case 'link':
      default:
        return <Link size={18} color={THEME.emeraldGreen} />;
    }
  };

  const filteredResources = resources.filter((r) => {
    if (filterType === 'all') return true;
    if (filterType === 'documents') return r.file_type === 'pdf' || r.file_type === 'document' || r.file_type === 'note';
    if (filterType === 'images') return r.file_type === 'image' || r.file_type === 'whiteboard';
    if (filterType === 'links') return r.file_type === 'link';
    return true;
  });

  const filterOptions: SegmentOption<string>[] = [
    { value: 'all', label: 'All Files', count: resources.length },
    { value: 'documents', label: 'Docs & PDFs' },
    { value: 'images', label: 'Images & Boards' },
    { value: 'links', label: 'Links' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Resource Library & Study Notes
          </h1>
          <p style={{ fontSize: '13px', color: THEME.warmStone }}>
            Upload and share course notes, lecture slides, question banks, and whiteboard exports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            shape="pill"
            onClick={() => setShowLinkModal(true)}
            leftIcon={<Link size={15} color={THEME.deepForestCharcoal} />}
          >
            Add Link
          </Button>
          <Button
            variant="primary"
            shape="pill"
            onClick={() => setShowUploadModal(true)}
            leftIcon={<Upload size={15} color={THEME.warmIvory} />}
          >
            Upload Document
          </Button>
        </div>
      </div>

      {/* Filter Segmented Control */}
      {resources.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SegmentedControl
            options={filterOptions}
            value={filterType}
            onChange={(val) => setFilterType(val)}
            variant="pill"
            size="sm"
          />
        </div>
      )}

      {/* Resources Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          <Skeleton height="170px" borderRadius={THEME.radius.card} />
          <Skeleton height="170px" borderRadius={THEME.radius.card} />
          <Skeleton height="170px" borderRadius={THEME.radius.card} />
        </div>
      ) : resources.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={36} />}
          title="No study resources uploaded yet"
          description="Upload PDF notes, cheatsheets, or textbook diagrams to share with your group."
          action={
            <Button variant="primary" shape="pill" onClick={() => setShowUploadModal(true)}>
              Upload File
            </Button>
          }
        />
      ) : filteredResources.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={28} />}
          title="No resources match this filter"
          description="Select another category or upload files for this course."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredResources.map((r) => (
            <div
              key={r.id}
              className="card card-interactive"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
                border: `1.5px solid ${THEME.deepForestCharcoal}`,
                backgroundColor: THEME.warmIvory,
                borderRadius: THEME.radius.card,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {renderIcon(r.file_type)}
                    <span className="badge">{r.file_type}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingId(r.id)}
                    aria-label="Delete resource"
                  >
                    <Trash2 size={13} color={THEME.warmStone} />
                  </Button>
                </div>

                <h3
                  style={{
                    fontSize: '15.5px',
                    fontWeight: 800,
                    marginBottom: '4px',
                    color: THEME.deepForestCharcoal,
                  }}
                >
                  {r.title}
                </h3>
                {r.description && (
                  <p style={{ fontSize: '12px', lineHeight: 1.45, marginBottom: '8px', color: THEME.deepForestCharcoal }}>
                    {r.description}
                  </p>
                )}

                <div style={{ fontSize: '11px', marginTop: '6px', color: THEME.warmStone }}>
                  Uploaded by {r.author_name} {r.group_name ? `• ${r.group_name}` : ''}
                </div>
              </div>

              {r.file_type === 'link' ? (
                <a
                  href={r.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary btn-pill"
                  style={{ width: '100%', textAlign: 'center', textDecoration: 'none', justifyContent: 'center' }}
                >
                  <ExternalLink size={14} color={THEME.deepForestCharcoal} />
                  <span>Open Resource Link</span>
                </a>
              ) : (
                <a
                  href={r.file_url}
                  download
                  className="btn-primary btn-pill"
                  style={{ width: '100%', textAlign: 'center', textDecoration: 'none', justifyContent: 'center' }}
                >
                  <Download size={14} color={THEME.warmIvory} />
                  <span>Download File</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Accessible Upload File Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Study Document"
        description="Share lecture notes, question banks, or whiteboard exports."
      >
        <form onSubmit={handleFileUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              Select File *
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              required
              style={{ padding: '8px' }}
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
              Title (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Thermodynamics Cheat Sheet — Formulae"
              value={fileTitle}
              onChange={(e) => setFileTitle(e.target.value)}
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
              Description / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Summary of contents, textbook editions..."
              value={fileDesc}
              onChange={(e) => setFileDesc(e.target.value)}
            />
          </div>

          {/* Polished Animated ToggleSwitch for Public Sharing */}
          <div
            style={{
              padding: '12px',
              borderRadius: THEME.radius.md,
              border: `1.5px solid ${THEME.deepForestCharcoal}`,
              backgroundColor: THEME.warmIvory,
            }}
          >
            <ToggleSwitch
              id="resource-public-toggle"
              checked={isPublic}
              onChange={setIsPublic}
              label="Make Globally Public"
              description="Visible to all students across your institution instead of only your private study group."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={uploading}>
              Upload Document
            </Button>
          </div>
        </form>
      </Modal>

      {/* Accessible Add Link Modal */}
      <Modal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title="Add Resource Web Link"
        description="Save external references, lecture YouTube playlists, or GitHub repos."
      >
        <form onSubmit={handleLinkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              Link Title *
            </label>
            <input
              type="text"
              placeholder="e.g. MIT OpenCourseWare 6.006 Lecture 1"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
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
              URL Address *
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
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
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Key concepts covered in this video/article..."
              value={linkDesc}
              onChange={(e) => setLinkDesc(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowLinkModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={savingLink}>
              Add Link
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        title="Delete Resource?"
        description="Are you sure you want to remove this resource from the library?"
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => setDeletingId(null)}>
            Cancel
          </Button>
          <Button variant="vermilion" onClick={handleDelete}>
            Confirm Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Resources;
