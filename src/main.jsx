import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { getRouterBasename } from './lib/appRoutes'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={getRouterBasename()}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
