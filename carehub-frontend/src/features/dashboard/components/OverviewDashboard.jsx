import { useState } from 'react'
import {
  AlertOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  FilterOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import './OverviewDashboard.css'

const DOMAIN_META = {
  training: {
    eyebrow: 'GIỜ ĐÀO TẠO',
    title: 'Tiến độ giờ đào tạo',
    icon: <ClockCircleOutlined />,
    tone: 'blue',
  },
  exams: {
    eyebrow: 'BÀI KIỂM TRA & CHUYÊN MÔN',
    title: 'Điểm bài kiểm tra (lý thuyết)',
    icon: <BookOutlined />,
    tone: 'violet',
  },
  quality: {
    eyebrow: 'TUÂN THỦ & CHẤT LƯỢNG',
    title: 'Điểm checklist (thực hành)',
    icon: <SafetyCertificateOutlined />,
    tone: 'green',
  },
}

const numberFormatter = new Intl.NumberFormat('vi-VN')

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0)
}

function formatPercent(value) {
  const numeric = Number(value)
  return `${Number.isFinite(numeric) ? numeric.toFixed(1).replace('.', ',') : '0,0'}%`
}

function LoadingBlock() {
  return (
    <div className="overview-loading" aria-label="Đang tải dữ liệu">
      <span />
      <span />
      <span />
    </div>
  )
}

function SummaryCard({ icon, label, value, detail, tone = 'neutral', onOpen }) {
  const Component = onOpen ? 'button' : 'article'

  return (
    <Component
      className={`overview-summary-card overview-summary-card--${tone}${onOpen ? ' overview-summary-card--interactive' : ''}`}
      onClick={onOpen}
      type={onOpen ? 'button' : undefined}
    >
      <span className="overview-summary-card__icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </Component>
  )
}

function DomainCard({ type, data, onOpen }) {
  const meta = DOMAIN_META[type]
  const total = Number(data.total) || 0
  const passed = Number(data.passed) || 0
  const failed = Number(data.failed) || 0
  const rate = Number.isFinite(Number(data.rate)) ? Number(data.rate) : 0
  const hasData = data.available !== false && total > 0

  return (
    <article className={`overview-domain overview-domain--${meta.tone}`}>
      <header className="overview-domain__header">
        <span className="overview-domain__icon">{meta.icon}</span>
        <div>
          <span>{meta.eyebrow}</span>
          <h2>{meta.title}</h2>
        </div>
        {onOpen && (
          <button type="button" onClick={onOpen}>Xem chi tiết</button>
        )}
      </header>

      {data.loading ? (
        <LoadingBlock />
      ) : !hasData ? (
        <div className="overview-domain__empty">
          <ExperimentOutlined />
          <strong>{data.emptyTitle || 'Chưa có dữ liệu trong phạm vi này'}</strong>
          <span>{data.emptyMessage || 'Dữ liệu sẽ xuất hiện khi hệ thống ghi nhận kết quả.'}</span>
        </div>
      ) : (
        <>
          <div className="overview-domain__metrics">
            <div><span>Tổng số</span><strong>{formatNumber(total)}</strong></div>
            <div><span>Đạt</span><strong className="is-success">{formatNumber(passed)}</strong></div>
            <div><span>Chưa đạt</span><strong className="is-danger">{formatNumber(failed)}</strong></div>
            <div><span>Tỷ lệ đạt</span><strong>{formatPercent(rate)}</strong></div>
          </div>
          <div className="overview-progress" aria-label={`Tỷ lệ đạt ${formatPercent(rate)}`}>
            <div className="overview-progress__labels">
              <span>Tiến độ đạt chuẩn</span>
              <strong>{formatPercent(rate)}</strong>
            </div>
            <div className="overview-progress__track">
              <span style={{ width: `${Math.max(0, Math.min(100, rate))}%` }} />
            </div>
          </div>
          <p className="overview-domain__note">{data.note}</p>
        </>
      )}
    </article>
  )
}

