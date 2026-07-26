import { useCallback, useEffect, useState } from 'react'
import { DownloadOutlined, FilePdfOutlined, PaperClipOutlined } from '@ant-design/icons'
import { trainingApi } from '../api/trainingApi.js'
import { formatEvidenceStorageSummary } from '../utils/evidenceFile.js'
import { openEvidenceUrl, resolveEvidenceUrl } from '../utils/evidenceUrl.js'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

const moderationLabels = {
  PASSED: 'Đã duyệt',
  FAILED: 'Từ chối',
  ERROR: 'Lỗi kiểm duyệt',
  PENDING: 'Chờ duyệt',
}

function formatSize(bytes) {
  const value = Number(bytes || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

export default function EvidenceGallery({ recordId, evidences = [], onError }) {
  const [previews, setPreviews] = useState({})

  const loadPreview = useCallback(async (evidenceId) => {
    setPreviews(previous => ({ ...previous, [evidenceId]: { status: 'loading' } }))
    try {
      const response = await trainingApi.createEvidencePreviewUrl(recordId, evidenceId)
      const url = resolveEvidenceUrl(response.data?.data?.downloadUrl)
      if (!url) throw new Error('Preview URL is missing')
      setPreviews(previous => ({ ...previous, [evidenceId]: { status: 'ready', url } }))
    } catch {
      setPreviews(previous => ({ ...previous, [evidenceId]: { status: 'error' } }))
    }
  }, [recordId])

  useEffect(() => {
    const imageIds = evidences.filter(item => IMAGE_TYPES.has(item?.mimeType?.toLowerCase())).map(item => item.id)
    if (imageIds.length === 0) return undefined
    const timer = window.setTimeout(() => imageIds.forEach(loadPreview), 0)
    return () => window.clearTimeout(timer)
  }, [evidences, loadPreview])

  const download = async (evidence) => {
    try {
      const response = await trainingApi.createEvidenceDownloadUrl(recordId, evidence.id)
      if (!openEvidenceUrl(response.data?.data?.downloadUrl)) throw new Error('Download URL is missing')
    } catch {
      onError?.('Không thể tải minh chứng. Vui lòng thử lại.')
    }
  }

  if (evidences.length === 0) {
    return <div className="th-table-state">Hồ sơ chưa có minh chứng.</div>
  }

  return (
    <div className="th-evidence-grid">
      {evidences.map(evidence => {
        const isImage = IMAGE_TYPES.has(evidence?.mimeType?.toLowerCase())
        const preview = previews[evidence.id]
        const moderation = evidence.moderationStatus || 'PENDING'
        return (
          <article key={evidence.id} className={`th-evidence-item${isImage ? ' th-evidence-item--with-preview' : ''}`}>
            <div className="th-evidence-preview">
              {isImage && preview?.status === 'ready' ? (
                <img
                  className="th-evidence-preview__image"
                  src={preview.url}
                  alt={`Minh chứng ${evidence.originalFilename}`}
                  loading="lazy"
                  onError={() => setPreviews(previous => ({ ...previous, [evidence.id]: { status: 'error' } }))}
                />
              ) : isImage && preview?.status === 'error' ? (
                <div className="th-evidence-preview__state" role="alert">
                  <span>Không thể hiển thị ảnh.</span>
                  <button type="button" className="th-evidence-preview__retry" onClick={() => loadPreview(evidence.id)}>Thử lại</button>
                </div>
              ) : isImage ? (
                <div className="th-evidence-preview__state" role="status">Đang tải ảnh...</div>
              ) : (
                <div className="th-evidence-preview__state th-evidence-preview__state--pdf"><FilePdfOutlined /> PDF</div>
              )}
            </div>
            <div className="th-evidence-item__info">
              <PaperClipOutlined className="th-evidence-item__icon" />
              <span className="th-evidence-item__name" title={evidence.originalFilename}>{evidence.originalFilename}</span>
              <span className="th-evidence-item__size">{formatEvidenceStorageSummary(evidence, formatSize)}</span>
              <span className={`th-badge th-badge--${moderation === 'PASSED' ? 'success' : moderation === 'FAILED' || moderation === 'ERROR' ? 'danger' : 'warning'} th-badge--sm`}>
                {moderationLabels[moderation] || moderation}
              </span>
              <button type="button" className="th-detail-btn th-evidence-item__download" onClick={() => download(evidence)}>
                <DownloadOutlined /> Tải
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
