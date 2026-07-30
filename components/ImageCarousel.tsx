'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, ImageOff, Camera, Trash2 } from 'lucide-react'

interface Props {
  images: string[]
  alt?: string
  height?: number
  editable?: boolean
  onAdd?: (file: File) => void
  onDelete?: (index: number) => void
}

export default function ImageCarousel({ images, alt = '', height = 160, editable = false, onAdd, onDelete }: Props) {
  const [current, setCurrent] = useState(0)

  // Clamp current ke range yang valid setiap render
  const safeIdx = images.length > 0 ? Math.min(current, images.length - 1) : 0

  function prev(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    setCurrent(i => (i - 1 + images.length) % images.length)
  }
  function next(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    setCurrent(i => (i + 1) % images.length)
  }
  function goTo(e: React.MouseEvent, i: number) {
    e.stopPropagation()
    e.preventDefault()
    setCurrent(i)
  }
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (!onDelete) return
    const newLen = images.length - 1
    onDelete(safeIdx)
    // Geser ke foto sebelumnya kalau hapus foto terakhir
    setCurrent(c => Math.min(c, Math.max(0, newLen - 1)))
  }
  function handleAdd(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    const file = e.target.files?.[0]
    if (file && onAdd) onAdd(file)
    e.target.value = ''
  }

  if (images.length === 0) {
    return (
      <div style={{ height, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#94a3b8', position: 'relative', overflow: 'hidden' }}>
        <ImageOff size={28} />
        <span style={{ fontSize: '0.75rem' }}>Belum ada foto</span>
        {editable && onAdd && (
          <label
            style={{ position: 'absolute', inset: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: 'rgba(37,99,235,0.12)', border: '2px dashed #93c5fd', borderRadius: '0.625rem', padding: '0.625rem 1.25rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 500 }}>
              <Camera size={15} /> Upload foto
            </div>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAdd} />
          </label>
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height, overflow: 'hidden', background: '#111', userSelect: 'none' }}>
      <img
        src={images[safeIdx]}
        alt={`${alt} ${safeIdx + 1}`}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        draggable={false}
      />

      {/* Prev/Next — hanya kalau lebih dari 1 */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: '1.875rem', height: '1.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', zIndex: 10 }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={next}
            style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: '1.875rem', height: '1.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', zIndex: 10 }}
          >
            <ChevronRight size={16} />
          </button>

          {/* Dots */}
          <div style={{ position: 'absolute', bottom: '0.5rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '0.3rem', zIndex: 10 }}>
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={e => goTo(e, i)}
                style={{ width: i === safeIdx ? '1.25rem' : '0.4375rem', height: '0.4375rem', borderRadius: '999px', background: i === safeIdx ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }}
              />
            ))}
          </div>

          {/* Counter */}
          <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: '999px', padding: '0.125rem 0.5rem', fontSize: '0.7rem', zIndex: 10 }}>
            {safeIdx + 1}/{images.length}
          </div>
        </>
      )}

      {/* Edit controls */}
      {editable && (
        <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', display: 'flex', gap: '0.375rem', zIndex: 10 }}>
          {onAdd && (
            <label
              style={{ background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '0.375rem', padding: '0.25rem 0.625rem', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}
              onClick={e => e.stopPropagation()}
            >
              <Camera size={13} /> Tambah
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAdd} />
            </label>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              style={{ background: 'rgba(220,38,38,0.8)', color: 'white', border: 'none', borderRadius: '0.375rem', padding: '0.25rem 0.625rem', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}
            >
              <Trash2 size={13} /> Hapus foto ini
            </button>
          )}
        </div>
      )}
    </div>
  )
}