export default function OverviewDashboard({
  role,
  profile,
  loading,
  error,
  filters,
  departments = [],
  professionalFields = [],
  onFilterChange,
  onExport,
  onNavigate,
  onSummaryOpen,
  summary,
  domains,
  warnings = [],
  visibleDomains = ['training', 'exams', 'quality'],
}) {
  const isStaff = role === 'staff'
  const visibleTypes = visibleDomains.filter((type) => DOMAIN_META[type] && domains[type])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const activeFilterCount = [
    role === 'admin' && filters.departmentId,
    filters.period && filters.period !== '30d',
    filters.professionalFieldId,
  ].filter(Boolean).length

  return (
    <div className={`overview-dashboard overview-dashboard--${role}`}>
      {!isStaff && (
        <section className="overview-filter-toolbar admin-control-toolbar" aria-label="Bộ lọc dashboard">
          <div className="admin-control-toolbar__main">
            <div className="admin-control-toolbar__controls">
              <button
                aria-controls="overview-dashboard-filter-panel"
                aria-expanded={isFilterOpen}
                className={`admin-control-toolbar__filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                onClick={() => setIsFilterOpen((current) => !current)}
                type="button"
              >
                <FilterOutlined /> Bộ lọc
                {activeFilterCount > 0 && (
                  <span className="admin-control-toolbar__filter-count">{activeFilterCount}</span>
                )}
              </button>
            </div>
            {onExport && (
              <button className="overview-export" type="button" onClick={onExport}>
                <DownloadOutlined /> Xuất dữ liệu giờ đào tạo
              </button>
            )}
          </div>

          {isFilterOpen && (
            <div className="overview-filters overview-filter-panel" id="overview-dashboard-filter-panel">
              <label>
                <span>Khoa/Phòng</span>
                {role === 'admin' ? (
                  <SearchableSelect
                    value={filters.departmentId}
                    onChange={(value) => onFilterChange('departmentId', value)}
                    ariaLabel="Tìm và chọn khoa/phòng"
                    placeholder="Toàn viện"
                    searchPlaceholder="Gõ tên khoa/phòng..."
                    options={[
                      { value: '', label: 'Toàn viện' },
                      ...departments.map((department) => ({
                        value: department.id,
                        label: department.name,
                        searchText: department.code || department.departmentCode,
                      })),
                    ]}
                  />
                ) : (
                  <div className="overview-filter-static">{profile?.departmentName || 'Khoa của tôi'}</div>
                )}
              </label>
              <label>
                <span>Thời gian</span>
                <select value={filters.period} onChange={(event) => onFilterChange('period', event.target.value)}>
                  <option value="30d">30 ngày gần nhất</option>
                  <option value="90d">90 ngày gần nhất</option>
                  <option value="year">Năm hiện tại</option>
                  <option value="all">Toàn bộ thời gian</option>
                </select>
              </label>
              <label>
                <span>Lĩnh vực chuyên môn</span>
                <SearchableSelect
                  value={filters.professionalFieldId}
                  onChange={(value) => onFilterChange('professionalFieldId', value)}
                  ariaLabel="Tìm và chọn lĩnh vực chuyên môn"
                  placeholder="Tất cả lĩnh vực"
                  searchPlaceholder="Gõ tên lĩnh vực..."
                  options={[
                    { value: '', label: 'Tất cả lĩnh vực' },
                    ...professionalFields.map((field) => ({
                      value: field.id,
                      label: field.name,
                      searchText: field.code,
                    })),
                  ]}
                />
              </label>
            </div>
          )}
        </section>
      )}

      {error && <div className="overview-error" role="alert"><AlertOutlined /> {error}</div>}

      {loading ? (
        <section className="overview-summary overview-summary--loading"><LoadingBlock /></section>
      ) : (
        <section className="overview-summary">
          <SummaryCard
            icon={<TeamOutlined />}
            label={isStaff ? 'Hồ sơ theo dõi' : 'Tổng nhân viên'}
            value={formatNumber(summary.total)}
            detail={summary.totalDetail}
            tone="blue"
            onOpen={onSummaryOpen ? () => onSummaryOpen('total') : undefined}
          />
          <SummaryCard
            icon={<CheckCircleOutlined />}
            label="Đạt yêu cầu"
            value={formatNumber(summary.passed)}
            detail={summary.passedDetail}
            tone="green"
            onOpen={onSummaryOpen ? () => onSummaryOpen('passed') : undefined}
          />
          <SummaryCard
            icon={<AlertOutlined />}
            label="Chưa đạt"
            value={formatNumber(summary.failed)}
            detail={summary.failedDetail}
            tone="red"
            onOpen={onSummaryOpen ? () => onSummaryOpen('failed') : undefined}
          />
          <SummaryCard
            icon={<SafetyCertificateOutlined />}
            label="Tỷ lệ đạt"
            value={formatPercent(summary.rate)}
            detail={summary.rateDetail}
            tone="violet"
            onOpen={onSummaryOpen ? () => onSummaryOpen('rate') : undefined}
          />
        </section>
      )}

      <section
        className="overview-domain-grid"
        aria-label={isStaff ? 'Các dashboard năng lực' : undefined}
      >
        {visibleTypes.map((type) => (
          <DomainCard
            key={type}
            type={type}
            data={{ ...domains[type], loading }}
            onOpen={domains[type].path ? () => onNavigate(domains[type].path) : undefined}
          />
        ))}
      </section>

      {!isStaff && (
        <section className="overview-warning-panel">
          <header>
            <div><AlertOutlined /><span><strong>Cảnh báo cần chú ý</strong><small>Ưu tiên xử lý theo phạm vi đang lọc</small></span></div>
            <span>{warnings.length} cảnh báo</span>
          </header>
          {warnings.length === 0 ? (
            <div className="overview-warning-panel__empty"><CheckCircleOutlined /> Chưa có cảnh báo nổi bật.</div>
          ) : (
            <div className="overview-warning-list">
              {warnings.map((warning) => (
                <button key={warning.id} type="button" onClick={() => warning.path && onNavigate(warning.path)}>
                  <span className={`overview-warning-list__dot is-${warning.tone || 'warning'}`} />
                  <span><strong>{warning.title}</strong><small>{warning.detail}</small></span>
                  <b>{warning.value}</b>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
