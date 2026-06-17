import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/ExamHistoryScreen.css'
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import {
    FileTextOutlined,
    CheckCircleOutlined,
    TrophyOutlined,
    PieChartOutlined,
    SearchOutlined,
    EyeOutlined,
    UndoOutlined,
    LeftOutlined,
    RightOutlined
} from '@ant-design/icons'

const MOCK_SUMMARY = {
    total: 12,
    passed: 9,
    avgScore: 82,
    passRate: 75,
}

const MOCK_EXAMS = [
    { id: 1, name: 'Hồi sức tích cực', date: '2026-06-15', score: 92, duration: 42, attempts: 1 },
    { id: 2, name: 'Kỹ năng điều dưỡng cơ bản', date: '2026-06-10', score: 48, duration: 55, attempts: 2 },
    { id: 3, name: 'Kiểm soát nhiễm khuẩn', date: '2026-06-05', score: 85, duration: 38, attempts: 1 },
    { id: 4, name: 'An toàn chuyển bệnh nhân', date: '2026-06-01', score: 55, duration: 60, attempts: 3 },
    { id: 5, name: 'Cấp cứu cơ bản', date: '2026-05-25', score: 78, duration: 50, attempts: 1 },
]

const PASS_THRESHOLD = 60
const PAGE_SIZE = 5

const fmt = (dateStr) =>
    new Date(dateStr).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    })

function ExamHistoryScreen() {
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [page, setPage] = useState(1)

    const filtered = useMemo(() => {
        return MOCK_EXAMS.filter((e) => {
            const passed = e.score >= PASS_THRESHOLD
            const matchSearch = e.name.toLowerCase().includes(search.toLowerCase())
            const matchStatus =
                statusFilter === 'all' ||
                (statusFilter === 'pass' && passed) ||
                (statusFilter === 'fail' && !passed)
            return matchSearch && matchStatus
        })
    }, [search, statusFilter])

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    const handleSearch = (e) => { setSearch(e.target.value); setPage(1) }
    const handleFilter = (e) => { setStatusFilter(e.target.value); setPage(1) }

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <div className="dashboard-layout__content">
                <Header title="Lịch sử thi" />
                <div className="dashboard-layout__body">
                    <div className="eh-page">
                        <div className="eh-header">
                            <h2 className="eh-page-title">Lịch sử thi</h2>
                            <p className="eh-page-sub">Kết quả các bài kiểm tra đã thực hiện</p>
                        </div>

                        {/* Summary cards */}
                        <div className="eh-summary">
                            {[
                                { label: 'Tổng bài đã thi', value: MOCK_SUMMARY.total, mod: 'blue', icon: <FileTextOutlined /> },
                                { label: 'Số bài đạt', value: MOCK_SUMMARY.passed, mod: 'green', icon: <CheckCircleOutlined /> },
                                { label: 'Điểm TB', value: `${MOCK_SUMMARY.avgScore}%`, mod: 'amber', icon: <TrophyOutlined /> },
                                { label: 'Tỉ lệ đạt', value: `${MOCK_SUMMARY.passRate}%`, mod: 'purple', icon: <PieChartOutlined /> },
                            ].map(({ label, value, mod, icon }) => (
                                <div key={label} className="eh-summary-card">
                                    <div className={`eh-summary-card__icon eh-summary-card__icon--${mod}`}>
                                        {icon}
                                    </div>
                                    <div>
                                        <p className="eh-summary-card__label">{label}</p>
                                        <p className="eh-summary-card__value">{value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Filters */}
                        <div className="eh-filter-bar">
                            <div className="eh-search">
                                <span className="eh-search-icon">
                                    <SearchOutlined />
                                </span>
                                <input
                                    type="text"
                                    className="eh-search-input"
                                    placeholder="Tìm theo tên bài thi..."
                                    value={search}
                                    onChange={handleSearch}
                                />
                            </div>
                            <select value={statusFilter} onChange={handleFilter}>
                                <option value="all">Tất cả trạng thái</option>
                                <option value="pass">Đạt</option>
                                <option value="fail">Không đạt</option>
                            </select>
                        </div>

                        {/* Table */}
                        <div className="eh-table-card">
                            <table className="eh-table">
                                <thead>
                                    <tr>
                                        <th>Tên bài thi</th>
                                        <th>Ngày thi</th>
                                        <th>Điểm số</th>
                                        <th>Trạng thái</th>
                                        <th>Thời gian</th>
                                        <th>Số lần thi</th>
                                        <th>Hành động</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((exam) => {
                                        const passed = exam.score >= PASS_THRESHOLD
                                        return (
                                            <tr key={exam.id}>
                                                <td>{exam.name}</td>
                                                <td>{fmt(exam.date)}</td>
                                                <td>
                                                    <span className={`eh-score ${passed ? 'eh-score--pass' : 'eh-score--fail'}`}>
                                                        {exam.score}%
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`eh-badge ${passed ? 'eh-badge--pass' : 'eh-badge--fail'}`}>
                                                        <span className="eh-badge__dot" />
                                                        {passed ? 'Đạt' : 'Không đạt'}
                                                    </span>
                                                </td>
                                                <td>{exam.duration} phút</td>
                                                <td>
                                                    <span className="eh-attempt">{exam.attempts}</span>
                                                </td>
                                                <td>
                                                    <div className="eh-actions">
                                                        <button
                                                            className="eh-btn eh-btn--view"
                                                            onClick={() => navigate(`/staff/exam/history/${exam.id}`)}
                                                        >
                                                            <EyeOutlined /> Chi tiết
                                                        </button>
                                                        <button
                                                            className="eh-btn eh-btn--retry"
                                                            disabled={passed}
                                                            onClick={() => navigate(`/staff/exam/take/${exam.id}`)}
                                                        >
                                                            <UndoOutlined /> Thi lại
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>

                            <div className="eh-pagination">
                                <span>Hiển thị {paginated.length} trong tổng số {filtered.length} kết quả</span>
                                <div className="eh-page-nums">
                                    <button
                                        className="eh-pn"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                    >
                                        <LeftOutlined />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                                        <button
                                            key={n}
                                            className={`eh-pn ${n === page ? 'eh-pn--active' : ''}`}
                                            onClick={() => setPage(n)}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                    <button
                                        className="eh-pn"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages || totalPages === 0}
                                    >
                                        <RightOutlined />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>


    )
}

export default ExamHistoryScreen