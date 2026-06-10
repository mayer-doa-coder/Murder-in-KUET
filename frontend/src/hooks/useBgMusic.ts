import { useCallback, useEffect, useRef, useState } from 'react'

const MUTE_KEY = 'murder-kuet-muted'

export function useBgMusic() {
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === 'true')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Tracks whether we're mid-toggle so the storage listener doesn't fight us
  const selfToggling = useRef(false)

  useEffect(() => {
    const audio = new Audio('/audio/bg-mystery.mp3')
    audio.loop = true
    audio.volume = 0.35
    audioRef.current = audio

    // Set media session metadata so browser media controls show the right name
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Murder in KUET — Ambient',
        artist: 'Murder in KUET',
      })
    }

    // Attempt autoplay. If blocked, we wait for the first non-mute interaction.
    const isMuted = localStorage.getItem(MUTE_KEY) === 'true'
    if (!isMuted) {
      audio.play().catch(() => {
        // Autoplay blocked — play on next user gesture that isn't the mute button itself.
        // We use a capturing listener so it fires before React click handlers, but we
        // defer the actual play to after the current event loop tick so the mute button
        // click has time to update state first.
        const onGesture = () => {
          setTimeout(() => {
            if (audioRef.current && localStorage.getItem(MUTE_KEY) !== 'true') {
              audioRef.current.play().catch(() => {})
            }
          }, 0)
        }
        window.addEventListener('click',   onGesture, { once: true, capture: true })
        window.addEventListener('keydown', onGesture, { once: true, capture: true })
      })
    }

    return () => {
      audio.pause()
      audioRef.current = null
    }
  }, [])

  // Sync muted state when the GameBoardScreen's ♪ button triggers a StorageEvent
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === MUTE_KEY && !selfToggling.current) {
        setMuted(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Play / pause whenever muted changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (muted) {
      audio.pause()
    } else {
      audio.play().catch(() => {})
    }
  }, [muted])

  const toggleMute = useCallback(() => {
    selfToggling.current = true

    const next = localStorage.getItem(MUTE_KEY) !== 'true'
    localStorage.setItem(MUTE_KEY, String(next))

    // Control audio directly here — we are inside a click handler (user gesture scope),
    // so audio.play() is allowed by the browser without autoplay restrictions.
    const audio = audioRef.current
    if (audio) {
      if (next) {
        audio.pause()
      } else {
        audio.play().catch(() => {})
      }
    }

    setMuted(next)

    // Notify useAudio in GameBoardScreen so SFX mute also syncs
    window.dispatchEvent(new StorageEvent('storage', { key: MUTE_KEY, newValue: String(next) }))

    selfToggling.current = false
  }, [])

  return { muted, toggleMute }
}
