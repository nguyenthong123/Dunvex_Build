import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'
import { devApiPlugin } from './vite-api-dev'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		devApiPlugin(), // 🔐 Xử lý /api/gemini-proxy và /api/gemini-vision trong dev mode
		tailwindcss(),
		VitePWA({
			registerType: 'prompt',
			includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
			manifest: {
				name: 'Dunvex Build Management',
				short_name: 'DunvexBuild',
				description: 'Quản lý doanh nghiệp xây dựng & VLXD chuyên nghiệp',
				theme_color: '#1A237E',
				background_color: '#f8f9fb',
				display: 'standalone',
				orientation: 'portrait',
				icons: [
					{
						src: '/dv_icon.svg',
						sizes: '192x192',
						type: 'image/svg+xml'
					},
					{
						src: '/dv_icon.svg',
						sizes: '512x512',
						type: 'image/svg+xml'
					},
					{
						src: '/icon-192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/icon-512.png',
						sizes: '512x512',
						type: 'image/png'
					}
				]
			},
			workbox: {
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
				skipWaiting: true,
				clientsClaim: true,
				globPatterns: ['**/*.{js,css,ico,png,svg,woff2,html}'], // Precache html to avoid navigation errors
				runtimeCaching: [
					{
						urlPattern: ({ request }) => request.mode === 'navigate',
						handler: 'NetworkFirst',
						options: {
							cacheName: 'pages-cache',
							expiration: {
								maxEntries: 1,
							},
						},
					},
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					}
				]
			}
		})
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	build: {
		sourcemap: false,
		minify: 'esbuild',
		esbuild: {
			drop: ['console', 'debugger'],
		},
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			output: {
				manualChunks: {
					'vendor-react': ['react', 'react-dom', 'react-router-dom'],
					'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
					'vendor-ui': ['lucide-react', 'framer-motion'],
					'vendor-map': ['leaflet', 'react-leaflet'],
					'vendor-xlsx': ['xlsx'],
					'vendor-qrcode': ['html5-qrcode']
				}
			}
		}
	},
})
