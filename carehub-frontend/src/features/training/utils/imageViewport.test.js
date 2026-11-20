import { describe, expect, it } from 'vitest'
import { constrainView, FIT_VIEW, fitImage, zoomImage } from './imageViewport.js'

const frame = { width: 800, height: 600 }
const image = { width: 800, height: 400 }

describe('image viewport geometry', () => {
  it('fits landscape and portrait images without enlarging small images', () => {
    expect(fitImage({ width: 1600, height: 800 }, frame)).toEqual(image)
    expect(fitImage({ width: 400, height: 1200 }, frame)).toEqual({ width: 200, height: 600 })
    expect(fitImage({ width: 100, height: 50 }, frame)).toEqual({ width: 100, height: 50 })
    expect(fitImage({ width: 0, height: 0 }, frame)).toEqual({ width: 0, height: 0 })
  })

  it('clamps zoom and keeps an oversized image against the viewport edges', () => {
    expect(constrainView({ zoom: 10, x: 9999, y: -9999 }, image, frame)).toEqual({ zoom: 5, x: 1600, y: -700 })
    expect(constrainView({ zoom: 0.5, x: 100, y: -100 }, image, frame)).toEqual(FIT_VIEW)
  })

  it('keeps the image point under the wheel cursor anchored', () => {
    const anchor = { x: 100, y: 50 }
    const next = zoomImage(FIT_VIEW, 2, image, frame, anchor)
    expect(next).toEqual({ zoom: 2, x: -100, y: -50 })
    expect((anchor.x - next.x) / next.zoom).toBe(anchor.x)
    expect((anchor.y - next.y) / next.zoom).toBe(anchor.y)
  })

  it('supports a moving pinch midpoint and resets the offset when zooming out', () => {
    expect(zoomImage({ zoom: 2, x: 0, y: 0 }, 4, image, frame, { x: 100, y: 0 }, { x: 120, y: 20 }))
      .toEqual({ zoom: 4, x: -80, y: 20 })
    expect(zoomImage({ zoom: 4, x: -80, y: 20 }, 1, image, frame)).toEqual(FIT_VIEW)
  })
})
