import { useEffect, useMemo, useState } from 'react'
import useVoiceRecorder from '../hooks/useVoiceRecorder'
import Icon from './Icons'
import { ErrorNotice } from './StatusPill'

function formatDuration(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function VoiceComposer({ disabled = false, onSend }) {
  const recorder = useVoiceRecorder()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const previewUrl = useMemo(
    () => (recorder.blob ? URL.createObjectURL(recorder.blob) : ''),
    [recorder.blob],
  )

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function testSpeaker() {
    if (!window.AudioContext) {
      setError('Speaker testing is not supported in this browser.')
      return
    }
    let context
    try {
      context = new AudioContext()
      await context.resume()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = 660
      gain.gain.setValueAtTime(0.12, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.onended = () => void context.close()
      oscillator.start()
      oscillator.stop(context.currentTime + 0.5)
    } catch {
      if (context && context.state !== 'closed') await context.close()
      setError('Speaker test could not play. Check the browser and device volume.')
    }
  }

  async function send() {
    if (!recorder.blob || sending || recorder.hasAudio === false) return
    setError('')
    setSending(true)
    try {
      await onSend(recorder.blob, recorder.duration)
      recorder.discard()
    } catch (reason) {
      setError(reason.message || 'Voice note could not be sent. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      {recorder.error ? <ErrorNotice>{recorder.error}</ErrorNotice> : null}
      {error ? <ErrorNotice>{error}</ErrorNotice> : null}

      {recorder.recording ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border border-[#b43e3540] bg-[var(--alarm-tint)] px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--alarm)] opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--alarm)]" />
              </span>
              <span className="text-[12px] font-semibold tabular-nums text-[#8e2d27]">
                Recording · {formatDuration(recorder.elapsed)}
              </span>
            </div>
            <button
              type="button"
              onClick={recorder.stop}
              className="btn-ink min-h-11"
            >
              <Icon name="pause" className="h-4 w-4" />
              Stop recording
            </button>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[var(--paper-muted)]" role="status" aria-live="polite">
            <div
              className="h-2 w-24 overflow-hidden rounded-full bg-[var(--paper-line)]"
              role="meter"
              aria-label="Microphone input level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round(recorder.inputLevel * 1000))}
            >
              <div
                className="h-full bg-[var(--route)] transition-[width] duration-150"
                style={{ width: `${Math.min(100, Math.round(recorder.inputLevel * 1000))}%` }}
              />
            </div>
            <span>
              {recorder.inputLevel < 0.004
                ? 'No microphone sound detected yet. Check the selected microphone.'
                : 'Microphone audio detected.'}
            </span>
          </div>
        </>
      ) : recorder.blob ? (
        <div className="space-y-3 border border-[var(--paper-line)] bg-[var(--paper-band)] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="paper-label text-[var(--ink)]">Voice note preview</p>
            <span className="text-[11px] tabular-nums text-[var(--paper-muted)]">{formatDuration(recorder.duration)}</span>
          </div>
          <audio className="w-full" controls src={previewUrl} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={recorder.discard}
              disabled={sending}
              className="min-h-11 border border-[var(--paper-line)] px-3 py-2 text-[11px] font-semibold text-[var(--ink)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete & re-record
            </button>
            <button
              type="button"
              onClick={send}
              disabled={disabled || sending || recorder.hasAudio === false}
              className="btn-ink min-h-11"
            >
              <Icon name="send" className="h-4 w-4" />
              {sending ? 'Sending…' : 'Send voice note'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={recorder.start}
          disabled={disabled || !recorder.supported}
          className="btn-ink min-h-14 w-full sm:w-auto sm:min-w-56"
        >
          <Icon name="mic" className="h-5 w-5" />
          Record voice note
        </button>
      )}
      {!recorder.supported && !recorder.error ? (
        <p className="text-[11px] text-[var(--paper-muted)]">This browser cannot record audio. Use the text update below.</p>
      ) : (
        <p className="text-[11px] text-[var(--paper-muted)]">Your browser will ask permission before recording starts.</p>
      )}
      <button
        type="button"
        onClick={testSpeaker}
        className="min-h-10 text-left text-[11px] font-semibold text-[var(--route)] underline underline-offset-2"
      >
        Play test sound
      </button>
    </div>
  )
}
