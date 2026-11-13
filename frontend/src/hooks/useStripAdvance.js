import { useEffect, useRef, useState } from 'react'

export function useStripAdvance(caseId, status) {
  const previous = useRef({ caseId, status })
  const [advancing, setAdvancing] = useState(false)

  useEffect(() => {
    const prior = previous.current
    previous.current = { caseId, status }
    if (prior.caseId !== caseId || !prior.status || prior.status === status) return

    setAdvancing(true)
    const timer = setTimeout(() => setAdvancing(false), 650)
    return () => clearTimeout(timer)
  }, [caseId, status])

  return advancing
}
