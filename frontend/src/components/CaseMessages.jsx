import { useCallback, useEffect, useRef, useState } from 'react'
import { api, authenticatedAudio } from '../api'
import useRealtime from '../hooks/useRealtime'
import Icon from './Icons'
import VoiceComposer from './VoiceComposer'
import { ErrorNotice, StatusPill } from './StatusPill'

function formatTimestamp(value) {
  if (!value) return 'Time unavailable'
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? 'Time unavailable'
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function AudioMessage({ caseId, message }) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let objectUrl = ''
    authenticatedAudio(`/api/cases/${caseId}/messages/${message.id}/audio`)
      .then((url) => {
        objectUrl = url
        if (active) setSrc(url)
        else URL.revokeObjectURL(url)
      })
      .catch((reason) => {
        if (active) setError(reason.message)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [caseId, message.id])

  if (error) return <p className="mt-2 text-[11px] text-[var(--alarm)]">Audio unavailable: {error}</p>
  if (!src) return <p className="mt-2 text-[11px] text-[var(--paper-muted)]">Loading secure audio…</p>
  return <audio className="mt-2 w-full" controls preload="none" src={src} />
}

function MessageItem({ caseId, message, own }) {
  const assistant = message.sender_role === 'assistant'
  return (
    <article className={`msg max-w-3xl ${assistant ? 'msg-assistant' : own ? 'msg-own' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-[13px] font-semibold text-[var(--ink)]">{message.sender_name}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--paper-muted)]">
            {message.sender_role?.replaceAll('_', ' ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <time className="text-[10px] text-[var(--paper-muted)]">{formatTimestamp(message.created_at)}</time>
          <StatusPill status={message.ack_status} />
        </div>
      </div>
      {message.kind === 'voice' ? (
        <div className="mt-2.5 border border-[var(--paper-line)] bg-white p-2.5">
          <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--ink)]">
            <Icon name="mic" className="h-4 w-4 text-[var(--alarm)]" />
            Voice note · {message.duration_seconds ?? '—'} sec
          </div>
          <AudioMessage caseId={caseId} message={message} />
        </div>
      ) : (
        <p className="mt-2.5 whitespace-pre-wrap break-words text-[13px] leading-6 text-[var(--ink)]">{message.text}</p>
      )}
    </article>
  )
}

export default function CaseMessages({
  caseId,
  user,
  canReply = false,
  replyLabel = 'Send update',
  quickConcerns = [],
}) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [selectedConcerns, setSelectedConcerns] = useState([])
  const [loadedCaseId, setLoadedCaseId] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottom = useRef(null)

  const loadMessages = useCallback(async () => {
    try {
      const result = await api(`/api/cases/${caseId}/messages`)
      setMessages(result)
      setLoadedCaseId(caseId)
      setError('')
    } catch (reason) {
      setLoadedCaseId(caseId)
      setError(reason.message || 'Messages could not be loaded.')
    }
  }, [caseId])

  const handleRealtime = useCallback(
    (event, payload) => {
      if (String(payload?.case?.id) === String(caseId)) loadMessages()
    },
    [caseId, loadMessages],
  )
  useRealtime(handleRealtime)

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    bottom.current?.scrollIntoView({ behavior, block: 'end' })
  }, [messages])

  async function submitText(event) {
    event.preventDefault()
    if (!text.trim() || sending || !canReply) return
    setSending(true)
    setError('')
    try {
      await api(`/api/cases/${caseId}/messages`, {
        method: 'POST',
        body: { text },
      })
      setText('')
      setSelectedConcerns([])
      await loadMessages()
    } catch (reason) {
      setError(reason.message || 'Update could not be sent. Try again.')
    } finally {
      setSending(false)
    }
  }

  async function sendVoice(blob, duration) {
    const form = new FormData()
    const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : 'webm'
    form.append('file', blob, `voice-note.${extension}`)
    form.append('duration_seconds', String(duration))
    await api(`/api/cases/${caseId}/messages/voice`, { method: 'POST', form })
    await loadMessages()
  }

  const loading = String(loadedCaseId) !== String(caseId)

  return (
    <section className="strip overflow-hidden">
      <header className="strip-head">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">Emergency communications</h2>
          <p className="mt-1 text-[11px] leading-4 text-[var(--paper-muted)]">
            Private to this ambulance, case, and assigned hospital.
          </p>
        </div>
        <span className="pill pill-mute shrink-0 tabular-nums">Case #{caseId}</span>
      </header>

      <div
        className="max-h-[28rem] space-y-3 overflow-y-auto border border-[var(--paper-line)] bg-[#f3f8f6] p-3"
        aria-live="polite"
      >
        {loading ? (
          <div className="space-y-3" aria-label="Loading messages">
            <div className="skeleton h-20 w-full" />
            <div className="skeleton ml-auto h-16 max-w-xl" />
          </div>
        ) : messages.length ? (
          messages.map((message) => (
            <MessageItem
              key={message.id}
              caseId={caseId}
              message={message}
              own={message.sender_id === user.id}
            />
          ))
        ) : (
          <div className="border border-dashed border-[var(--perf)] bg-white px-4 py-7 text-center">
            <p className="text-[13px] font-semibold text-[var(--ink)]">No updates sent yet</p>
            <p className="mt-1 text-[12px] text-[var(--paper-muted)]">
              Record a voice note or write a brief handoff update.
            </p>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="space-y-4 border-t border-dashed border-[var(--perf)] p-4">
        {error ? <ErrorNotice onDismiss={() => setError('')}>{error}</ErrorNotice> : null}
        {canReply ? (
          <>
            {quickConcerns.length ? (
              <fieldset className="quick-concerns">
                <legend>What should the hospital know? <span className="font-normal text-[var(--paper-muted)]">Select all that apply.</span></legend>
                <div className="concern-options">
                  {quickConcerns.map((concern) => (
                    <button
                      key={concern}
                      type="button"
                      aria-pressed={selectedConcerns.includes(concern)}
                      onClick={() => {
                        const nextConcerns = selectedConcerns.includes(concern)
                          ? selectedConcerns.filter((selected) => selected !== concern)
                          : [...selectedConcerns, concern]
                        setSelectedConcerns(nextConcerns)
                        setText(
                          nextConcerns.length
                            ? `Crew-reported concerns: ${nextConcerns.join('; ')}.`
                            : '',
                        )
                      }}
                      className="concern-option"
                    >
                      {concern}
                    </button>
                  ))}
                </div>
                <p className="quick-concerns-help">
                  Selected concerns are added to an editable message draft. They do not diagnose or change the emergency category.
                </p>
              </fieldset>
            ) : null}
            <VoiceComposer disabled={sending} onSend={sendVoice} />
            <form onSubmit={submitText} className="space-y-2">
              <label htmlFor={`message-${caseId}`} className="paper-label block">
                Text update
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <textarea
                  id={`message-${caseId}`}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Share a concise update with the care team…"
                  className="field min-h-12 flex-1 resize-y py-2.5"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="btn-ink min-h-12 justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 sm:self-end"
                >
                  <Icon name="send" className="h-4 w-4" />
                  {sending ? 'Sending…' : replyLabel}
                </button>
              </div>
              <p className="text-[11px] leading-4 text-[var(--paper-muted)]">
                Text is limited to 2,000 characters. Patient details are shared only with authorized case staff.
              </p>
            </form>
          </>
        ) : (
          <p className="border border-dashed border-[var(--perf)] bg-[var(--paper-band)] px-3 py-2 text-[12px] text-[var(--paper-muted)]">
            This case is read-only for your role.
          </p>
        )}
      </div>
    </section>
  )
}
