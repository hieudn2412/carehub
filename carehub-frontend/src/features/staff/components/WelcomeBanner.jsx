function WelcomeBanner({ summary }) {
  return (
    <div className="welcome-banner">
      <div className="welcome-banner__text">
        <h2>Chào mừng trở lại, {summary.fullName} 👋</h2>
        <p>
          Hôm nay bạn có {summary.pendingExams} bài kiểm tra cần hoàn thành
          và còn thiếu {summary.missingCmeHours} giờ CME
        </p>
        <span className="welcome-banner__sub">
          Cùng hoàn thành từng bước để duy trì năng lực chuyên môn
        </span>
        <div className="welcome-banner__badges">
          {summary.missingCmeHours > 0 && (
            <span className="badge badge--danger">
              ⚠ Cảnh báo thiếu giờ CME: {summary.missingCmeHours} giờ
            </span>
          )}
          {summary.pendingExams > 0 && (
            <span className="badge badge--warning">
              ⏰ Bạn có {summary.pendingExams} bài kiểm tra
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default WelcomeBanner