import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import {
  SearchOutlined,
  PlusCircleOutlined,
  EyeOutlined,
  LoadingOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import '../styles/FormImportListPage.css'

function FormImportListPage() {
  const navigate = useNavigate()
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [useMock, setUseMock] = useState(false)

  const MOCK_BATCHES = [
    {
      id: 1,
      createdAt: '2026-06-22T09:00:00Z',
      status: 'APPLIED',
      rowErrors: 0,
      rowSuccess: 3,
      rowTotal: 3,
      creator: { name: 'Nguyễn Văn A' }
    },
    {
      id: 2,
      createdAt: '2026-06-21T14:12:00Z',
      status: 'APPLIED_PARTIAL',
      rowErrors: 1,
      rowSuccess: 2,
      rowTotal: 3,
      creator: { name: 'Nguyễn Văn A' }
    },
    {
      id: 3,
      createdAt: '2026-06-20T08:30:00Z',
      status: 'FAILED',
      rowErrors: 5,
      rowSuccess: 0,
      rowTotal: 5,
      creator: { name: 'Nguyễn Văn A' }
    }
  ]

  useEffect(() => {
    loadImportBatches()
  }, [useMock])

  const loadImportBatches = () => {
    setLoading(true)
    adminApi.getFormImportBatches()
      .then(res => {
        const data = res.data?.data
        if (data && data.content) {
          setBatches(data.content)
          setLoading(false)
        } else {
          setUseMock(true)
        }
      })
      .catch((err) => {
        console.warn('GET import batches failed. Falling back to mockup data.', err)
        setBatches(MOCK_BATCHES)
        setUseMock(true)
        setLoading(false)
      })
  }

  const getBatchStatusBadgeClass = (status) => {
    switch (status) {
      case 'APPLIED':
        return 'batch-badge--success'
      case 'APPLIED_PARTIAL':
      case 'PARTIAL':
      case 'VALIDATED':
        return 'batch-badge--warning'
      case 'PENDING':
      case 'PROCESSING':
      case 'APPLYING':
        return 'batch-badge--processing'
      case 'FAILED':
        return 'batch-badge--danger'
      default:
        return 'batch-badge--gray'
    }
  }

  const getBatchStatusText = (status) => {
    switch (status) {
      case 'PENDING':
        return 'Đang chờ'
      case 'PROCESSING':
        return 'Đang phân tích'
      case 'VALIDATED':
        return 'Đã kiểm tra hợp lệ'
      case 'PARTIAL':
        return 'Hợp lệ một phần'
      case 'FAILED':
        return 'Lỗi phân tích'
      case 'APPLYING':
        return 'Đang áp dụng'
      case 'APPLIED':
        return 'Thành công'
      case 'APPLIED_PARTIAL':
        return 'Thành công một phần'
      default:
        return status
    }
  }

  const breadcrumbs = [
    { label: 'Quản lý chất lượng' },
    { label: 'Lịch sử Import Google Form' }
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="form-import-list-page">
              
              {/* Header card */}
              <div className="filp-header-card">
                <div className="filp-header-info">
                  <h1 className="filp-title">Lịch sử Import Google Form</h1>
                  <p className="filp-subtitle">
                    Theo dõi lịch sử nhập cấu trúc biểu mẫu checklist động từ liên kết Google Forms
                  </p>
                </div>
                <div className="filp-header-actions">
                  <button
                    className="filp-btn-create"
                    onClick={() => navigate('/admin/form-imports/new')}
                  >
                    <PlusCircleOutlined /> Nhập biểu mẫu mới
                  </button>
                </div>
              </div>

              {/* Table Card */}
              <div className="filp-table-card">
                <table className="filp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>Mã đợt Import</th>
                      <th style={{ width: '25%' }}>Thời gian tạo</th>
                      <th style={{ width: '15%' }}>Tổng số Form nguồn</th>
                      <th style={{ width: '12%' }}>Thành công</th>
                      <th style={{ width: '12%' }}>Lỗi / Xung đột</th>
                      <th style={{ width: '13%' }}>Trạng thái đợt</th>
                      <th style={{ width: '8%', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="filp-table-empty">
                          <LoadingOutlined /> Đang tải lịch sử import...
                        </td>
                      </tr>
                    ) : batches.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="filp-table-empty">
                          Chưa có đợt import biểu mẫu nào được thực hiện.
                        </td>
                      </tr>
                    ) : (
                      batches.map((batch) => (
                        <tr key={batch.id}>
                          <td>
                            <span className="filp-batch-code">BATCH #{batch.id}</span>
                          </td>
                          <td>
                            {batch.createdAt ? new Date(batch.createdAt).toLocaleString('vi-VN') : '—'}
                          </td>
                          <td>
                            <strong>{batch.rowTotal || (batch.rowSuccess + batch.rowErrors)}</strong>
                          </td>
                          <td>
                            <span className="filp-text-success">{batch.rowSuccess}</span>
                          </td>
                          <td>
                            <span className={batch.rowErrors > 0 ? 'filp-text-danger' : 'filp-text-muted'}>
                              {batch.rowErrors}
                            </span>
                          </td>
                          <td>
                            <span className={`batch-badge ${getBatchStatusBadgeClass(batch.status)}`}>
                              {getBatchStatusText(batch.status)}
                            </span>
                          </td>
                          <td>
                            <div className="filp-actions-cell">
                              <button
                                className="filp-btn-action"
                                onClick={() => navigate(`/admin/form-imports/new?batchId=${batch.id}`)}
                                title="Xem chi tiết lô hàng"
                              >
                                <EyeOutlined /> Chi tiết
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default FormImportListPage
