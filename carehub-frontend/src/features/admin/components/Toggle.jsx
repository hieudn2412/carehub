function Toggle({ checked, onChange }) {
  return (
    <div
      className={`toggle ${checked ? 'toggle--on' : 'toggle--off'}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
    >
      <div className="toggle__knob" />
    </div>
  )
}

export default Toggle