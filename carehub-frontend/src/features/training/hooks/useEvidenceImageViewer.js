import { useEffect, useRef, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { resolveEvidenceUrl } from '../utils/evidenceUrl.js'

export default function useEvidenceImageViewer(recordId) {
  const [viewer, setViewer] = useState(null)
  const requestRef = useRef(0)

  useEffect(() => {
    setViewer(null)
    return () => { requestRef.current += 1 }
  }, [recordId])

  const requestImage = async (image) => {
    const request = ++requestRef.current
    setViewer({ ...image, src: '', loading: true, error: false })
    try {
      const response = await trainingApi.createEvidencePreviewUrl(recordId, image.id)
      const src = resolveEvidenceUrl(response.data?.data?.downloadUrl)
      if (!src) throw new Error('Preview URL is missing')
      if (request === requestRef.current) setViewer({ ...image, src, loading: false, error: false })
    } catch {
      if (request === requestRef.current) setViewer({ ...image, src: '', loading: false, error: true })
    }
  }

  const openImage = (image) => {
    requestRef.current += 1
    if (image.src) {
      setViewer({ ...image, src: resolveEvidenceUrl(image.src), loading: false, error: false })
    } else {
      requestImage(image)
    }
  }

  const closeImage = () => {
    requestRef.current += 1
    setViewer(null)
  }

  const retryImage = () => {
    if (viewer?.id != null) requestImage(viewer)
  }

  return { viewer, openImage, closeImage, retryImage }
}
