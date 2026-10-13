import { useEffect, useRef } from 'react'

export default function CyberShield3D() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    let frame = 0
    let pointer = { x: 0, y: 0 }
    let animationId

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect()
      canvas.width = rect.width * devicePixelRatio
      canvas.height = rect.height * devicePixelRatio
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    }

    const move = (event) => {
      const rect = canvas.getBoundingClientRect()
      pointer = {
        x: (event.clientX - rect.left - rect.width / 2) / rect.width,
        y: (event.clientY - rect.top - rect.height / 2) / rect.height,
      }
    }

    const draw = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const cx = width / 2 + pointer.x * 18
      const cy = height / 2 + pointer.y * 14
      frame += 0.012

      context.clearRect(0, 0, width, height)
      const gradient = context.createRadialGradient(cx, cy, 20, cx, cy, width * 0.58)
      gradient.addColorStop(0, 'rgba(34, 211, 238, 0.22)')
      gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.08)')
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)

      for (let ring = 0; ring < 3; ring += 1) {
        context.save()
        context.translate(cx, cy)
        context.rotate(frame * (ring + 1) * 0.7)
        context.scale(1, 0.35 + ring * 0.16)
        context.strokeStyle = `rgba(${ring ? 16 : 34}, ${ring ? 185 : 211}, ${ring ? 129 : 238}, ${0.46 - ring * 0.1})`
        context.lineWidth = 2
        context.setLineDash([14, 9])
        context.beginPath()
        context.ellipse(0, 0, 120 + ring * 28, 120 + ring * 28, 0, 0, Math.PI * 2)
        context.stroke()
        context.restore()
      }

      for (let i = 0; i < 34; i += 1) {
        const angle = frame * (0.8 + (i % 5) / 10) + i * 0.74
        const radius = 95 + (i % 7) * 17
        const x = cx + Math.cos(angle) * radius + pointer.x * (i % 4) * 8
        const y = cy + Math.sin(angle) * radius * 0.58 + Math.sin(frame * 3 + i) * 18
        context.fillStyle = i % 3 === 0 ? 'rgba(34, 211, 238, 0.8)' : 'rgba(16, 185, 129, 0.55)'
        context.fillRect(x, y, i % 3 === 0 ? 4 : 7, i % 3 === 0 ? 16 : 7)
      }

      context.save()
      context.translate(cx, cy)
      context.shadowColor = '#22d3ee'
      context.shadowBlur = 24
      context.fillStyle = 'rgba(4, 78, 59, 0.74)'
      context.strokeStyle = '#5eead4'
      context.lineWidth = 4
      context.beginPath()
      context.moveTo(0, -130)
      context.lineTo(94, -90)
      context.lineTo(76, 46)
      context.quadraticCurveTo(52, 104, 0, 136)
      context.quadraticCurveTo(-52, 104, -76, 46)
      context.lineTo(-94, -90)
      context.closePath()
      context.fill()
      context.stroke()

      context.strokeStyle = 'rgba(255, 255, 255, 0.22)'
      context.lineWidth = 1
      for (let line = -55; line <= 55; line += 22) {
        context.beginPath()
        context.moveTo(line, -84)
        context.lineTo(line * 0.45, 82)
        context.stroke()
      }

      context.fillStyle = '#061b18'
      context.strokeStyle = '#22d3ee'
      context.lineWidth = 5
      context.beginPath()
      context.roundRect(-45, -10, 90, 76, 12)
      context.fill()
      context.stroke()
      context.beginPath()
      context.arc(0, -12, 34, Math.PI, Math.PI * 2)
      context.stroke()
      context.fillStyle = '#5eead4'
      context.beginPath()
      context.arc(0, 26, 8, 0, Math.PI * 2)
      context.fill()
      context.fillRect(-4, 30, 8, 24)
      context.restore()

      animationId = requestAnimationFrame(draw)
    }

    resize()
    addEventListener('resize', resize)
    canvas.addEventListener('pointermove', move)
    draw()

    return () => {
      cancelAnimationFrame(animationId)
      removeEventListener('resize', resize)
      canvas.removeEventListener('pointermove', move)
    }
  }, [])

  return <canvas className="shield-canvas" ref={canvasRef} aria-label="Interactive cyber shield visualization" />
}
