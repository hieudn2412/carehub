import React, { useState, useRef } from "react";
import AdminSidebar from '../components/AdminSidebar';
import AdminHeader from '../components/AdminHeader';
import "../styles/ImportModal.css";

// ── SVG Icons (pixel-faithful to the design) ───────────────

function IconEmployees() {
  return (
    <svg width="44" height="36" viewBox="0 0 44 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Back person (slightly behind) */}
      <circle cx="30" cy="10" r="7" fill="#4CAF50" opacity="0.55" />
      <path d="M18 36c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="#4CAF50" opacity="0.55" />
      {/* Front person */}
      <circle cx="16" cy="10" r="8" fill="#2e7d32" />
      <path d="M2 36c0-7.732 6.268-14 14-14s14 6.268 14 14" fill="#2e7d32" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* House shape */}
      <path d="M20 4L4 16v20h32V16L20 4z" fill="#90a4ae" />
      {/* Roof line */}
      <path d="M20 4L4 16h32L20 4z" fill="#78909c" />
      {/* Door */}
      <rect x="15" y="26" width="10" height="10" rx="1" fill="#546e7a" />
      {/* Windows */}
      <rect x="8" y="20" width="7" height="6" rx="1" fill="#b0bec5" />
      <rect x="25" y="20" width="7" height="6" rx="1" fill="#b0bec5" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 4v20M10 12l8-8 8 8" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 28h24" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4 10l5 5 8-8" stroke="#2e7d32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v8M3 6l4 4 4-4" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 12h12" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconUploadBtn() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 9V1M3 5l4-4 4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 12h12" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ── Error rows data ────────────────────────────────────────
const errorRows = [
  { row: 12,  code: "VD00368", detail: 'Mã phòng ban "K-yZA" không tìm thấy trong tham chiếu' },
  { row: 20,  code: "VD00368", detail: "Lặp lại mã nhân viên - bỏ qua" },
  { row: 88,  code: "–",       detail: "Bị thiếu trường thông tin bắt buộc: loại nhân viên" },
  { row: 104, code: "VD00368", detail: 'Giá trị trình độ học vấn không được công nhận: "Đại học TC"' },
];

// ── Main Component ─────────────────────────────────────────
export default function ImportModal() {
  const [importType, setImportType] = useState("employee"); // "employee" | "department"
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState(null);
  const fileRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0]);
  };

  const breadcrumbs = [
    { label: 'Import dữ liệu' }
  ];

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="im-container">
              <div className="im-card">
                {/* ── Title ── */}
                <h2 className="im-title">Import dữ liệu tham chiếu</h2>
                <p className="im-subtitle">
                  Tải lên tệp Excel để đồng bộ dữ liệu gốc của nhân viên hoặc phòng ban.
                </p>

                {/* ── Type selector ── */}
                <section className="im-section">
                  <div className="im-section-label">CHỌN KIỂU IMPORT</div>
                  <div className="im-type-row">
                    {/* Employee */}
                    <button
                      className={`im-type-card ${importType === "employee" ? "selected" : ""}`}
                      onClick={() => setImportType("employee")}
                    >
                      <div className="im-type-icon"><IconEmployees /></div>
                      <div className="im-type-text">
                        <div className="im-type-name">Dữ liệu nhân viên</div>
                        <div className="im-type-desc">Import danh sách nhân viên từ HR excel.</div>
                      </div>
                      {importType === "employee" && (
                        <span className="im-check"><IconCheck /></span>
                      )}
                    </button>

                    {/* Department */}
                    <button
                      className={`im-type-card ${importType === "department" ? "selected" : ""}`}
                      onClick={() => setImportType("department")}
                    >
                      <div className="im-type-icon"><IconBuilding /></div>
                      <div className="im-type-text">
                        <div className="im-type-name">Dữ liệu phòng ban</div>
                        <div className="im-type-desc">Import danh sách phòng ban/khối từ HR excel.</div>
                      </div>
                      {importType === "department" && (
                        <span className="im-check"><IconCheck /></span>
                      )}
                    </button>
                  </div>
                </section>

                {/* ── File drop zone ── */}
                <section className="im-section">
                  <div className="im-section-label">TẢI FILE</div>
                  <div
                    className={`im-dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current.click()}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx"
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />
                    <IconUpload />
                    {file
                      ? <span className="im-drop-filename">{file.name}</span>
                      : <span className="im-drop-hint">
                          Kéo & thả hoặc click · Định dạng .xlsx– Tối đa 50MB
                        </span>
                    }
                  </div>

                  {/* Actions row */}
                  <div className="im-actions">
                    <button className="im-btn-outline">
                      <IconDownload /> Tải template xuống
                    </button>
                    <button className="im-btn-solid">
                      <IconUploadBtn /> Bắt đầu import
                    </button>
                  </div>
                </section>

                {/* ── Last import result ── */}
                <section className="im-section">
                  <div className="im-section-label">KẾT QUẢ LẦN CUỐI IMPORT</div>

                  {/* Stats */}
                  <div className="im-stats-row">
                    <div className="im-stat">
                      <div className="im-stat-label">Tổng số hàng</div>
                      <div className="im-stat-value">312</div>
                    </div>
                    <div className="im-stat">
                      <div className="im-stat-label">Đã thêm</div>
                      <div className="im-stat-value green">219</div>
                    </div>
                    <div className="im-stat">
                      <div className="im-stat-label">Cập nhật</div>
                      <div className="im-stat-value blue">312</div>
                    </div>
                    <div className="im-stat">
                      <div className="im-stat-label">Lỗi</div>
                      <div className="im-stat-value red">312</div>
                    </div>
                  </div>

                  {/* Error table */}
                  <div className="im-table-wrapper">
                    <table className="im-table">
                      <thead>
                        <tr>
                          <th>Hàng</th>
                          <th>Mã nhân viên</th>
                          <th>Lỗi chi tiết</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errorRows.map((r) => (
                          <tr key={r.row}>
                            <td className="im-td-row">{r.row}</td>
                            <td>{r.code}</td>
                            <td>{r.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}