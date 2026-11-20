import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons'
import { constrainView, FIT_VIEW, fitImage, zoomImage } from '../utils/imageViewport.js'
import '../styles/EvidenceImageViewer.css'

function ImageContent({ src, filename, loading, error, onRetry }) {
  const stageRef = useRef(null)
  const pointersRef = useRef(new Map())
  const [frame, setFrame] = useState({ width: 0, height: 0 })
  const [image, setImage] = useState({ width: 0, height: 0 })
  const [view, setView] = useState(FIT_VIEW)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const fitted = useMemo(() => fitImage(image, frame), [image, frame])
  const ready = Boolean(src && !loading && !error && !failed && fitted.width)

  useEffect(() => {
    const stage = stageRef.current
    const measure = () => {
      const { width, height } = stage.getBoundingClientRect()
      setFrame({ width, height })
      setView(FIT_VIEW)
      pointersRef.current.clear()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    const onWheel = (event) => {
      if (!ready) return
      event.preventDefault()
      const bounds = stage.getBoundingClientRect()
      const anchor = { x: event.clientX - bounds.left - frame.width / 2, y: event.clientY - bounds.top - frame.height / 2 }
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? frame.height : 1)
      setView(current => zoomImage(current, current.zoom * Math.exp(-delta * 0.002), fitted, frame, anchor))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [ready, frame, fitted])

  const zoom = (delta) => setView(current => zoomImage(current, current.zoom + delta, fitted, frame))
  const reset = () => {
    pointersRef.current.clear()
    setView(FIT_VIEW)
  }
  const point = (event) => {
    const bounds = stageRef.current.getBoundingClientRect()
    return { x: event.clientX - bounds.left - frame.width / 2, y: event.clientY - bounds.top - frame.height / 2 }
  }
  const startPointer = (event) => {
    if (!ready || event.button !== 0 || pointersRef.current.size >= 2) return
    event.preventDefault()
    pointersRef.current.set(event.pointerId, point(event))
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const movePointer = (event) => {
    const pointers = pointersRef.current
    if (!pointers.has(event.pointerId)) return
    const previous = [...pointers.values()]
    pointers.set(event.pointerId, point(event))
    const next = [...pointers.values()]
    if (next.length === 2) {
      const midpoint = (points) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 })
      const distance = (points) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      const oldDistance = distance(previous)
      if (oldDistance > 0) {
        setView(current => zoomImage(current, current.zoom * distance(next) / oldDistance, fitted, frame, midpoint(previous), midpoint(next)))
      }
    } else {
      setView(current => constrainView({ ...current, x: current.x + next[0].x - previous[0].x, y: current.y + next[0].y - previous[0].y }, fitted, frame))
    }
  }
  const endPointer = (event) => {
    pointersRef.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <>
      <div className="evidence-image-viewer__toolbar" role="group" aria-label="Điều khiển ảnh">
        <button type="button" onClick={() => zoom(-0.25)} disabled={!ready || view.zoom <= 1} aria-label="Thu nhỏ"><ZoomOutOutlined aria-hidden="true" /></button>
        <output aria-label="Mức phóng to">{Math.round(view.zoom * 100)}%</output>
        <button type="button" onClick={() => zoom(0.25)} disabled={!ready || view.zoom >= 5} aria-label="Phóng to"><ZoomInOutlined aria-hidden="true" /></button>
        <button type="button" onClick={reset} disabled={!ready}>Vừa khung</button>
      </div>
      <div
        ref={stageRef}
        className={`evidence-image-viewer__stage${ready && view.zoom > 1 ? ' evidence-image-viewer__stage--zoomed' : ''}`}
        role="region"
        aria-label="Vùng xem ảnh minh chứng"
        aria-busy={Boolean(loading || (src && !image.width && !failed))}
        onPointerDown={startPointer}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onLostPointerCapture={(event) => pointersRef.current.delete(event.pointerId)}
      >
        {src && !loading && !error && !failed && (
          <img
            key={attempt}
            className="evidence-image-viewer__image"
            src={src}
            alt={`Ảnh minh chứng ${filename}`}
            draggable={false}
            onLoad={(event) => setImage({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => setFailed(true)}
            style={{ width: fitted.width, height: fitted.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, visibility: ready ? 'visible' : 'hidden' }}
          />
        )}
        {error || failed ? (
          <div className="evidence-image-viewer__state" role="alert">
            <p>Không thể hiển thị ảnh minh chứng.</p>
            <button type="button" onClick={() => {
              setFailed(false)
              setImage({ width: 0, height: 0 })
              reset()
              setAttempt(current => current + 1)
              onRetry?.()
            }}>Thử lại</button>
          </div>
        ) : !ready && <p className="evidence-image-viewer__state" role="status">Đang tải ảnh...</p>}
      </div>
      <p className="evidence-image-viewer__hint">Cuộn hoặc chụm hai ngón để zoom. Kéo để di chuyển ảnh đã phóng to.</p>
    </>
  )
}

export default function EvidenceImageViewer({ src = '', filename, loading = false, error = false, onRetry, onClose }) {
  const dialogRef = useRef(null)
  const outsidePointerRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    // A retry can replace the focused error button; keep keyboard focus inside the dialog.
    if (!dialog.contains(document.activeElement)) dialog.querySelector('button')?.focus()
  }, [src, loading, error])

  const outside = (event) => {
    if (event.target !== event.currentTarget) return false
    const bounds = event.currentTarget.getBoundingClientRect()
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className="evidence-image-viewer"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = event.currentTarget.querySelectorAll('button:not(:disabled)')
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => { outsidePointerRef.current = outside(event) ? event.pointerId : null }}
      onPointerUp={(event) => {
        if (outsidePointerRef.current === event.pointerId && outside(event)) onClose()
        outsidePointerRef.current = null
      }}
    >
      <header className="evidence-image-viewer__header">
        <h2 id={titleId} title={filename}>{filename || 'Ảnh minh chứng'}</h2>
        <button type="button" onClick={onClose} aria-label="Đóng ảnh minh chứng"><CloseOutlined aria-hidden="true" /></button>
      </header>
      <ImageContent key={src} src={src} filename={filename} loading={loading} error={error} onRetry={onRetry} />
    </dialog>,
    document.body,
  )
}
