import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import TrainingGroupFormPage from './TrainingGroupFormPage'
import { SearchOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { trainingGroupApi } from '../api/trainingGroupApi.js'
import '../styles/TrainingGroupListPage.css'

function TrainingGroupListPage() {
  const { showToast } = useToast()
  const [groups, setGroups] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)

  const loadGroups = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await trainingGroupApi.list(keyword || undefined)
      const data = response?.data?.data
      setGroups(Array.isArray(data) ? data : [])
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể tải danh sách nhóm đào tạo', 'error')
      setGroups([])
    } finally {
      setIsLoading(false)
    }
  }, [showToast, keyword])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const filteredGroups = useMemo(() => groups, [groups])

  const pageSize = 10
  const totalElements = filteredGroups.length
  const totalPages = Math.ceil(totalElements / pageSize) || 1
  const displayRows = filteredGroups.slice(page * pageSize, (page + 1) * pageSize)

  const handleCreate = () => {
    setEditingGroup(null)
    setIsModalOpen(true)
  }

  const handleEdit = (group) => {
    setEditingGroup(group)
    setIsModalOpen(true)
  }

  const handleDelete = async (group) => {
    if (!window.confirm(`Bạn có chắc muốn xóa nhóm "${group.name}"?`)) return
    try {
      await trainingGroupApi.delete(group.id)
      showToast('Đã xóa nhóm đào tạo', 'success')
      loadGroups()
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể xóa nhóm đào tạo', 'error')
    }
  }

  const handleModalClose = (saved) => {
    setIsModalOpen(false)
    setEditingGroup(null)
    if (saved) loadGroups()
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader title="Nhóm đào tạo" />
        <div className="dashboard-layout__body">
          <div className="page-toolbar">
            <div className="page-toolbar__search">
              <SearchOutlined />
              <input
                type="text"
                placeholder="Tìm kiếm nhóm đào tạo..."
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setPage(0) }}
              />
            </div>
            <button className="btn btn--primary" onClick={handleCreate}>
              <PlusOutlined /> Tạo nhóm mới
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên nhóm</th>
                  <th>Mô tả</th>
                  <th>Số thành viên</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center">Đang tải...</td></tr>
                ) : displayRows.length === 0 ? (
                  <tr><td colSpan={5} className="text-center">Chưa có nhóm đào tạo nào</td></tr>
                ) : (
                  displayRows.map(group => (
                    <tr key={group.id}>
                      <td><strong>{group.name}</strong></td>
                      <td>{group.description || '—'}</td>
                      <td>{group.memberCount}</td>
                      <td>
                        <span className={`status-badge status-badge--${group.active ? 'active' : 'inactive'}`}>
                          {group.active ? 'Hoạt động' : 'Đã khóa'}
                        </span>
                      </td>
                      <td>
                        <button className="btn-icon" title="Sửa" onClick={() => handleEdit(group)}>
                          <EditOutlined />
                        </button>
                        <button className="btn-icon btn-icon--danger" title="Xóa" onClick={() => handleDelete(group)}>
                          <DeleteOutlined />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Trước</button>
              <span>Trang {page + 1} / {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Sau</button>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <TrainingGroupFormPage
          group={editingGroup}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}

export default TrainingGroupListPage
