import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
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
					}
				]
			},
			workbox: {
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
				globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'], // Remove .html from precache
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
	},
})
