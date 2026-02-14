import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { ScrollProvider } from './context/ScrollContext'
import './styles/global.css'
import { BrowserRouter } from 'react-router-dom'

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
