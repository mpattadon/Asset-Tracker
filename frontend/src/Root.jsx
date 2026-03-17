import { useEffect, useState } from 'react'
import App from './App.jsx'

export default function Root() {
  const [hideHeader, setHideHeader] = useState(false)

  useEffect(() => {
    let last = 0
    const onScroll = () => {
      const y = window.scrollY
      if (y > last + 10) {
        setHideHeader(true)
      } else if (y < last - 10 || y < 50) {
        setHideHeader(false)
      }
      last = y
    }

    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return <App hideHeader={hideHeader} />
}
