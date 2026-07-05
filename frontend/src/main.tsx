import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'  // Если в index.css остались переменные и медиа-запросы
import './global.css' // Этот файл должен перезаписывать index.css
import './global.css'


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
