import { HeartFilled } from '@ant-design/icons'

function BrandLogo() {
  return (
    <div className="brand-logo" aria-label="CareHub">
      <div className="brand-logo__ring">
        <HeartFilled />
      </div>
      <span>CAREHUB</span>
    </div>
  )
}

export default BrandLogo
