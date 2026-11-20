import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EvidenceGallery from './EvidenceGallery.jsx'
import { trainingApi } from '../api/trainingApi.js'

vi.mock('../api/trainingApi.js', () => ({ trainingApi: { createEvidencePreviewUrl: vi.fn(), createEvidenceDownloadUrl: vi.fn() } }))
vi.mock('./EvidenceImageViewer.jsx', () => ({
  default: ({ src, filename, onClose, onRetry }) => (
    <section role="dialog" aria-label={filename}>
      <span>{src}</span>
      <button type="button" onClick={onClose}>Đóng ảnh</button>
      <button type="button" onClick={onRetry}>Thử lại ảnh</button>
    </section>
  ),
}))

const evidences = [
  { id: 1, mimeType: 'image/jpeg', originalFilename: 'chứng-chỉ.jpg', fileSizeBytes: 1024 },
  { id: 2, mimeType: 'application/pdf', originalFilename: 'chứng-chỉ.pdf', fileSizeBytes: 2048 },
]

describe('EvidenceGallery image integration', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    trainingApi.createEvidencePreviewUrl.mockResolvedValue({ data: { data: { downloadUrl: 'https://files.example.com/image.jpg' } } })
  })

  it('opens the image from a keyboard-accessible thumbnail using the cached URL', async () => {
    render(<EvidenceGallery recordId={19} evidences={evidences} />)
    const trigger = await screen.findByRole('button', { name: 'Xem ảnh minh chứng chứng-chỉ.jpg' })
    expect(trigger).toHaveAttribute('type', 'button')
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'chứng-chỉ.jpg' })).toHaveTextContent('https://files.example.com/image.jpg')
    expect(trainingApi.createEvidencePreviewUrl).toHaveBeenCalledTimes(1)
    expect(trainingApi.createEvidenceDownloadUrl).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Xem ảnh minh chứng chứng-chỉ.pdf' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng ảnh' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('refreshes an expired image URL and preserves download behavior for PDF', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    trainingApi.createEvidenceDownloadUrl.mockResolvedValue({ data: { data: { downloadUrl: 'https://files.example.com/file.pdf' } } })
    render(<EvidenceGallery recordId={19} evidences={evidences} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Xem ảnh minh chứng chứng-chỉ.jpg' }))
    trainingApi.createEvidencePreviewUrl.mockResolvedValue({ data: { data: { downloadUrl: 'https://files.example.com/fresh.jpg' } } })
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại ảnh' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('https://files.example.com/fresh.jpg'))
    fireEvent.click(screen.getByRole('button', { name: 'Đóng ảnh' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Tải$/ })[1])
    await waitFor(() => expect(trainingApi.createEvidenceDownloadUrl).toHaveBeenCalledWith(19, 2))
    expect(open).toHaveBeenCalledWith('https://files.example.com/file.pdf', '_blank', 'noopener,noreferrer')
    open.mockRestore()
  })
})
