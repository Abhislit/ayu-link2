import { useEffect, useRef, useState } from 'react'

const MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

export default function useVoiceRecorder() {
  const recorder = useRef(null)
  const stream = useRef(null)
  const analyser = useRef(null)
  const audioContext = useRef(null)
  const startedAt = useRef(0)
  const peakLevel = useRef(0)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [blob, setBlob] = useState(null)
  const [inputLevel, setInputLevel] = useState(0)
  const [hasAudio, setHasAudio] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!recording) return undefined
    const samples = analyser.current ? new Float32Array(analyser.current.fftSize) : null
    const timer = window.setInterval(() => {
      const currentSeconds = Math.floor((Date.now() - startedAt.current) / 1000)
      setElapsed(currentSeconds)
      if (analyser.current && samples) {
        analyser.current.getFloatTimeDomainData(samples)
        const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length)
        peakLevel.current = Math.max(peakLevel.current, rms)
        setInputLevel(rms)
      }
      if (currentSeconds >= 120 && recorder.current?.state === 'recording') {
        recorder.current.stop()
        setRecording(false)
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [recording])

  useEffect(
    () => () => {
      if (recorder.current?.state === 'recording') recorder.current.stop()
      stream.current?.getTracks().forEach((track) => track.stop())
      if (audioContext.current?.state !== 'closed') void audioContext.current?.close()
    },
    [],
  )

  async function start() {
    setError('')
    setBlob(null)
    setDuration(0)
    setElapsed(0)
    setInputLevel(0)
    setHasAudio(null)
    peakLevel.current = 0

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Voice recording is not supported in this browser. You can send a text update instead.')
      return
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = audioStream
      if (window.AudioContext) {
        let context
        try {
          context = new AudioContext()
          audioContext.current = context
          await context.resume()
          const inputAnalyser = context.createAnalyser()
          inputAnalyser.fftSize = 512
          context.createMediaStreamSource(audioStream).connect(inputAnalyser)
          analyser.current = inputAnalyser
        } catch {
          if (context && context.state !== 'closed') void context.close()
          audioContext.current = null
          analyser.current = null
          setError('Microphone input cannot be monitored in this browser. Check the recording preview before sending.')
        }
      }
      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
      const activeRecorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined)
      const chunks = []
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }
      activeRecorder.onerror = () => {
        setError('Recording stopped unexpectedly. Check microphone access and try again.')
        setRecording(false)
      }
      activeRecorder.onstop = () => {
        const mediaType = activeRecorder.mimeType || chunks[0]?.type || 'audio/webm'
        const recordingBlob = new Blob(chunks, { type: mediaType.split(';')[0] })
        const recordedSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))
        if (!recordingBlob.size) {
          setError('No audio was captured. Check microphone permissions and try again.')
        } else {
          setBlob(recordingBlob)
          setDuration(Math.min(recordedSeconds, 120))
          const capturedAudio = analyser.current
            ? peakLevel.current >= 0.004
            : null
          setHasAudio(capturedAudio)
          if (capturedAudio === false) {
            setError('No microphone sound was detected. Check the selected microphone and record again.')
          }
        }
        setElapsed(Math.min(recordedSeconds, 120))
        audioStream.getTracks().forEach((track) => track.stop())
        stream.current = null
        analyser.current = null
        if (audioContext.current?.state !== 'closed') {
          void audioContext.current?.close()
        }
        audioContext.current = null
        setInputLevel(0)
      }
      startedAt.current = Date.now()
      recorder.current = activeRecorder
      activeRecorder.start()
      setRecording(true)
    } catch (reason) {
      const message =
        reason?.name === 'NotAllowedError' || reason?.name === 'PermissionDeniedError'
          ? 'Microphone permission was denied. Allow microphone access in browser settings or send a text update.'
          : reason?.name === 'NotFoundError'
            ? 'No microphone was found. Connect a microphone or send a text update.'
            : 'Could not start the microphone. Check browser permissions and try again.'
      setError(message)
      stream.current?.getTracks().forEach((track) => track.stop())
      stream.current = null
    }
  }

  function stop() {
    if (recorder.current?.state === 'recording') {
      recorder.current.stop()
      setRecording(false)
    }
  }

  function discard() {
    setBlob(null)
    setDuration(0)
    setElapsed(0)
    setInputLevel(0)
    setHasAudio(null)
    setError('')
  }

  return {
    recording,
    elapsed,
    duration,
    blob,
    inputLevel,
    hasAudio,
    error,
    supported: Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder),
    start,
    stop,
    discard,
  }
}
