import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { SearchOutlined, EditOutlined, DeleteOutlined, PlusCircleOutlined } from '@ant-design/icons'
import '../styles/QuestionBankListPage.css'

const INITIAL_QUESTIONS = [
  {
    id: 1,
    content: 'Correct hand hygiene technique before patient contact?',
    category: 'Kiểm soát nhiễm khuẩn',
    difficulty: 'Dễ',
    active: true,
    explanation: 'Quy trình vệ sinh tay thường quy theo khuyến cáo của Bộ Y tế gồm 6 bước.',
    options: ['5 bước', '6 bước', '7 bước', '8 bước'],
    correctOptionIndex: 1
  },
  {
    id: 2,
    content: 'Steps for safe IV medication administration?',
    category: 'Quy trình lâm sàng',
    difficulty: 'Khó',
    active: false,
    explanation: 'Chỉ chạm vào mặt trong của găng khi đeo găng thứ nhất, mặt ngoài găng khi đeo găng thứ hai.',
    options: ['Chạm vào mọi bề mặt của găng', 'Chỉ chạm vào mặt trong của găng thứ nhất, tránh chạm mặt ngoài', 'Nhờ đồng nghiệp đeo giúp', 'Không cần đeo găng tay'],
    correctOptionIndex: 1
  },
  {
    id: 3,
    content: 'First action when patient shows signs of anaphylaxis?',
    category: 'Cấp cứu',
    difficulty: 'Trung bình',
    active: true,
    explanation: 'Quy tắc 6 đúng gồm đúng người bệnh, đúng thuốc, đúng liều, đúng đường dùng, đúng thời gian, đúng hồ sơ.',
    options: ['Đúng người bệnh, đúng thuốc, đúng liều, đúng đường dùng, đúng thời gian, đúng hồ sơ', 'Đúng khoa phòng, đúng bác sĩ, đúng y tá, đúng bệnh nhân', 'Đúng thời gian, đúng địa điểm, đúng thuốc, đúng giá', 'Đúng bệnh, đúng thuốc, đúng liều lượng'],
    correctOptionIndex: 0
  },
  {
    id: 4,
    content: 'Purpose of patient wristband identification?',
    category: 'An toàn người bệnh',
    difficulty: 'Dễ',
    active: true,
    explanation: 'Nhằm phòng tránh nhầm lẫn người bệnh trong quá trình cung cấp dịch vụ y tế.',
    options: ['Định danh chính xác bệnh nhân, tránh nhầm lẫn khi tiêm, truyền, phẫu thuật', 'Làm đẹp cho bệnh nhân', 'Phân loại phòng bệnh của bệnh nhân', 'Để bệnh nhân tự nhận biết mình'],
    correctOptionIndex: 0
  },
  {
    id: 5,
    content: 'Quy trình bàn giao người bệnh trước khi chuyển giao ca phẫu thuật?',
    category: 'An toàn người bệnh',
    difficulty: 'Trung bình',
    active: true,
    explanation: 'Sử dụng bảng kiểm SBAR hoặc bảng kiểm bàn giao phẫu thuật an toàn.',
    options: ['Bàn giao miệng nhanh gọn', 'Sử dụng hồ sơ bệnh án và bảng kiểm an toàn phẫu thuật bàn giao chi tiết', 'Không cần bàn giao', 'Để bệnh nhân tự sang phòng mổ'],
    correctOptionIndex: 1
  },
  {
    id: 6,
    content: 'Kỹ thuật đặt ống thông tiểu lưu cho bệnh nhân nam?',
    category: 'Quy trình lâm sàng',
    difficulty: 'Khó',
    active: true,
    explanation: 'Đặt thông tiểu nam cần chú ý sát khuẩn kỹ đầu dương vật và đưa ống thông tiểu vào sâu khoảng 18-20cm.',
    options: ['Đưa ống vào khoảng 5cm', 'Sát khuẩn và đưa ống thông tiểu sâu khoảng 18-20cm đến khi có nước tiểu chảy ra', 'Đưa ống thông tiểu vào nhanh không cần bôi trơn', 'Đặt ống thông tiểu không cần vô khuẩn'],
    correctOptionIndex: 1
  },
  {
    id: 7,
    content: 'Các bước chăm sóc và thay băng vết thương nhiễm trùng?',
    category: 'Quy trình lâm sàng',
    difficulty: 'Trung bình',
    active: true,
    explanation: 'Rửa vết thương từ trong ra ngoài bằng dung dịch sát khuẩn, loại bỏ giả mạc hoại tử.',
    options: ['Rửa bằng nước lã', 'Rửa sạch từ trong ra ngoài bằng dung dịch sát khuẩn thích hợp và đắp gạc vô khuẩn', 'Đắp thuốc lá cây', 'Để hở vết thương tự khô'],
    correctOptionIndex: 1
  },
  {
    id: 8,
    content: 'Quy định phân loại chất thải y tế nguy hại tại nguồn?',
    category: 'Kiểm soát nhiễm khuẩn',
    difficulty: 'Dễ',
    active: true,
    explanation: 'Chất thải lây nhiễm bỏ vào túi/hộp màu vàng; chất thải nguy hại không lây nhiễm bỏ vào túi/hộp màu đen.',
    options: ['Bỏ chung tất cả chất thải vào thùng rác sinh hoạt', 'Phân loại chất thải lây nhiễm vào túi màu vàng, chất thải nguy hại không lây nhiễm vào túi màu đen', 'Bỏ vào túi màu xanh', 'Chôn lấp trực tiếp trong khuôn viên bệnh viện'],
    correctOptionIndex: 1
  },
  {
    id: 9,
    content: 'Quy trình xử lý dụng cụ y tế tái sử dụng sau phẫu thuật?',
    category: 'Kiểm soát nhiễm khuẩn',
    difficulty: 'Khó',
    active: false,
    explanation: 'Quy trình gồm khử khuẩn sơ bộ, cọ rửa làm sạch, lau khô, đóng gói và tiệt khuẩn bằng autoclave.',
    options: ['Rửa bằng nước thường rồi phơi khô', 'Ngâm khử khuẩn sơ bộ, làm sạch, lau khô, đóng gói và tiệt khuẩn', 'Chỉ cần lau cồn', 'Dùng lại ngay cho ca sau'],
    correctOptionIndex: 1
  },
  {
    id: 10,
    content: 'Quy trình nhận diện người bệnh chính xác khi thực hiện tiêm thuốc?',
    category: 'An toàn người bệnh',
    difficulty: 'Dễ',
    active: true,
    explanation: 'Đối chiếu ít nhất 2 thông tin (Họ tên, Ngày sinh/Số BA) trên vòng định danh so với bệnh án/y lệnh trước khi tiêm.',
    options: ['Chỉ gọi tên bệnh nhân', 'Đối chiếu ít nhất 2 thông tin nhận diện trên vòng định danh so với y lệnh thuốc', 'Hỏi số giường bệnh nhân', 'Không cần đối chiếu'],
    correctOptionIndex: 1
  },
  {
    id: 11,
    content: 'Quy tắc bảo quản các loại thuốc nguy cơ cao (High Alert Medications)?',
    category: 'Cấp cứu',
    difficulty: 'Khó',
    active: true,
    explanation: 'Thuốc nguy cơ cao cần được dán nhãn cảnh báo màu đỏ, tủ riêng và khóa an toàn.',
    options: ['Để chung với thuốc thường', 'Dán nhãn cảnh báo đỏ rõ ràng, lưu trữ ở tủ riêng có khóa an toàn', 'Để ở quầy thuốc tự do', 'Không cần dán nhãn'],
    correctOptionIndex: 1
  },
]

