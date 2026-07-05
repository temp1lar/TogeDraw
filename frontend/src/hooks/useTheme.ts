import { useState, useEffect } from 'react'

export function useTheme() {
  const [isLight, setIsLight] = useState(() => {
    return localStorage.getItem('theme') === 'light'
  })

  useEffect(() => {
    document.body.classList.toggle('light-theme', isLight)
    localStorage.setItem('theme', isLight ? 'light' : 'dark')
  }, [isLight])

  const toggle = () => setIsLight(!isLight)

  return { isLight, toggle }
}