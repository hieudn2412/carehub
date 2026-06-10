import { InfoCircleFilled } from '@ant-design/icons'

function SupportNotice() {
  return (
    <aside className="support-notice">
      <InfoCircleFilled />
      <div>
        <strong>Không nhận được mã?</strong>
        <p>Vui lòng kiểm tra thư mục Spam trong Gmail hoặc thử lại trong 60 giây</p>
      </div>
    </aside>
  )
}

export default SupportNotice