const CATEGORIES = ['Kiểm soát nhiễm khuẩn', 'Quy trình lâm sàng', 'Cấp cứu', 'An toàn người bệnh']
const DIFFICULTIES = ['Dễ', 'Trung bình', 'Khó']

function QuestionBankListPage() {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState(() => {
    const stored = localStorage.getItem('carehub_questions')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Error parsing stored questions:', e)
      }
    }
    localStorage.setItem('carehub_questions', JSON.stringify(INITIAL_QUESTIONS))
    return INITIAL_QUESTIONS
  })

  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // '', 'true', 'false'
  const [page, setPage] = useState(0)

  // Sync back to localStorage
  useEffect(() => {
    localStorage.setItem('carehub_questions', JSON.stringify(questions))
  }, [questions])

  // Filtering
  const filteredQuestions = questions.filter((q) => {
    const matchesKeyword = q.content.toLowerCase().includes(keyword.toLowerCase())
    const matchesCategory = categoryFilter === '' ? true : q.category === categoryFilter
    const matchesDifficulty = difficultyFilter === '' ? true : q.difficulty === difficultyFilter
    const matchesStatus =
      statusFilter === '' ? true : statusFilter === 'true' ? q.active : !q.active
    return matchesKeyword && matchesCategory && matchesDifficulty && matchesStatus
  })

  // Pagination
  const pageSize = 10
  const totalElements = filteredQuestions.length
  const totalPages = Math.ceil(totalElements / pageSize) || 1
  const displayRows = filteredQuestions.slice(page * pageSize, (page + 1) * pageSize)

  const handleDelete = (item) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng không?`)) {
      return
    }
    setQuestions((prev) => prev.filter((q) => q.id !== item.id))
  }

  const getDifficultyClass = (diff) => {
    if (diff === 'Dễ') return 'diff-badge--easy'
    if (diff === 'Trung bình') return 'diff-badge--medium'
    return 'diff-badge--hard'
  }

  const formatIndex = (indexOnPage) => {
    const absoluteIndex = page * pageSize + indexOnPage + 1
    return String(absoluteIndex).padStart(3, '0')
  }

  const breadcrumbs = [{ label: 'Ngân hàng câu hỏi' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qbl-page">
              {/* Title Card */}
              <div className="qbl-title-card">
                <h1 className="qbl-title">Ngân hàng câu hỏi</h1>
                <p className="qbl-subtitle">
                  Quản lý toàn bộ câu hỏi kiểm tra - Tìm kiếm, lọc và phân loại
                </p>
              </div>

              {/* Filter Bar */}
              <div className="qbl-filter-bar">
                <div className="qbl-filter-left">
                  <div className="qbl-search">
                    <span className="qbl-search-icon">
                      <SearchOutlined />
                    </span>
                    <input
                      type="text"
                      className="qbl-search-input"
                      placeholder="Tìm câu hỏi..."
                      value={keyword}
                      onChange={(e) => {
                        setKeyword(e.target.value)
                        setPage(0)
                      }}
                    />
                  </div>

                  <select
                    className="qbl-filter-select"
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
                    className="qbl-filter-select"
                    value={difficultyFilter}
                    onChange={(e) => {
                      setDifficultyFilter(e.target.value)
                      setPage(0)
                    }}
                  >
                    <option value="">Độ khó</option>
                    {DIFFICULTIES.map((diff, i) => (
                      <option key={i} value={diff}>
                        {diff}
                      </option>
                    ))}
                  </select>

                  <select
                    className="qbl-filter-select"
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
                  className="qbl-btn-add" 
                  onClick={() => navigate('/admin/evaluation/question-bank/new')}
                >
                  <PlusCircleOutlined /> Thêm câu hỏi
                </button>
              </div>

              {/* Table Card */}
              <div className="qbl-table-card">
                <table className="qbl-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>#</th>
                      <th>Nội dung câu hỏi</th>
                      <th>Danh mục</th>
                      <th>Độ khó</th>
                      <th>Trạng thái</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                          Không tìm thấy câu hỏi nào.
                        </td>
                      </tr>
                    ) : (
                      displayRows.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={{ color: '#64748b', fontWeight: 500 }}>{formatIndex(idx)}</td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.content}</td>
                          <td style={{ color: '#475569' }}>{item.category}</td>
                          <td>
                            <span className={`diff-badge ${getDifficultyClass(item.difficulty)}`}>
                              {item.difficulty}
                            </span>
                          </td>
                          <td>
                            <span className={`qbl-badge ${item.active ? 'qbl-badge--active' : 'qbl-badge--inactive'}`}>
                              {item.active ? 'Hoạt động' : 'Ngưng'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="qbl-action-btn qbl-action-btn--edit"
                                onClick={() => navigate(`/admin/evaluation/question-bank/${item.id}/edit`)}
                                title="Chỉnh sửa"
                              >
                                <EditOutlined />
                              </button>
                              <button
                                type="button"
                                className="qbl-action-btn qbl-action-btn--delete"
                                onClick={() => handleDelete(item)}
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
                <div className="qbl-pagination-bar">
                  <div className="qbl-pagination-info">
                    Hiển thị {displayRows.length} trong tổng số {totalElements} kết quả
                  </div>
                  <div className="qbl-pagination-buttons">
                    <button
                      className="qbl-page-btn"
                      disabled={page <= 0}
                      onClick={() => setPage(page - 1)}
                    >
                      &lt;
                    </button>
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        className={`qbl-page-btn ${page === idx ? 'qbl-page-btn--active' : ''}`}
                        onClick={() => setPage(idx)}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      className="qbl-page-btn"
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

export default QuestionBankListPage
