import { Link } from 'react-router-dom'
import { CalculatorOutlined, SlidersOutlined } from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import '../styles/SystemSettingsScreen.css'

const settingsItems = [
  {
    icon: <CalculatorOutlined />,
    title: 'Cài đặt điểm sàn quy trình kỹ thuật',
    description: 'Thiết lập điểm đạt, trọng số câu trọng yếu và trạng thái áp dụng cho từng phiên bản bảng kiểm.',
    path: '/admin/quality/formulas',
  },
  {
    icon: <SlidersOutlined />,
    title: 'Cài đặt mục tiêu tuân thủ',
    description: 'Quản lý mục tiêu tuân thủ cấp bệnh viện và cấp khoa/phòng cho các bảng kiểm giám sát.',
    path: '/admin/quality/compliance-targets',
  },
]

function ComplianceMonitoringSettingsPage() {
  return (
    <AppShell
      breadcrumbs={[{ label: 'Cấu hình hệ thống' }, { label: 'Cấu hình giám sát tuân thủ' }]}
      title="Cấu hình giám sát tuân thủ"
    >
      <div className="ss-page">
        <header className="ss-page-heading">
          <h1>Cấu hình giám sát tuân thủ</h1>
          <p>Thiết lập các ngưỡng và mục tiêu sử dụng trong luồng giám sát tuân thủ.</p>
        </header>

        <section className="ss-settings-grid" aria-label="Danh sách cấu hình giám sát tuân thủ">
          {settingsItems.map((item) => (
            <Link className="ss-settings-card" to={item.path} key={item.path}>
              <span className="ss-settings-card__icon">{item.icon}</span>
              <div>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </AppShell>
  )
}

export default ComplianceMonitoringSettingsPage
