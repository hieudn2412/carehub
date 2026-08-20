const loadAuthStyles = () => import('../features/auth/styles/auth.css')

export async function prepareCriticalStyles(loader = loadAuthStyles) {
  try {
    await loader()
    return true
  } catch {
    // Không chặn toàn bộ ứng dụng nếu CDN/static host tạm thời lỗi một asset.
    // Giá trị false giúp kiểm thử và theo dõi trạng thái tải style rõ ràng.
    return false
  }
}
