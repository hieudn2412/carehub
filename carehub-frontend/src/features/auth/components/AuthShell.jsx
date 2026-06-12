import SupportNotice from './SupportNotice.jsx'

function AuthShell({ children, showNotice = false }) {
  return (
    <main className="auth-page">
      <section className="auth-scene">
        {children}
        {showNotice && <SupportNotice />}
      </section>
    </main>
  )
}

export default AuthShell
