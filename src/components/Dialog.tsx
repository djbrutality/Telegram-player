import { useEffect, useState, type FormEvent } from 'react'
import { useUi } from '../store'

/** Petite fenêtre de saisie (nom de playlist, correction de titre…). */
export function Dialog() {
  const spec = useUi((s) => s.dialog)
  const [values, setValues] = useState<string[]>([])
  useEffect(() => setValues(spec ? spec.fields.map((f) => f.value) : []), [spec])
  if (!spec) return null
  const close = () => useUi.setState({ dialog: null })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    spec.onSubmit(values.map((v) => v.trim()))
    close()
  }
  return (
    <div className="sheet-backdrop top" onClick={close}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{spec.title}</h2>
        {spec.fields.map((f, i) => (
          <label key={f.label}>
            {f.label}
            <input
              autoFocus={i === 0}
              value={values[i] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => v.map((x, k) => (k === i ? e.target.value : x)))}
              enterKeyHint={i === spec.fields.length - 1 ? 'done' : 'next'}
            />
          </label>
        ))}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={close}>
            Annuler
          </button>
          <button className="primary">{spec.confirm}</button>
        </div>
      </form>
    </div>
  )
}
