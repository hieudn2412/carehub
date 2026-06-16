import { useEffect, useState } from 'react'

// Dữ liệu giả lập (Mock data) khớp chính xác với thiết kế mockup
const MOCK_DASHBOARD_DATA = {
  summary: {
    userName: 'Phạm Quốc Bảo',
    cmeHours: 98,
    cmeTarget: 120,
    missingCmeHours: 22,
    averageScore: 99,
    examsCompleted: 5,
    upcomingExamsCount: 1,
  },
  upcomingExams: [
    { id: 1, name: 'Kỹ năng điều dưỡng cơ bản', startDate: '25/06/2026', endDate: '25/06/2026' },
    { id: 2, name: 'Kiểm soát nhiễm khuẩn', startDate: '25/06/2026', endDate: '25/06/2026' },
    { id: 3, name: 'Cấp cứu cơ bản', startDate: '25/06/2026', endDate: '25/06/2026' },
    { id: 4, name: 'Năng lực lâm sàng', startDate: '25/06/2026', endDate: '25/06/2026' },
  ],
  activities: [
    { id: 1, type: 'exam', content: 'Hoàn thành bài thi "Hồi sức tích cực"', time: '1 phút' },
    { id: 2, type: 'login', content: 'Đăng nhập', time: '9 phút' },
    { id: 3, type: 'password', content: 'Đổi mật khẩu', time: '1 giờ' },
    { id: 4, type: 'upload', content: 'Upload minh chứng', time: '5 giờ' },
  ],
}

export function useDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error] = useState(null)

  useEffect(() => {
    // ⚠️ LƯU Ý: Hiện tại Backend chưa viết các API này,
    // nên ta dùng dữ liệu giả lập (Mock) với độ trễ 500ms để test hiệu ứng Loading.
    const timer = setTimeout(() => {
      setData(MOCK_DASHBOARD_DATA)
      setLoading(false)
    }, 500)

    return () => clearTimeout(timer)

    /* 
    // SAU NÀY KHI BACKEND ĐÃ CÓ API, BẠN CHỈ CẦN MỞ COMMENT ĐOẠN CODE DƯỚI ĐÂY:
    const token = tokenStorage.getAccessToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    Promise.all([
      httpClient.get('/dashboard/summary', { headers }).then(r => r.data.data),
      httpClient.get('/dashboard/upcoming-exams', { headers }).then(r => r.data.data),
      httpClient.get('/dashboard/activities', { headers }).then(r => r.data.data),
    ])
      .then(([summary, upcomingExams, activities]) => {
        setData({ summary, upcomingExams, activities })
      })
      .catch(err => {
        setError(err.message || 'Đã xảy ra lỗi khi tải dữ liệu từ server')
      })
      .finally(() => {
        setLoading(false)
      })
    */
  }, [])

  return { data, loading, error }
}
