import mailSecurityImage from '../../assets/mail-security.png'

function SecurityBadge() {
  return (
    <div className="security-badge" aria-hidden="true">
      <img src={mailSecurityImage} alt="" />
    </div>
  )
}

export default SecurityBadge
