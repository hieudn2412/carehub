import { ToolOutlined } from '@ant-design/icons'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import '../styles/ComingSoonPage.css'

/**
 * Trang tạm cho các mục đã có trong sidebar nhưng chưa có màn hình thật.
 * Dùng chung để tránh lỗi điều hướng (404 / redirect về login) trong lúc
 * các trang này đang được phát triển.
 */
function ComingSoonPage({ title, breadcrumbs, note }) {
  const crumbs = breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs : [{ label: title }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={crumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="cs-page">
              <div className="cs-page__icon">
                <ToolOutlined />
              </div>
              <h2 className="cs-page__title">{title}</h2>
              <p className="cs-page__desc">
                Tính năng này đang được xây dựng và sẽ sớm ra mắt.
              </p>
              {note && <p className="cs-page__note">{note}</p>}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ComingSoonPage