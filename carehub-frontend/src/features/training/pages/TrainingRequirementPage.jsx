import React, { useEffect, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { EditOutlined, DeleteOutlined } from '@ant-design/icons'
import '../styles/TrainingRequirementPage.css'

const TODAY = new Date().toISOString().slice(0, 10)

function TrainingRequirementPage() {
  const [defaultHours, setDefaultHours] = useState(120)
  const [defaultCycle, setDefaultCycle] = useState(5)
  const [defaultReqRecord, setDefaultReqRecord] = useState(null)
  const [hoursInputFocused, setHoursInputFocused] = useState(false)

  const [overrides, setOverrides] = useState([])
  const [deletedOverrideIds, setDeletedOverrideIds] = useState([])

  const [positions, setPositions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [message, setMessage] = useState('')

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' or 'edit'
  const [editingIndex, setEditingIndex] = useState(null)
  const [modalForm, setModalForm] = useState({
    id: null,
    code: '',
    name: '',
    requiredHours: 120,
    cycleYears: 5,
    jobPositionId: '',
  })

  const fetchData = async () => {
    setIsLoading(true)
    setErrorMessage('')
    setMessage('')

    try {
      const [requirementsResponse, positionsResponse] = await Promise.all([
        trainingApi.getRequirements({
          size: 100,
        }),
        trainingApi.getPositions(),
      ])

      const allReqs = requirementsResponse.data?.data?.content || []
      const posList = positionsResponse.data?.data || []
      setPositions(posList)

      // 1. Find default requirement (no department, position, or professional field)
      const defaultReq = allReqs.find(
        (r) => !r.departmentId && !r.jobPositionId && !r.professionalFieldId && r.active
      )

      if (defaultReq) {
        setDefaultHours(defaultReq.requiredHours)
        setDefaultCycle(defaultReq.cycleYears)
        setDefaultReqRecord(defaultReq)
      } else {
        setDefaultHours(120)
        setDefaultCycle(5)
        setDefaultReqRecord(null)
      }

      // 2. Find overrides (jobPositionId is not null)
      const activeOverrides = allReqs.filter(
        (r) => r.jobPositionId !== null && r.active
      )

      if (activeOverrides.length > 0) {
        setOverrides(
          activeOverrides.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            requiredHours: r.requiredHours,
            cycleYears: r.cycleYears,
            jobPositionId: r.jobPositionId,
            jobPositionName: r.jobPositionName,
            version: r.version,
            active: r.active,
          }))
        )
      } else {
        setOverrides([])
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không tải được dữ liệu cấu hình'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleOpenAddModal = () => {
    setModalMode('add')
    setEditingIndex(null)
    setModalForm({
      id: null,
      code: '',
      name: '',
      requiredHours: 120,
      cycleYears: 5,
      jobPositionId: '',
    })
    setIsModalOpen(true)
  }

  const handleEditOverride = (item, index) => {
    setModalMode('edit')
    setEditingIndex(index)
    setModalForm({
      id: item.id,
      code: item.code,
      name: item.name,
      requiredHours: item.requiredHours,
      cycleYears: item.cycleYears,
      jobPositionId: item.jobPositionId || '',
    })
    setIsModalOpen(true)
  }

  const handleDeleteOverride = (item, index) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa cấu hình ghi đè này không?`)) {
      return
    }

    const newOverrides = [...overrides]
    newOverrides.splice(index, 1)
    setOverrides(newOverrides)

    if (typeof item.id === 'number') {
      setDeletedOverrideIds((prev) => [...prev, { id: item.id, version: item.version }])
    }
  }

  const handleModalSubmit = (e) => {
    e.preventDefault()

    if (modalMode === 'add') {
      const selectedPos = positions.find((pos) => pos.id === Number(modalForm.jobPositionId))
      const posName = selectedPos ? selectedPos.name : `Chức danh #${modalForm.jobPositionId}`

      const newOverride = {
        id: `new-${Date.now()}`,
        code: `REQ-POS-${modalForm.jobPositionId}-${Date.now()}`,
        name: `Yêu cầu cho ${posName}`,
        requiredHours: Number(modalForm.requiredHours),
        cycleYears: Number(modalForm.cycleYears),
        jobPositionId: Number(modalForm.jobPositionId),
        jobPositionName: posName,
        active: true,
      }

      const exists = overrides.some(
        (o) => o.jobPositionId === Number(modalForm.jobPositionId)
      )
      if (exists) {
        alert('Ghi đè cho chức danh này đã tồn tại!')
        return
      }

      setOverrides((prev) => [...prev, newOverride])
    } else {
      const updatedOverrides = [...overrides]
      const currentItem = updatedOverrides[editingIndex]

      updatedOverrides[editingIndex] = {
        ...currentItem,
        requiredHours: Number(modalForm.requiredHours),
        cycleYears: Number(modalForm.cycleYears),
      }

      setOverrides(updatedOverrides)
    }

    setIsModalOpen(false)
  }

  const handleSaveConfig = async () => {
    setIsSaving(true)
    setErrorMessage('')
    setMessage('')

    try {
      // 1. Save default requirement
      const defaultPayload = {
        code: defaultReqRecord?.code || 'REQ-DEFAULT',
        name: defaultReqRecord?.name || 'Yêu cầu đào tạo mặc định',
        requiredHours: Number(defaultHours),
        cycleYears: Number(defaultCycle),
        jobPositionId: null,
        departmentId: null,
        professionalFieldId: null,
        warningThresholdHours: null,
        effectiveFrom: defaultReqRecord?.effectiveFrom || TODAY,
        effectiveTo: null,
        active: true,
        version: defaultReqRecord?.version || null,
      }

      if (defaultReqRecord?.id) {
        await trainingApi.updateRequirement(defaultReqRecord.id, defaultPayload)
      } else {
        await trainingApi.createRequirement(defaultPayload)
      }

      // 2. Process deletions of overrides
      for (const del of deletedOverrideIds) {
        await trainingApi.updateRequirementStatus(del.id, {
          active: false,
          version: del.version,
        })
      }

      // 3. Process creations and updates of overrides
      for (const item of overrides) {
        const payload = {
          code: item.code,
          name: item.name,
          requiredHours: Number(item.requiredHours),
          cycleYears: Number(item.cycleYears),
          jobPositionId: item.jobPositionId,
          departmentId: null,
          professionalFieldId: null,
          warningThresholdHours: null,
          effectiveFrom: item.effectiveFrom || TODAY,
          effectiveTo: null,
          active: true,
          version: typeof item.id === 'number' ? item.version : null,
        }

        if (typeof item.id === 'number') {
          await trainingApi.updateRequirement(item.id, payload)
        } else if (typeof item.id === 'string' && item.id.startsWith('new-')) {
          await trainingApi.createRequirement(payload)
        }
      }

      setMessage('Đã lưu cấu hình thành công!')
      setDeletedOverrideIds([])
      await fetchData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể lưu cấu hình'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetToDefault = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn thiết lập lại toàn bộ cấu hình về mặc định (120h, chu kỳ 5 năm)?')) {
      return
    }

    setIsSaving(true)
    setErrorMessage('')
    setMessage('')

    try {
      const allReqsResponse = await trainingApi.getRequirements({ size: 100 })
      const allReqs = allReqsResponse.data?.data?.content || []

      for (const r of allReqs) {
        if (r.active && (r.jobPositionId !== null || r.departmentId !== null || r.professionalFieldId !== null)) {
          await trainingApi.updateRequirementStatus(r.id, {
            active: false,
            version: r.version,
          })
        }
      }

      const defaultReq = allReqs.find(
        (r) => !r.departmentId && !r.jobPositionId && !r.professionalFieldId && r.active
      )

      const defaultPayload = {
        code: defaultReq?.code || 'REQ-DEFAULT',
        name: defaultReq?.name || 'Yêu cầu đào tạo mặc định',
        requiredHours: 120,
        cycleYears: 5,
        jobPositionId: null,
        departmentId: null,
        professionalFieldId: null,
        warningThresholdHours: null,
        effectiveFrom: defaultReq?.effectiveFrom || TODAY,
        effectiveTo: null,
        active: true,
        version: defaultReq?.version || null,
      }

      if (defaultReq?.id) {
        await trainingApi.updateRequirement(defaultReq.id, defaultPayload)
      } else {
        await trainingApi.createRequirement(defaultPayload)
      }

      setMessage('Đã khôi phục cấu hình mặc định thành công!')
      setDeletedOverrideIds([])
      await fetchData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể khôi phục cấu hình mặc định'))
    } finally {
      setIsSaving(false)
    }
  }

  const breadcrumbs = [{ label: 'Yêu cầu' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="tr-page">
              {/* Title Card */}
              <div className="tr-title-card">
                <h1 className="tr-title">Cấu hình yêu cầu đào tạo</h1>
                <p className="tr-subtitle">
                  Thiết lập số giờ đào tạo tối thiểu theo chu kỳ, chức danh hoặc chuyên khoa
                </p>
              </div>

              {/* Feedback messages */}
              {errorMessage && (
                <div style={{ padding: '12px 16px', background: '#ffebeb', color: '#d32f2f', borderRadius: 8, fontSize: 13.5, fontWeight: 500 }}>
                  {errorMessage}
                </div>
              )}
              {message && (
                <div style={{ padding: '12px 16px', background: '#e8f5f0', color: '#0f6e56', borderRadius: 8, fontSize: 13.5, fontWeight: 500 }}>
                  {message}
                </div>
              )}

              {/* Main Configuration Card */}
              <div className="tr-config-card">
                {/* DEFAULT REQUIREMENT */}
                <div className="tr-config-section">
                  <h3 className="tr-section-label">YÊU CẦU MẶC ĐỊNH</h3>
                  
                  <div className="tr-default-row">
                    <div className="tr-default-info">
                      <div className="tr-default-title">Số giờ CME tối thiểu mỗi chu kỳ {defaultCycle} năm</div>
                      <div className="tr-default-desc">Áp dụng cho toàn bộ nhân viên trừ khi được ghi đè bên dưới</div>
                    </div>
                    <div className="tr-default-input-wrap">
                      <input
                        type="text"
                        className="tr-input-h"
                        value={hoursInputFocused ? defaultHours : `${defaultHours}h`}
                        onFocus={() => setHoursInputFocused(true)}
                        onBlur={() => setHoursInputFocused(false)}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '')
                          setDefaultHours(val ? Number(val) : '')
                        }}
                      />
                    </div>
                  </div>

                  <div className="tr-default-row">
                    <div className="tr-default-info">
                      <div className="tr-default-title">Thời hạn chu kỳ</div>
                    </div>
                    <div>
                      <select
                        className="tr-select-cycle"
                        value={defaultCycle}
                        onChange={(e) => setDefaultCycle(Number(e.target.value))}
                      >
                        <option value={1}>1 năm</option>
                        <option value={2}>2 năm</option>
                        <option value={3}>3 năm</option>
                        <option value={4}>4 năm</option>
                        <option value={5}>5 năm</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="tr-divider"></div>

                {/* OVERRIDE BY JOB POSITION */}
                <div className="tr-config-section">
                  <h3 className="tr-section-label">GHI ĐÈ THEO CHỨC DANH</h3>
                  
                  {isLoading ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                      Đang tải cấu hình...
                    </div>
                  ) : (
                    <div className="tr-table-wrap">
                      <table className="tr-table">
                        <thead>
                          <tr>
                            <th>Chức danh</th>
                            <th>Số giờ bắt buộc</th>
                            <th>Chu kỳ</th>
                            <th style={{ width: '100px', textAlign: 'center' }}>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overrides.length === 0 ? (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0' }}>
                                Chưa có cấu hình ghi đè nào.
                              </td>
                            </tr>
                          ) : (
                            overrides.map((item, index) => (
                              <tr key={item.id || index}>
                                <td style={{ fontWeight: 500 }}>{item.jobPositionName || item.name}</td>
                                <td style={{ fontWeight: 600 }}>{item.requiredHours}h</td>
                                <td>{item.cycleYears} năm</td>
                                <td>
                                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="tr-action-btn tr-action-btn--edit"
                                      onClick={() => handleEditOverride(item, index)}
                                      title="Chỉnh sửa"
                                    >
                                      <EditOutlined />
                                    </button>
                                    <button
                                      type="button"
                                      className="tr-action-btn tr-action-btn--delete"
                                      onClick={() => handleDeleteOverride(item, index)}
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
                    </div>
                  )}

                  <button
                    type="button"
                    className="tr-btn-add"
                    onClick={handleOpenAddModal}
                  >
                    + Thêm ghi đè
                  </button>
                </div>
              </div>

              {/* Bottom Save & Reset Actions */}
              <div className="tr-bottom-actions">
                <button
                  type="button"
                  className="tr-btn-save"
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
                <button
                  type="button"
                  className="tr-btn-reset"
                  onClick={handleResetToDefault}
                  disabled={isSaving}
                >
                  Thiết lập mặc định
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Override Modal */}
      {isModalOpen && (
        <div className="tr-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="tr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="tr-modal-title">
              {modalMode === 'add' ? 'Thêm cấu hình ghi đè' : 'Chỉnh sửa cấu hình ghi đè'}
            </h3>
            <form className="tr-modal-form" onSubmit={handleModalSubmit}>
              {modalMode === 'add' && (
                <div className="tr-modal-group">
                  <label>Chức danh *</label>
                  <select
                    className="tr-modal-select"
                    required
                    value={modalForm.jobPositionId}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, jobPositionId: e.target.value }))
                    }
                  >
                    <option value="">-- Chọn chức danh --</option>
                    {positions.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalMode === 'edit' && (
                <div className="tr-modal-group">
                  <label>Chức danh</label>
                  <input
                    type="text"
                    className="tr-modal-input"
                    disabled
                    value={
                      overrides[editingIndex]?.jobPositionName ||
                      overrides[editingIndex]?.name ||
                      ''
                    }
                  />
                </div>
              )}

              <div className="tr-modal-group">
                <label>Số giờ bắt buộc *</label>
                <input
                  type="number"
                  className="tr-modal-input"
                  min="0"
                  max="500"
                  required
                  value={modalForm.requiredHours}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, requiredHours: e.target.value }))
                  }
                />
              </div>

              <div className="tr-modal-group">
                <label>Chu kỳ (Năm) *</label>
                <select
                  className="tr-modal-select"
                  required
                  value={modalForm.cycleYears}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, cycleYears: Number(e.target.value) }))
                  }
                >
                  <option value={1}>1 năm</option>
                  <option value={2}>2 năm</option>
                  <option value={3}>3 năm</option>
                  <option value={4}>4 năm</option>
                  <option value={5}>5 năm</option>
                </select>
              </div>

              <div className="tr-modal-actions">
                <button type="submit" className="tr-modal-btn-submit">
                  Xác nhận
                </button>
                <button
                  type="button"
                  className="tr-modal-btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TrainingRequirementPage

