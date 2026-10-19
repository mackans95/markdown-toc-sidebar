// Builds src/ into dist/ with esbuild. `node scripts/build.mjs --watch` rebuilds on every change.
// Type checking is separate (npm run typecheck): esbuild only strips the types.
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

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
};

// tasks.json waits for these lines before starting a debug session.
/** @type {esbuild.Plugin} */
const watchLog = {
	name: 'watch-log',
	setup(build) {
		build.onStart(() => console.log('[watch] build started'));
		build.onEnd(result => {
			for (const { text, location } of [...result.errors, ...result.warnings]) {
				console.error(`✘ ${location?.file}:${location?.line}:${location?.column}: ${text}`);
			}
			console.log('[watch] build finished');
		});
	},
};

if (watch) {
	const context = await esbuild.context({ ...extension, plugins: [watchLog] });
	await context.watch();
} else {
	await esbuild.build(extension);
}
