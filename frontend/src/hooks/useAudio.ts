import { useCallback, useEffect, useRef, useState } from 'react'

const MUTE_KEY = 'murder-kuet-muted'

function getCtx(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)()
  } catch {
    return null
  }
}

function ramp(param: AudioParam, from: number, to: number, start: number, end: number) {
  param.setValueAtTime(from, start)
  param.linearRampToValueAtTime(to, end)
}

export function useAudio() {
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === 'true')
  const ctxRef = useRef<AudioContext | null>(null)

  const ctx = useCallback((): AudioContext | null => {
    if (!ctxRef.current) ctxRef.current = getCtx()
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      localStorage.setItem(MUTE_KEY, String(next))
      return next
    })
  }, [])

  // Dice roll: rapid noise bursts simulating rattling dice
  const playDiceRoll = useCallback(() => {
    if (muted) return
    const ac = ctx(); if (!ac) return
    const duration = 0.55
    const bufSize = ac.sampleRate * duration
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      // Gated noise: 8 bursts simulating dice clicks
      const t = i / ac.sampleRate
      const burst = Math.sin(t * 50) > 0.6 ? 1 : 0
      data[i] = (Math.random() * 2 - 1) * burst * Math.max(0, 1 - t / duration)
    }
    const src = ac.createBufferSource()
    src.buffer = buf
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.18, ac.currentTime)
    const filter = ac.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1800
    filter.Q.value = 0.8
    src.connect(filter).connect(gain).connect(ac.destination)
    src.start()
  }, [muted, ctx])

  // Movement step: soft wooden tap
  const playStep = useCallback(() => {
    if (muted) return
    const ac = ctx(); if (!ac) return
    const now = ac.currentTime
    const osc = ac.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.08)
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0, now)
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    osc.connect(gain).connect(ac.destination)
    osc.start(now)
    osc.stop(now + 0.12)
  }, [muted, ctx])

  // Interrogation: tense low drone with a stab
  const playInterrogation = useCallback(() => {
    if (muted) return
    const ac = ctx(); if (!ac) return
    const now = ac.currentTime

    // Low ominous drone
    const drone = ac.createOscillator()
    drone.type = 'sawtooth'
    drone.frequency.value = 80
    const droneGain = ac.createGain()
    droneGain.gain.setValueAtTime(0, now)
    droneGain.gain.linearRampToValueAtTime(0.06, now + 0.1)
    droneGain.gain.linearRampToValueAtTime(0.06, now + 0.5)
    droneGain.gain.linearRampToValueAtTime(0, now + 0.7)
    drone.connect(droneGain).connect(ac.destination)
    drone.start(now); drone.stop(now + 0.75)

    // Sharp accent stab
    const stab = ac.createOscillator()
    stab.type = 'square'
    stab.frequency.setValueAtTime(440, now)
    stab.frequency.exponentialRampToValueAtTime(220, now + 0.15)
    const stabGain = ac.createGain()
    stabGain.gain.setValueAtTime(0.09, now)
    stabGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    stab.connect(stabGain).connect(ac.destination)
    stab.start(now); stab.stop(now + 0.2)
  }, [muted, ctx])

  // Reveal: ascending chime arpeggio
  const playReveal = useCallback(() => {
    if (muted) return
    const ac = ctx(); if (!ac) return
    const now = ac.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const t = now + i * 0.1
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const gain = ac.createGain()
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.13, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
      osc.connect(gain).connect(ac.destination)
      osc.start(t); osc.stop(t + 0.5)
    })
  }, [muted, ctx])

  // Accusation: dramatic tension — falling then rising pulse
  const playAccusation = useCallback(() => {
    if (muted) return
    const ac = ctx(); if (!ac) return
    const now = ac.currentTime

    // Tremolo bass hit
    const bass = ac.createOscillator()
    bass.type = 'sawtooth'
    bass.frequency.setValueAtTime(110, now)
    bass.frequency.exponentialRampToValueAtTime(55, now + 0.4)
    const bassGain = ac.createGain()
    ramp(bassGain.gain, 0.14, 0, now, now + 0.45)
    bass.connect(bassGain).connect(ac.destination)
    bass.start(now); bass.stop(now + 0.5)

    // Two rising tones
    ;[0, 0.2].forEach((offset, i) => {
      const t = now + offset
      const osc = ac.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(220 + i * 110, t)
      osc.frequency.linearRampToValueAtTime(440 + i * 110, t + 0.25)
      const g = ac.createGain()
      g.gain.setValueAtTime(0.07, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      osc.connect(g).connect(ac.destination)
      osc.start(t); osc.stop(t + 0.35)
    })
  }, [muted, ctx])

  useEffect(() => {
    return () => { ctxRef.current?.close() }
  }, [])

  return { muted, toggleMute, playDiceRoll, playStep, playInterrogation, playReveal, playAccusation }
}
