export const FIT_VIEW = { zoom: 1, x: 0, y: 0 }

export function fitImage(image, frame) {
  if (!image.width || !image.height || !frame.width || !frame.height) return { width: 0, height: 0 }
  const scale = Math.min(1, frame.width / image.width, frame.height / image.height)
  return { width: image.width * scale, height: image.height * scale }
}

export function constrainView(view, image, frame) {
  const zoom = Math.min(5, Math.max(1, view.zoom))
  const limitX = Math.max(0, (image.width * zoom - frame.width) / 2)
  const limitY = Math.max(0, (image.height * zoom - frame.height) / 2)
  return {
    zoom,
    x: limitX > 0 ? Math.min(limitX, Math.max(-limitX, view.x)) : 0,
    y: limitY > 0 ? Math.min(limitY, Math.max(-limitY, view.y)) : 0,
  }
}

// Anchors are measured from the viewport centre, so wheel and pinch share the same geometry.
export function zoomImage(view, zoom, image, frame, from = { x: 0, y: 0 }, to = from) {
  const nextZoom = Math.min(5, Math.max(1, zoom))
  const ratio = nextZoom / view.zoom
  return constrainView({
    zoom: nextZoom,
    x: to.x - (from.x - view.x) * ratio,
    y: to.y - (from.y - view.y) * ratio,
  }, image, frame)
}
