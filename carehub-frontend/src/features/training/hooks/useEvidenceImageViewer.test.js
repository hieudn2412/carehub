import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useEvidenceImageViewer from './useEvidenceImageViewer.js'
import { trainingApi } from '../api/trainingApi.js'

vi.mock('../api/trainingApi.js', () => ({ trainingApi: { createEvidencePreviewUrl: vi.fn() } }))

describe('useEvidenceImageViewer', () => {
  beforeEach(() => vi.resetAllMocks())

  it('reuses a cached or local URL without requesting or uploading a file', () => {
    const { result } = renderHook(() => useEvidenceImageViewer(19))
    act(() => result.current.openImage({ id: 1, filename: 'Ảnh.jpg', src: 'https://files.example.com/image.jpg' }))
    expect(result.current.viewer.src).toBe('https://files.example.com/image.jpg')
    act(() => result.current.openImage({ filename: 'Ảnh.png', src: 'blob:local-image' }))
    expect(result.current.viewer.src).toBe('blob:local-image')
    expect(trainingApi.createEvidencePreviewUrl).not.toHaveBeenCalled()
  })

  it('requests a fresh URL for an existing image and on retry', async () => {
    trainingApi.createEvidencePreviewUrl.mockResolvedValue({ data: { data: { downloadUrl: '/preview/1' } } })
    const { result } = renderHook(() => useEvidenceImageViewer(19))
    act(() => result.current.openImage({ id: 1, filename: 'Ảnh.jpg' }))
    expect(result.current.viewer.loading).toBe(true)
    await waitFor(() => expect(result.current.viewer.src).toMatch(/^https?:\/\/[^/]+\/preview\/1$/))
    expect(trainingApi.createEvidencePreviewUrl).toHaveBeenCalledWith(19, 1)
    trainingApi.createEvidencePreviewUrl.mockResolvedValue({ data: { data: { downloadUrl: 'https://files.example.com/fresh.jpg' } } })
    act(() => result.current.retryImage())
    await waitFor(() => expect(result.current.viewer.src).toBe('https://files.example.com/fresh.jpg'))
  })

  it.each([null, 'rejected'])('shows a recoverable error for an invalid response: %s', async (failure) => {
    if (failure) trainingApi.createEvidencePreviewUrl.mockRejectedValue(new Error('Unavailable'))
    else trainingApi.createEvidencePreviewUrl.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => useEvidenceImageViewer(19))
    act(() => result.current.openImage({ id: 1, filename: 'Ảnh.jpg' }))
    await waitFor(() => expect(result.current.viewer.error).toBe(true))
    expect(result.current.viewer.loading).toBe(false)
  })

  it('ignores a late response after closing or selecting a different image', async () => {
    let resolve
    trainingApi.createEvidencePreviewUrl.mockImplementation(() => new Promise(done => { resolve = done }))
    const { result } = renderHook(() => useEvidenceImageViewer(19))
    act(() => result.current.openImage({ id: 1, filename: 'Cũ.jpg' }))
    act(() => result.current.closeImage())
    await act(async () => resolve({ data: { data: { downloadUrl: 'https://files.example.com/old.jpg' } } }))
    expect(result.current.viewer).toBeNull()
    act(() => result.current.openImage({ id: 1, filename: 'Cũ.jpg' }))
    act(() => result.current.openImage({ filename: 'Mới.png', src: 'blob:new' }))
    await act(async () => resolve({ data: { data: { downloadUrl: 'https://files.example.com/old.jpg' } } }))
    expect(result.current.viewer.filename).toBe('Mới.png')
  })

  it('invalidates a pending request when the record changes or unmounts', async () => {
    let resolve
    trainingApi.createEvidencePreviewUrl.mockImplementation(() => new Promise(done => { resolve = done }))
    const { result, rerender, unmount } = renderHook(({ recordId }) => useEvidenceImageViewer(recordId), { initialProps: { recordId: 19 } })
    act(() => result.current.openImage({ id: 1, filename: 'Ảnh.jpg' }))
    rerender({ recordId: 20 })
    await act(async () => resolve({ data: { data: { downloadUrl: 'https://files.example.com/old.jpg' } } }))
    expect(result.current.viewer).toBeNull()
    act(() => result.current.openImage({ id: 2, filename: 'Ảnh khác.jpg' }))
    unmount()
    await act(async () => resolve({ data: { data: { downloadUrl: 'https://files.example.com/late.jpg' } } }))
  })
})
