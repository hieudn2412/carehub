import { MailFilled, SafetyCertificateFilled } from '@ant-design/icons'

function SecurityBadge() {
  return (
    <div className="security-badge" aria-hidden="true">
      <MailFilled />
      <SafetyCertificateFilled className="security-badge__shield" />
    </div>
  )
}

export default SecurityBadge
