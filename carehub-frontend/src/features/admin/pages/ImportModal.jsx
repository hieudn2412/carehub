import { useState, useRef } from "react";
import AdminSidebar from '../components/AdminSidebar';
import AdminHeader from '../components/AdminHeader';
import { adminApi } from '../api/adminApi.js';
import "../styles/ImportModal.css";

// ── SVG Icons (pixel-faithful to the design) ───────────────

function IconUpload() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 4v20M10 12l8-8 8 8" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 28h24" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" />
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

// ── Main Component ─────────────────────────────────────────
export default function ImportModal() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
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

  const handleDownloadTemplate = () => {
    // Generate a CSV mapping directly to the expected columns in UserImportServiceImpl.java
    // Index 1: employeeCode, Index 3: firstName, Index 4: lastName, Index 5: gender, Index 6: birthday
    // Index 7: departmentName, Index 8: departmentCode, Index 10: positionName, Index 18: educationCode, Index 19: educationLevelName
    const headers = [
      "", "Ma nhan vien", "", "Ho dem", "Ten", "Gioi tinh", "Ngay sinh (d/M/yyyy)", 
      "Ten phong ban", "Ma phong ban", "", "Ten chuc danh", "", "", "", "", "", "", "", "Ma trinh do", "Ten trinh do hoc van"
    ].join(",");
    
    const row = [
      "", "VD00001", "", "Nguyen Van", "An", "Nam", "01/01/1990", 
      "Phong Ke Hoach", "KHTH", "", "Bac si chinh", "", "", "", "", "", "", "", "DH", "Dai hoc"
    ].join(",");
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(`${headers}\n${row}\n`);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "carehub_employee_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (!file) {
      setErrorMsg("Vui lòng chọn tệp tin Excel (.xlsx) trước khi bấm import.");
      return;
    }
    
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setImportResult(null);

    try {
      const response = await adminApi.importUsers(file);
      const data = response.data;
      if (data && data.success) {
        setImportResult(data.data);
        setSuccessMsg(`Nhập dữ liệu thành công! Đã xử lý ${data.data.totalRows} hàng.`);
        setFile(null);
      } else {
        setErrorMsg(data?.message || "Nhập dữ liệu không thành công.");
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || "Lỗi máy chủ hoặc kết nối mạng không thành công.";
      setErrorMsg(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const breadcrumbs = [
    { label: 'Import dữ liệu' }
  ];

  // Filter error rows
  const failedRows = importResult?.rowResults?.filter(r => r.status === "FAILED") || [];

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
                <h2 className="im-title">Import dữ liệu nhân viên</h2>
                <p className="im-subtitle">
                  Tải lên tệp Excel để đồng bộ danh sách nhân viên. Thông tin phòng ban mới, chức danh và trình độ học vấn sẽ tự động được hệ thống đồng bộ và tạo lập.
                </p>

                {/* ── Alerts ── */}
                {errorMsg && (
                  <div className="im-alert im-alert--error">
                    <strong>Lỗi:</strong> {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="im-alert im-alert--success">
                    <strong>Thành công:</strong> {successMsg}
                  </div>
                )}

                {/* ── File drop zone ── */}
                <section className="im-section">
                  <div className="im-section-label">TẢI FILE</div>
                  <div
                    className={`im-dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""} ${loading ? "disabled" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); if (!loading) setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => { if (!loading) fileRef.current.click(); }}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx"
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                      disabled={loading}
                    />
                    <IconUpload />
                    {file
                      ? <span className="im-drop-filename">{file.name}</span>
                      : <span className="im-drop-hint">
                          Kéo & thả hoặc click · Định dạng .xlsx (Tối đa 10MB)
                        </span>
                    }
                  </div>

                  {/* Actions row */}
                  <div className="im-actions">
                    <button 
                      className="im-btn-outline" 
                      onClick={handleDownloadTemplate}
                      disabled={loading}
                    >
                      <IconDownload /> Tải template xuống
                    </button>
                    <button 
                      className="im-btn-solid" 
                      onClick={handleImport}
                      disabled={loading || !file}
                    >
                      <IconUploadBtn /> {loading ? "Đang xử lý..." : "Bắt đầu import"}
                    </button>
                  </div>
                </section>

                {/* ── Last import result ── */}
                <section className="im-section">
                  <div className="im-section-label">KẾT QUẢ IMPORT GẦN NHẤT</div>

                  {/* Stats */}
                  <div className="im-stats-row">
                    <div className="im-stat">
                      <div className="im-stat-label">Tổng số hàng</div>
                      <div className="im-stat-value">{importResult ? importResult.totalRows : "–"}</div>
                    </div>
                    <div className="im-stat">
                      <div className="im-stat-label">Nhân sự thêm mới</div>
                      <div className="im-stat-value green">{importResult ? importResult.insertedUsers : "–"}</div>
                    </div>
                    <div className="im-stat">
                      <div className="im-stat-label">Nhân sự cập nhật</div>
                      <div className="im-stat-value blue">{importResult ? importResult.updatedUsers : "–"}</div>
                    </div>
                    <div className="im-stat">
                      <div className="im-stat-label">Hàng lỗi</div>
                      <div className="im-stat-value red">{importResult ? importResult.failedRows : "–"}</div>
                    </div>
                  </div>

                  {/* Reference data stats */}
                  {importResult && (importResult.newDepartments > 0 || importResult.newPositions > 0 || importResult.newEducationLevels > 0) && (
                    <div className="im-stats-row" style={{ marginTop: 12, borderTop: '1px dashed #cbd5e1', paddingTop: 12 }}>
                      <div className="im-stat">
                        <div className="im-stat-label">Phòng ban mới tạo</div>
                        <div className="im-stat-value green">{importResult.newDepartments}</div>
                      </div>
                      <div className="im-stat">
                        <div className="im-stat-label">Chức danh mới tạo</div>
                        <div className="im-stat-value green">{importResult.newPositions}</div>
                      </div>
                      <div className="im-stat">
                        <div className="im-stat-label">Trình độ mới tạo</div>
                        <div className="im-stat-value green">{importResult.newEducationLevels}</div>
                      </div>
                    </div>
                  )}

                  {/* Error table */}
                  {importResult && failedRows.length > 0 ? (
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
                          {failedRows.map((r, index) => (
                            <tr key={index}>
                              <td className="im-td-row">{r.rowNumber}</td>
                              <td>{r.employeeCode || "–"}</td>
                              <td>{r.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : importResult ? (
                    <div className="im-alert im-alert--success">
                      Chúc mừng! Không có lỗi nào xảy ra trong đợt import này.
                    </div>
                  ) : (
                    <div className="im-no-result">Chưa có kết quả import nào trong phiên làm việc hiện tại.</div>
                  )}
                </section>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}