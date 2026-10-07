import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import { VitePWA } from 'vite-plugin-pwa'

const webManifestPath = path.resolve(__dirname, './server/releases/web.json');
const webManifest = fs.existsSync(webManifestPath)
	? JSON.parse(fs.readFileSync(webManifestPath, 'utf8'))
	: { buildNumber: 1, version: '1.0.1' };

// https://vitejs.dev/config/
export default defineConfig({
	define: {
		'__APP_BUILD_INFO__': JSON.stringify({
			version: process.env.APP_VERSION || webManifest.version || '1.0.1',
			buildNumber: Number(process.env.APP_BUILD_NUMBER) || Number(process.env.WEB_BUILD_NUMBER) || webManifest.buildNumber || 1,
			builtAt: new Date().toISOString()
		})
	},
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: 'autoUpdate',
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
				skipWaiting: true,
				clientsClaim: true,
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
					},
					{
						urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif)$/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'images-cache',
							expiration: {
								maxEntries: 500,
								maxAgeSeconds: 60 * 60 * 24 * 60 // 60 days
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					},
					{
						urlPattern: /^https?:\/\/.*\/(?:uploads|images|api\/image-proxy).*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'product-uploads-cache',
							expiration: {
								maxEntries: 500,
								maxAgeSeconds: 60 * 60 * 24 * 60 // 60 days
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
	esbuild: {
		drop: ['debugger'],
		pure: ['console.log', 'console.debug']
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:5000',
				changeOrigin: true
			}
		}
	},
	build: {
		sourcemap: false,
		minify: 'esbuild',
		modulePreload: false,
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			output: {
				manualChunks: {
					'vendor-react': ['react', 'react-dom', 'react-router-dom'],
					'vendor-ui': ['lucide-react', 'framer-motion'],
					'vendor-map': ['leaflet', 'react-leaflet'],
					'vendor-xlsx': ['xlsx'],
					'vendor-qrcode': ['html5-qrcode']
				}
			}
		}
	},
})
