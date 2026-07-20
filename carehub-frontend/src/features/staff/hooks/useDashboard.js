import { useEffect, useState } from 'react'
import { myExamApi } from '../../evaluation/api/myExamApi.js'
import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const token = tokenStorage.getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'vừa xong'
  if (diffMin < 60) return `${diffMin} phút`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} giờ`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay} ngày`
  const diffMonth = Math.floor(diffDay / 30)
  return `${diffMonth} tháng`
}

const ACTIVITY_TYPE_MAP = {
  EXAM_PASSED: 'EXAM_COMPLETED',
  EXAM_ASSIGNED: 'EXAM_COMPLETED',
  CME_HOURS_BELOW_REQUIREMENT: 'UPLOAD',
  PERSONAL_COMPLIANCE_ISSUE: 'UPLOAD',
}

export function useDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const headers = authHeaders()

        const [assignRes, attemptsRes, notifRes] = await Promise.all([
          myExamApi.listAssignments().catch(() => ({ data: { data: { content: [] } } })),
          myExamApi.listAttempts().catch(() => ({ data: { data: { content: [] } } })),
          httpClient.get('/me/notifications', { headers, params: { page: 0, size: 10 } }).catch(() => ({ data: { data: { content: [] } } })),
        ])

        if (cancelled) return

        // Parse assignments
        const assignments = assignRes.data?.data?.content || assignRes.data?.data || []
        const openAssignments = Array.isArray(assignments)
          ? assignments.filter(a => a.status === 'OPEN')
          : []

        // Parse attempts
        const attempts = attemptsRes.data?.data?.content || attemptsRes.data?.data || []
        const attemptList = Array.isArray(attempts) ? attempts : []
        const gradedAttempts = attemptList.filter(a => a.status === 'GRADED' || a.status === 'SUBMITTED')
        const avgScore = gradedAttempts.length > 0
          ? Math.round(gradedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / gradedAttempts.length)
          : 0
        const totalExamsDone = gradedAttempts.length
        const passedExams = gradedAttempts.filter(a => a.passed === true).length
        const failedExams = gradedAttempts.filter(a => a.passed === false).length

        // Parse notifications → activities
        const notifications = notifRes.data?.data?.content || notifRes.data?.data || []
        const notifList = Array.isArray(notifications) ? notifications : []
        const activities = notifList.slice(0, 5).map(n => ({
          id: n.id,
          type: ACTIVITY_TYPE_MAP[n.eventType] || 'LOGIN',
          description: n.content || n.title || '',
          timeAgo: timeAgo(n.createdAt),
        }))

        // Upcoming exams from open assignments
        const upcomingExams = openAssignments.slice(0, 4).map(a => ({
          id: a.id,
          title: a.examPaperName || a.name || '',
          startDate: a.createdAt || '',
          dueDate: a.dueAt || '',
        }))

        setData({
          summary: {
            pendingExams: openAssignments.length,
            avgScore,
            totalExamsDone,
            passedExams,
            failedExams,
            examPassRate: gradedAttempts.length ? passedExams * 100 / gradedAttempts.length : 0,
          },
          upcomingExams,
          activities,
        })
        setError(null)
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading dashboard data', err)
          setError(err.message || 'Đã xảy ra lỗi khi tải dữ liệu')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}
