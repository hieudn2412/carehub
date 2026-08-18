import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getDocumentTitle } from './pageTitles.js'

function PageMetadata() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    document.title = getDocumentTitle(pathname, search)
  }, [pathname, search])

  return null
}

export default PageMetadata
