import { useState, useId } from 'react'
import { motion, AnimatePresence } from 'motion/react'

/**
 * FloatingInput — replaces the static label-above-box pattern with a label
 * that lives inside the field at rest and floats up on focus/fill. This is
 * a genuine interaction upgrade (less vertical space, clearer focus state,
 * feels considered) rather than a purely visual one.
 *
 * Also carries real-time validation: pass a `validate` function returning
 * either `null` (valid/neutral) or a short error string. Feedback appears
 * inline, in the interface's voice (specific, not "invalid input").
 */
export default function FloatingInput({
  label,
  icon,
  type = 'text',
  value,
  onChange,
  validate,
  required,
  autoComplete = 'off',
  name,
  rightSlot,
}) {
  const id = useId()
  const [touched, setTouched] = useState(false)
  const [focused, setFocused] = useState(false)

  const error = touched && validate ? validate(value) : null
  const isValid = touched && validate && !error && value
  const floated = focused || value?.length > 0

  return (
    <div className="floating-field">
      <div
        className={`floating-input-wrap ${focused ? 'is-focused' : ''} ${error ? 'has-error' : ''} ${isValid ? 'is-valid' : ''}`}
      >
        {icon && <span className="floating-input-icon">{icon}</span>}
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          required={required}
          autoComplete={autoComplete}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setTouched(true) }}
          className="floating-input"
          placeholder=" "
        />
        <label htmlFor={id} className={`floating-label ${floated ? 'is-floated' : ''}`}>
          {label}
        </label>
        {rightSlot}
        {isValid && (
          <span className="floating-valid-check" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11.5 4L5.5 10L2.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            className="floating-error"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
