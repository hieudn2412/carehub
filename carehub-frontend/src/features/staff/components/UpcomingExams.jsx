const fmt = (dateStr) =>
  new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

function UpcomingExams({ exams }) {
  return (
    <div className="dashboard-panel">
      <h3 className="dashboard-panel__title">📅 Bài kiểm tra sắp tới</h3>
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Tên bài kiểm tra</th>
            <th>Ngày bắt đầu</th>
            <th>Hạn hoàn thành</th>
          </tr>
        </thead>
        <tbody>
          {exams.map((exam) => (
            <tr key={exam.id}>
              <td>{exam.title}</td>
              <td>{fmt(exam.startDate)}</td>
              <td>{fmt(exam.dueDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default UpcomingExams