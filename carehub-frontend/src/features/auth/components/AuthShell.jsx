import SupportNotice from './SupportNotice.jsx'

function AuthShell({ children, showNotice = false }) {
  return (
    <main className="auth-page">
      <section className="auth-scene">
        <div className="background-art" aria-hidden="true">
          <div className="art art__stethoscope"></div>
          <div className="art art__paper"></div>
          <div className="art art__pen"></div>
          <div className="art art__bottle"></div>
        </div>
        {children}
        {showNotice && <SupportNotice />}
      </section>
    </main>
  )
}

export default AuthShell
