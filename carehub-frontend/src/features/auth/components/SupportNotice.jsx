import Icon from '../../../shared/components/Icon.jsx'

function SupportNotice() {
  return (
    <aside className="support-notice">
      <Icon name="info" />
      <div>
        <strong>Không nhận được mã?</strong>
        <p>Vui lòng kiểm tra thư mục Spam trong Gmail hoặc thử lại trong 60 giây</p>
      </div>
    </aside>
  )
}

export default SupportNotice
