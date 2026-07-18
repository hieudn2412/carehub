import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examConfigApi } from '../api/examConfigApi.js'
import { examPaperApi } from '../api/examPaperApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

function ExamPaperGeneratePage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [configs, setConfigs] = useState([])
  const [examConfigId, setExamConfigId] = useState('')
  const [namePrefix, setNamePrefix] = useState('')
  const [variantCount, setVariantCount] = useState(1)
  const [randomSeed, setRandomSeed] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const loadConfigs = useCallback(async () => {
    try {
      const response = await examConfigApi.listExamConfigs({ status: 'ACTIVE' })
      const activeConfigs = apiData(response, [])
      setConfigs(activeConfigs)
      if (activeConfigs.length > 0) {
        setExamConfigId(String(activeConfigs[0].id))
        setNamePrefix(activeConfigs[0].name)
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }, [showToast])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  async function generate(event) {
    event.preventDefault()
    if (!examConfigId) {
      showToast('Vui lòng chọn cấu hình đề kiểm tra đang hoạt động.', 'warning')
      return
    }
    setIsGenerating(true)
    try {
      const response = await examPaperApi.generateExamPapers({
        examConfigId: Number(examConfigId),
        namePrefix: namePrefix.trim(),
        variantCount: Number(variantCount) || 1,
        randomSeed: randomSeed ? Number(randomSeed) : null,
      })
      const generated = apiData(response, [])
      showToast(`Đã sinh ${generated.length} bộ đề kiểm tra.`, 'success')
      navigate(generated[0]?.id ? `/admin/evaluation/exam-papers/${generated[0].id}` : '/admin/evaluation/exam-papers')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const selectedConfig = configs.find((item) => String(item.id) === String(examConfigId))
  const breadcrumbs = [
    { label: 'Bộ đề kiểm tra', path: '/admin/evaluation/exam-papers' },
    { label: 'Sinh bộ đề' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="exp-page">
              <div className="exp-title-card">
                <div>
                  <h1 className="exp-title">Sinh bộ đề kiểm tra</h1>
                  <p className="exp-subtitle">Tạo đề cố định từ cấu hình đang hoạt động và snapshot câu hỏi tại thời điểm sinh</p>
                </div>
              </div>

              <form className="exp-form-card" onSubmit={generate}>
                <label>
                  <span>Cấu hình đề kiểm tra</span>
                  <select value={examConfigId} onChange={(event) => {
                    setExamConfigId(event.target.value)
                    const config = configs.find((item) => String(item.id) === String(event.target.value))
                    if (config) setNamePrefix(config.name)
                  }}>
                    <option value="">Chọn cấu hình</option>
                    {configs.map((config) => (
                      <option key={config.id} value={config.id}>{config.name}</option>
                    ))}
                  </select>
                </label>

                {selectedConfig && (
                  <div className="exp-info-strip">
                    <span>{selectedConfig.totalQuestions} câu</span>
                    <span>{selectedConfig.timeLimitMinutes} phút</span>
                    <span>Đạt {selectedConfig.passingScore}%</span>
                    <span>{selectedConfig.questionSetName}</span>
                  </div>
                )}

                <label>
                  <span>Tiền tố tên đề</span>
                  <input value={namePrefix} onChange={(event) => setNamePrefix(event.target.value)} placeholder="Nhập tiền tố tên đề" />
                </label>

                <label>
                  <span>Số mã đề</span>
                  <input type="number" min="1" max="10" value={variantCount} onChange={(event) => setVariantCount(event.target.value)} />
                </label>

                <label>
                  <span>Mầm ngẫu nhiên</span>
                  <input type="number" value={randomSeed} onChange={(event) => setRandomSeed(event.target.value)} placeholder="Bỏ trống để hệ thống tự tạo" />
                </label>

                <div className="exp-form-actions">
                  <button type="button" className="exp-btn-secondary" onClick={() => navigate('/admin/evaluation/exam-papers')}>Hủy</button>
                  <button type="submit" className="exp-btn-primary" disabled={isGenerating}>{isGenerating ? 'Đang sinh...' : 'Sinh bộ đề'}</button>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ExamPaperGeneratePage
