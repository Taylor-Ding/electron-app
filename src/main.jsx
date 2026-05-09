import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// 本地字体（替代 Google Fonts 在线导入）
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
