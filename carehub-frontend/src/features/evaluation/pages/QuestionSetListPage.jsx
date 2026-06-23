import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { SearchOutlined, EditOutlined, DeleteOutlined, PlusCircleOutlined } from '@ant-design/icons'
import '../styles/QuestionSetListPage.css'

const INITIAL_SETS = [
  { id: 1, name: 'IC — Basic', category: 'Kiểm soát nhiễm khuẩn', questions: 24, difficulty: 'Dễ', active: true, description: 'Kiểm soát nhiễm khuẩn cơ bản cho nhân viên y tế mới.', questionIds: [1, 2, 9, 11] },
  { id: 2, name: 'IC — Advanced', category: 'Kiểm soát nhiễm khuẩn', questions: 18, difficulty: 'Khó', active: false, description: 'Các biện pháp kiểm soát nhiễm khuẩn chuyên sâu trong phòng phẫu thuật.', questionIds: [7, 10, 12] },
  { id: 3, name: 'Med safety — Core', category: 'An toàn sử dụng thuốc', questions: 15, difficulty: 'Trung bình', active: true, description: 'Quy tắc sử dụng thuốc an toàn và hạn chế sai sót lâm sàng.', questionIds: [3, 4, 12] },
  { id: 4, name: 'Patient ID — Full', category: 'An toàn người bệnh', questions: 30, difficulty: 'Dễ', active: true, description: 'Quy trình nhận diện chính xác người bệnh trong mọi bước điều trị.', questionIds: [5, 6, 11] },
]

const CATEGORIES = ['Kiểm soát nhiễm khuẩn', 'An toàn sử dụng thuốc', 'An toàn người bệnh', 'Quy trình lâm sàng']

function QuestionSetListPage() {
  const navigate = useNavigate()
  const [sets, setSets] = useState(() => {
    const stored = localStorage.getItem('carehub_question_sets')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Error parsing stored question sets:', e)
      }
    }
    localStorage.setItem('carehub_question_sets', JSON.stringify(INITIAL_SETS))
    return INITIAL_SETS
  })

  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // '', 'true', 'false'
  const [page, setPage] = useState(0)

  // Sync state to localStorage when sets changes
  useEffect(() => {
    localStorage.setItem('carehub_question_sets', JSON.stringify(sets))
  }, [sets])

  // In-Memory Filtering
  const filteredSets = sets.filter((item) => {
    const matchesKeyword = item.name.toLowerCase().includes(keyword.toLowerCase())
    const matchesCategory = categoryFilter === '' ? true : item.category === categoryFilter
    const matchesStatus =
      statusFilter === '' ? true : statusFilter === 'true' ? item.active : !item.active
    return matchesKeyword && matchesCategory && matchesStatus
  })

  // Pagination
  const pageSize = 10
  const totalElements = filteredSets.length
  const totalPages = Math.ceil(totalElements / pageSize) || 1
  const displayRows = filteredSets.slice(page * pageSize, (page + 1) * pageSize)

  const handleDeleteSet = (item) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bộ câu hỏi "${item.name}" không?`)) {
      return
    }
    setSets((prev) => prev.filter((s) => s.id !== item.id))
  }

  const getDifficultyClass = (diff) => {
    if (diff === 'Dễ') return 'diff-badge--easy'
    if (diff === 'Trung bình') return 'diff-badge--medium'
    return 'diff-badge--hard'
  }

  const breadcrumbs = [{ label: 'Bộ câu hỏi' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qsl-page">
              {/* Title Card */}
              <div className="qsl-title-card">
                <h1 className="qsl-title">Bộ câu hỏi</h1>
                <p className="qsl-subtitle">
                  Quản lý các nhóm ngân hàng câu hỏi theo chủ đề và độ khó
                </p>
              </div>

              {/* Filter Bar */}
              <div className="qsl-filter-bar">
                <div className="qsl-filter-left">
                  <div className="qsl-search">
                    <span className="qsl-search-icon">
                      <SearchOutlined />
                    </span>
                    <input
                      type="text"
                      className="qsl-search-input"
                      placeholder="Tìm bộ câu hỏi..."
                      value={keyword}
                      onChange={(e) => {
                        setKeyword(e.target.value)
                        setPage(0)
                      }}
                    />
                  </div>

                  <select
                    className="qsl-filter-select"
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value)
                      setPage(0)
                    }}
                  >
                    <option value="">Danh mục</option>
                    {CATEGORIES.map((cat, i) => (
                      <option key={i} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    className="qsl-filter-select"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value)
                      setPage(0)
                    }}
                  >
                    <option value="">Trạng thái</option>
                    <option value="true">Hoạt động</option>
                    <option value="false">Ngưng hoạt động</option>
                  </select>
                </div>

                <button 
                  className="qsl-btn-add" 
                  onClick={() => navigate('/admin/evaluation/question-sets/new')}
                >
                  <PlusCircleOutlined /> Tạo bộ câu hỏi
                </button>
              </div>

              {/* Table Card */}
              <div className="qsl-table-card">
                <table className="qsl-table">
                  <thead>
                    <tr>
                      <th>Tên bộ câu hỏi</th>
                      <th>Danh mục</th>
                      <th>Số câu hỏi</th>
                      <th>Độ khó</th>
                      <th>Trạng thái</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                          Không tìm thấy bộ câu hỏi nào.
                        </td>
                      </tr>
                    ) : (
                      displayRows.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                          <td style={{ color: '#475569' }}>{item.category}</td>
                          <td style={{ fontWeight: 600, color: '#334155' }}>{item.questions}</td>
                          <td>
                            <span className={`diff-badge ${getDifficultyClass(item.difficulty)}`}>
                              {item.difficulty}
                            </span>
                          </td>
                          <td>
                            <span className={`qsl-badge ${item.active ? 'qsl-badge--active' : 'qsl-badge--inactive'}`}>
                              {item.active ? 'Hoạt động' : 'Ngưng'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="qsl-action-btn qsl-action-btn--edit"
                                onClick={() => navigate(`/admin/evaluation/question-sets/${item.id}/edit`)}
                                title="Chỉnh sửa"
                              >
                                <EditOutlined />
                              </button>
                              <button
                                type="button"
                                className="qsl-action-btn qsl-action-btn--delete"
                                onClick={() => handleDeleteSet(item)}
                                title="Xóa"
                              >
                                <DeleteOutlined />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination Footer */}
                <div className="qsl-pagination-bar">
                  <div className="qsl-pagination-info">
                    Hiển thị {displayRows.length} trong tổng số {totalElements} kết quả
                  </div>
                  <div className="qsl-pagination-buttons">
                    <button
                      className="qsl-page-btn"
                      disabled={page <= 0}
                      onClick={() => setPage(page - 1)}
                    >
                      &lt;
                    </button>
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        className={`qsl-page-btn ${page === idx ? 'qsl-page-btn--active' : ''}`}
                        onClick={() => setPage(idx)}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      className="qsl-page-btn"
                      disabled={page + 1 >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default QuestionSetListPage
