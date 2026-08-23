import { useState } from 'react'
import { SettingOutlined } from '@ant-design/icons'
import './ChartConfigPanel.css'

export default function ChartConfigPanel({
  sortOrder,
  onSortOrderChange,
  displayLimit,
  onDisplayLimitChange,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isCustom = !['all', '5', '10', '12'].includes(String(displayLimit))

  return (
    <div className="chart-config">
      <button
        type="button"
        className={`chart-config__trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <SettingOutlined /> Tuỳ chỉnh hiển thị
      </button>

      {isOpen && (
        <>
          <div className="chart-config__overlay" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div className="chart-config__dropdown" role="dialog" aria-label="Tuỳ chỉnh biểu đồ">
            <div className="chart-config__field">
              <label>Sắp xếp theo giờ</label>
              <select
                value={sortOrder}
                onChange={(e) => onSortOrderChange(e.target.value)}
              >
                <option value="desc">Từ nhiều đến ít</option>
                <option value="asc">Từ ít đến nhiều</option>
              </select>
            </div>
            <div className="chart-config__field">
              <label>Số lượng hiển thị</label>
              <select
                value={isCustom ? 'custom' : String(displayLimit)}
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    onDisplayLimitChange(e.target.value)
                  } else {
                    onDisplayLimitChange('15')
                  }
                }}
              >
                <option value="all">Tất cả</option>
                <option value="5">5 cột</option>
                <option value="10">10 cột</option>
                <option value="12">12 cột</option>
                <option value="custom">Tuỳ chỉnh số lượng...</option>
              </select>
              {isCustom && (
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={displayLimit}
                  onChange={(e) => {
                    let val = parseInt(e.target.value, 10)
                    if (isNaN(val)) val = ''
                    else if (val > 999) val = 999
                    onDisplayLimitChange(String(val))
                  }}
                  placeholder="Nhập số cột (tối đa 999)..."
                  autoFocus
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
