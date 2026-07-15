import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SaveOutlined, ArrowLeftOutlined, CloseOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { promptTemplateApi } from '../api/promptTemplateApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/TestConfigPage.css'

function PromptTemplateFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isEditMode = !!id

  const [form, setForm] = useState({
    name: '',
    provider: 'deepseek',
    model: '',
    description: '',
    systemPrompt: '',
    userPromptTemplate: '',
    temperature: 0.2,
    maxTokens: 1800,
  })
  const [loading, setLoading] = useState(isEditMode)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEditMode) {
      setLoading(true)
      promptTemplateApi.get(id)
        .then(res => {
          const t = apiData(res, null)
          if (t) {
            setForm({
              name: t.name || '',
              provider: t.provider || 'deepseek',
              model: t.model || '',
              description: t.description || '',
              systemPrompt: t.systemPrompt || '',
              userPromptTemplate: t.userPromptTemplate || '',
              temperature: t.temperature ?? 0.2,
              maxTokens: t.maxTokens ?? 1800,
            })
          }
        })
        .catch(err => showToast(apiErrorMessage(err), 'error'))
        .finally(() => setLoading(false))
    }
  }, [id, isEditMode, showToast])

  const validate = () => {
    if (!form.name.trim()) { showToast('Vui lòng nhập tên prompt template.', 'warning'); return false }
    if (!form.provider.trim()) { showToast('Vui lòng chọn provider.', 'warning'); return false }
    if (!form.model.trim()) { showToast('Vui lòng nhập model.', 'warning'); return false }
    if (!form.userPromptTemplate.trim()) { showToast('Vui lòng nhập user prompt template.', 'warning'); return false }
    return true
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        provider: form.provider,
        model: form.model,
        description: form.description || null,
        systemPrompt: form.systemPrompt || null,
        userPromptTemplate: form.userPromptTemplate,
        temperature: form.temperature !== '' ? Number(form.temperature) : null,
        maxTokens: form.maxTokens !== '' ? Number(form.maxTokens) : null,
      }
      if (isEditMode) {
        await promptTemplateApi.activate(id)
      } else {
        await promptTemplateApi.create(payload)
      }
      showToast(isEditMode ? 'Kích hoạt prompt template thành công!' : 'Tạo prompt template thành công!', 'success')
      navigate('/admin/evaluation/prompt-templates')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-layout">
        <AdminSidebar />
        <div className="dashboard-layout__content">
          <AdminHeader breadcrumbs={[{ label: 'Prompt Templates' }]} />
          <div className="dashboard-root"><main className="dashboard-body"><div className="evd-page"><section className="evd-panel evd-empty">Đang tải...</section></div></main></div>
        </div>
      </div>
    )
  }

  const breadcrumbs = [
    { label: 'Prompt Templates', link: '/admin/evaluation/prompt-templates' },
    { label: isEditMode ? 'Chỉnh sửa' : 'Tạo mới' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="evd-page">
              <section className="evd-title-card">
                <div>
                  <h1>{isEditMode ? 'Chỉnh sửa Prompt Template' : 'Tạo Prompt Template mới'}</h1>
                  <p>Định nghĩa prompt template cho AI question generation</p>
                </div>
              </section>

              <section className="evd-panel">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Tên template <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="VD: docgen-mvp-flash-v1"
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Provider <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={form.provider}
                      onChange={e => setForm({ ...form, provider: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, background: '#fff' }}
                    >
                      <option value="deepseek">DeepSeek</option>
                      <option value="openai">OpenAI</option>
                      <option value="gemini">Gemini</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Model <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      value={form.model}
                      onChange={e => setForm({ ...form, model: e.target.value })}
                      placeholder="VD: deepseek-chat"
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Mô tả
                    </label>
                    <input
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="Mô tả ngắn về prompt này"
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Temperature
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="2"
                      value={form.temperature}
                      onChange={e => setForm({ ...form, temperature: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      step="100"
                      min="100"
                      max="8000"
                      value={form.maxTokens}
                      onChange={e => setForm({ ...form, maxTokens: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    System Prompt
                  </label>
                  <textarea
                    value={form.systemPrompt}
                    onChange={e => setForm({ ...form, systemPrompt: e.target.value })}
                    placeholder="Hướng dẫn hệ thống cho AI..."
                    rows={6}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'monospace' }}
                  />
                </div>

                <div style={{ marginBottom: 28 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    User Prompt Template <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    value={form.userPromptTemplate}
                    onChange={e => setForm({ ...form, userPromptTemplate: e.target.value })}
                    placeholder="Template cho user prompt, có thể chứa các placeholder như {{chunk_content}}..."
                    rows={8}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'monospace' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button type="button" className="evd-btn" onClick={() => navigate('/admin/evaluation/prompt-templates')} disabled={saving}>
                    <CloseOutlined /> Huỷ bỏ
                  </button>
                  <button type="button" className="evd-btn evd-btn--primary" onClick={handleSave} disabled={saving}>
                    <SaveOutlined /> {saving ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Tạo mới'}
                  </button>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default PromptTemplateFormPage
