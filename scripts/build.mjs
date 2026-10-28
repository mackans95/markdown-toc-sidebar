// Builds src/ into dist/ with esbuild. `node scripts/build.mjs --watch` rebuilds on every change.
// Type checking is separate (npm run typecheck): esbuild only strips the types.
import * as esbuild from 'esbuild'

const watch = process.argv.includes('--watch')

/** @type {esbuild.BuildOptions} */
const extension = {
	entryPoints: ['src/extension.ts'],
	outfile: 'dist/extension.js',
	bundle: true,
	// Also loaded by VS Code for the Web, which supports CommonJS extensions too.
	format: 'cjs',
	// VS Code 1.82 (package.json engines) runs extensions on Node 18.
	platform: 'node',
	target: 'node18',
	external: ['vscode'],
	// Readable in the published package; source maps only while developing.
	sourcemap: watch,
	// While watching, watchLog below reports problems in the one-line format tasks.json reads.
	logLevel: watch ? 'silent' : 'warning',
}

// The scripts package.json adds to the Markdown preview. The preview loads each as a plain
// <script>, which can't import anything, so each one becomes a single self-contained file.
/** @type {esbuild.BuildOptions} */
const preview = {
	entryPoints: {
		'smooth-scroll-sync': 'src/preview/smooth-scroll-sync.ts',
		toc: 'src/preview/toc/index.ts',
		'scroll-restore': 'src/preview/scroll-restore.ts',
	},
	outdir: 'dist/preview',
	bundle: true,
	format: 'iife',
	platform: 'browser',
	// VS Code 1.82's webviews run Chromium 114 (Electron 25).
	target: 'chrome114',
	sourcemap: watch,
	logLevel: watch ? 'silent' : 'warning',
}

// tasks.json waits for these lines before starting a debug session. With several builds running
// at once, only the first start and the last finish are logged.
let running = 0
/** @type {esbuild.Plugin} */
const watchLog = {
	name: 'watch-log',
	setup(build) {
		build.onStart(() => {
			if (running++ === 0) {
				console.log('[watch] build started')
			}
		})
		build.onEnd(result => {
			for (const { text, location } of [...result.errors, ...result.warnings]) {
				console.error(`✘ ${location?.file}:${location?.line}:${location?.column}: ${text}`)
			}
			if (--running === 0) {
				console.log('[watch] build finished')
			}
		})
	},
}

const builds = [extension, preview]
if (watch) {
	for (const options of builds) {
		const context = await esbuild.context({ ...options, plugins: [watchLog] })
		await context.watch()
	}
} else {
	await Promise.all(builds.map(options => esbuild.build(options)))
}
