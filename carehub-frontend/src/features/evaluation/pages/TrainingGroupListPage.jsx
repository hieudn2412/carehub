import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../../../shared/components/AppShell.jsx'
import TrainingGroupFormPage from './TrainingGroupFormPage'
import { SearchOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import ConfirmDialog from '../../../shared/components/ConfirmDialog.jsx'
import { trainingGroupApi } from '../api/trainingGroupApi.js'

function TrainingGroupListPage() {
  const { showToast } = useToast()
  const [groups, setGroups] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

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

  const confirmDelete = async () => {
    const group = deleteTarget
    setDeleteTarget(null)
    if (!group) return
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
    <AppShell title="Nhóm đào tạo">
      <div className="ch-toolbar">
        <div className="ch-search">
          <SearchOutlined />
          <input
            type="text"
            placeholder="Tìm kiếm nhóm đào tạo..."
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(0) }}
          />
        </div>
        <button className="ch-btn ch-btn--primary" onClick={handleCreate}>
          <PlusOutlined /> Tạo nhóm mới
        </button>
      </div>

      <div className="ch-table-wrap">
        <table className="ch-table">
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
              <tr><td colSpan={5} className="ch-empty">Đang tải...</td></tr>
            ) : displayRows.length === 0 ? (
              <tr><td colSpan={5} className="ch-empty">Chưa có nhóm đào tạo nào</td></tr>
            ) : (
              displayRows.map(group => (
                <tr key={group.id}>
                  <td><strong>{group.name}</strong></td>
                  <td>{group.description || '—'}</td>
                  <td>{group.memberCount}</td>
                  <td>
                    <span className={`ch-badge ch-badge--${group.active ? 'green' : 'neutral'}`}>
                      {group.active ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td>
                    <button className="ch-btn-icon" title="Sửa" aria-label="Sửa nhóm" onClick={() => handleEdit(group)}>
                      <EditOutlined />
                    </button>
                    <button className="ch-btn-icon ch-btn-icon--danger" title="Xóa" aria-label="Xóa nhóm" onClick={() => setDeleteTarget(group)}>
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
        <div className="ch-pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Trước</button>
          <span>Trang {page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Sau</button>
        </div>
      )}

      {isModalOpen && (
        <TrainingGroupFormPage
          group={editingGroup}
          onClose={handleModalClose}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Xóa nhóm đào tạo"
          message={`Bạn có chắc muốn xóa nhóm "${deleteTarget.name}"?`}
          confirmLabel="Xóa"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AppShell>
  )
}

export default TrainingGroupListPage
