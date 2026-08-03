import HeaderBackNavigation from './HeaderBackNavigation.jsx'
import './MobileSearchSheet.css'

function MobileBackBar({ to, onClick, label = 'Quay lại' }) {
  return (
    <div className="mobile-back-bar">
      <HeaderBackNavigation to={to} onClick={onClick} label={label} />
    </div>
  )
}

export default MobileBackBar
