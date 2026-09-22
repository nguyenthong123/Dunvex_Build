import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { ScrollProvider } from './context/ScrollContext'
import './styles/global.css'
import { BrowserRouter } from 'react-router-dom'

// 🔒 Bảo mật: Tắt toàn bộ console logs & warns trên môi trường Production
if (import.meta.env.PROD) {
	console.log = () => {};
	console.info = () => {};
	console.debug = () => {};
	console.warn = () => {};
}

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ThemeProvider>
			<ScrollProvider>
				<BrowserRouter>
					<App />
				</BrowserRouter>
			</ScrollProvider>
		</ThemeProvider>
	</React.StrictMode>,
)
