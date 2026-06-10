import logoImage from '../../assets/logo.png'

function BrandLogo() {
  return (
    <div className="brand-logo" aria-label="CareHub">
      <img src={logoImage} alt="CareHub" />
    </div>
  )
}

export default BrandLogo
