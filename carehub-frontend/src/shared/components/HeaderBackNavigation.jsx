import { ArrowLeftOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'

function HeaderBackNavigation({ to, onClick, label = 'Quay lại' }) {
  const content = (
    <>
      <ArrowLeftOutlined aria-hidden="true" />
      <span>{label}</span>
    </>
  )

  if (to) {
    return (
      <Link className="dashboard-header__back" to={to} aria-label={label}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className="dashboard-header__back" onClick={onClick} aria-label={label}>
      {content}
    </button>
  )
}

export default HeaderBackNavigation
