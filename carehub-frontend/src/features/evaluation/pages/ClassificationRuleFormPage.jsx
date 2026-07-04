import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { WarningOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { classificationRuleApi } from '../api/classificationRuleApi.js'
import { questionCategoryApi } from '../api/questionCategoryApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/ClassificationRuleFormPage.css'

function ClassificationRuleFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { showToast } = useToast()
  const isEditMode = Boolean(id)

  // Form State
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [categoryId, setCategoryId] = useState('')
  const [keywords, setKeywords] = useState('')
  const [sourcePattern, setSourcePattern] = useState('')
  const [priority, setPriority] = useState(0)
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testText, setTestText] = useState('')
  const [testSource, setTestSource] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [isTesting, setIsTesting] = useState(false)

  // Load existing rule details if edit mode
  useEffect(() => {
    let ignore = false

    async function loadData() {
      setIsLoading(true)
      try {
        const [categoryResponse, ruleResponse] = await Promise.all([
          questionCategoryApi.listCategories({ status: 'ACTIVE' }),
          isEditMode ? classificationRuleApi.getRule(id) : Promise.resolve(null),
        ])
        const categoryList = apiData(categoryResponse, [])
        if (ignore) return
        setCategories(categoryList)
        if (!isEditMode && categoryList.length > 0) {
          setCategoryId(String(categoryList[0].id))
        }
        if (ruleResponse) {
          const rule = apiData(ruleResponse)
          setName(rule.name || '')
          setEnabled(rule.enabled !== false)
          setCategoryId(rule.categoryId ? String(rule.categoryId) : '')
          setKeywords(rule.keywords || '')
          setSourcePattern(rule.sourcePattern || '')
          setPriority(rule.priority || 0)
        }
      } catch (error) {
        if (!ignore) {
          showToast(apiErrorMessage(error), 'error')
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      ignore = true
    }
  }, [id, isEditMode, showToast])

  const handleSave = async (e) => {
    e.preventDefault()

    if (!name.trim()) {
      showToast('Vui lòng nhập tên quy tắc.', 'warning')
      return
    }

    if (!categoryId) {
      showToast('Vui lòng chọn danh mục câu hỏi.', 'warning')
      return
    }

    if (!keywords.trim()) {
      showToast('Vui lòng nhập từ khóa phân loại.', 'warning')
      return
    }

    const payload = {
      name: name.trim(),
      categoryId: Number(categoryId),
      keywords: keywords.trim(),
      sourcePattern: sourcePattern.trim(),
      priority: Number(priority) || 0,
      enabled,
    }

    setIsSaving(true)
    try {
      if (isEditMode) {
        await classificationRuleApi.updateRule(id, payload)
      } else {
        await classificationRuleApi.createRule(payload)
      }
      showToast(isEditMode ? 'Đã cập nhật quy tắc phân loại.' : 'Đã tạo quy tắc phân loại.', 'success')
      navigate('/admin/evaluation/classification-rules')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestRule = async () => {
    if (!testText.trim() && !testSource.trim()) {
      showToast('Nhập nội dung hoặc nguồn tài liệu để kiểm tra.', 'warning')
      return
    }
    setIsTesting(true)
    try {
      const response = await classificationRuleApi.testRule({
        stem: testText,
        sourceDocument: testSource,
      })
      setTestResult(apiData(response))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsTesting(false)
    }
  }

  const breadcrumbs = [
    { label: 'Quy tắc phân loại', path: '/admin/evaluation/classification-rules' },
    { label: isEditMode ? 'Chỉnh sửa' : 'Tạo mới' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="crf-page">
              <div className="crf-container">
                {/* Header */}
                <div className="crf-header">
                  <h2 className="crf-title">
                    {isEditMode ? 'Cập nhật quy tắc phân loại' : 'Thêm quy tắc phân loại'}
                  </h2>
                  <p className="crf-subtitle">
                    Gán danh mục câu hỏi tự động theo từ khóa, nguồn tài liệu và mức ưu tiên
                  </p>
                </div>

                <form onSubmit={handleSave} className="crf-form">
                  {/* Row 1 */}
                  <div className="crf-form-row">
                    <div className="crf-form-group">
                      <label>
                        Tên quy tắc <span className="crf-required-star">*</span>
                      </label>
                      <input
                        type="text"
                        className="crf-input-red"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ví dụ: Nhận diện người bệnh"
                        disabled={isLoading || isSaving}
                      />
                    </div>
                    <div className="crf-form-group">
                      <label>
                        Danh mục câu hỏi <span className="crf-required-star">*</span>
                      </label>
                      <select
                        className="crf-input-red"
                        required
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        disabled={isLoading || isSaving}
                      >
                        <option value="">Chọn danh mục</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="crf-form-row">
                    <div className="crf-form-group">
                      <label>
                        Từ khóa phân loại <span className="crf-required-star">*</span>
                      </label>
                      <textarea
                        className="crf-input-red"
                        required
                        rows={4}
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="Mỗi dòng hoặc dấu phẩy là một từ khóa. Ví dụ: nhận diện, vòng tay, mã người bệnh"
                        disabled={isLoading || isSaving}
                      />
                    </div>
                    <div className="crf-form-group">
                      <label>Nguồn tài liệu</label>
                      <textarea
                        className="crf-input-red"
                        rows={4}
                        value={sourcePattern}
                        onChange={(e) => setSourcePattern(e.target.value)}
                        placeholder="Ví dụ: an toàn người bệnh, quy trình nhận diện"
                        disabled={isLoading || isSaving}
                      />
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="crf-form-row">
                    <div className="crf-form-group">
                      <label>Ưu tiên</label>
                      <input
                        type="number"
                        className="crf-input-red"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        placeholder="Số lớn hơn được ưu tiên trước"
                        disabled={isLoading || isSaving}
                      />
                    </div>
                    <div className="crf-form-group">
                      <label>Trạng thái</label>
                      <select
                        className="crf-input-red"
                        value={enabled.toString()}
                        onChange={(e) => setEnabled(e.target.value === 'true')}
                        disabled={isLoading || isSaving}
                      >
                        <option value="true">Hoạt động</option>
                        <option value="false">Tạm ngưng</option>
                      </select>
                    </div>
                  </div>

                  <div className="crf-section-divider">
                    <span className="crf-divider-title">KIỂM TRA NHANH</span>
                  </div>

                  <div className="crf-form-row">
                    <div className="crf-form-group">
                      <label>Nội dung câu hỏi thử</label>
                      <textarea
                        className="crf-input-red"
                        rows={3}
                        value={testText}
                        onChange={(e) => setTestText(e.target.value)}
                        placeholder="Dán nội dung câu hỏi hoặc trích đoạn nguồn..."
                      />
                    </div>
                    <div className="crf-form-group">
                      <label>Nguồn tài liệu thử</label>
                      <input
                        type="text"
                        className="crf-input-red"
                        value={testSource}
                        onChange={(e) => setTestSource(e.target.value)}
                        placeholder="Tên tài liệu hoặc section"
                      />
                    </div>
                  </div>

                  <div className="crf-form-actions" style={{ justifyContent: 'flex-start' }}>
                    <button type="button" className="crf-btn-cancel" onClick={handleTestRule} disabled={isTesting}>
                      {isTesting ? 'Đang kiểm tra...' : 'Kiểm tra'}
                    </button>
                  </div>

                  {testResult && (
                    <div className="crf-preview-card">
                      <span className="crf-preview-desc">
                        Kết quả: {testResult.categoryName || 'Chưa phân loại'}
                      </span>
                      <span className="crf-result-badge">
                        {testResult.ruleName || 'Không khớp'}
                      </span>
                      <span className="crf-preview-desc">
                        Độ tin cậy: {Math.round(Number(testResult.confidence || 0) * 100)}% · {testResult.reason}
                      </span>
                    </div>
                  )}

                  {/* Warning Box */}
                  <div className="crf-warning-card">
                    <span className="crf-warning-icon">
                      <WarningOutlined />
                    </span>
                    <span className="crf-warning-text">
                      Quy tắc hoạt động sẽ được dùng để gợi ý danh mục cho câu hỏi mới và candidate được lưu vào ngân hàng.
                    </span>
                  </div>

                  {/* Actions Footer */}
                  <div className="crf-form-actions">
                    <button type="submit" className="crf-btn-save" disabled={isLoading || isSaving}>
                      {isSaving ? 'Đang lưu...' : 'Lưu quy tắc'}
                    </button>
                    <button
                      type="button"
                      className="crf-btn-cancel"
                      onClick={() => navigate('/admin/evaluation/classification-rules')}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ClassificationRuleFormPage
