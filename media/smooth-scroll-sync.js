// Runs inside VS Code's built-in Markdown preview webview.
// The preview follows the editor by jumping straight to a new position (at most ~20 times a second),
// which looks jumpy. This intercepts those sync jumps and glides to the target instead.
(function () {
	if (window.__mdTocSmoothSyncInitialized) {
		return;
	}
	window.__mdTocSmoothSyncInitialized = true;

	// window.scroll calls this soon after an 'updateView' message are the preview following the editor.
	const SYNC_WINDOW_MS = 200;
	// Fraction of the remaining distance covered per 60fps frame.
	const EASING = 0.3;
	// Lets other preview scripts (the TOC) react to positions we hide from the preview's own handler.
	const SCROLL_EVENT = 'md-toc-sidebar:synced-scroll';

	const nativeScrollTo = window.scrollTo.bind(window);
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	let syncUntil = 0;
	let target = null;
	let position = 0;
	let frame = 0;
	let lastTime = 0;
	let suppressScrollEvents = false;

	// Capture phase so this runs before the preview's own message handler performs the jump.
	window.addEventListener('message', event => {
		if (event.data && event.data.type === 'updateView') {
			syncUntil = performance.now() + SYNC_WINDOW_MS;
		}
	}, true);

	function intercept(native) {
		return function (x, y) {
			const isSyncJump = performance.now() <= syncUntil && typeof x === 'number' && typeof y === 'number';
			if (!isSyncJump || reducedMotion.matches) {
				stop();
				return native.apply(window, arguments);
			}
			glideTo(y);
		};
	}
	window.scroll = intercept(window.scroll.bind(window));
	window.scrollTo = intercept(nativeScrollTo);

	function maxScroll() {
		return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
	}

	function glideTo(y) {
		if (target === null) {
			position = window.scrollY;
			lastTime = performance.now();
		}
		target = Math.min(Math.max(0, y), maxScroll());
		suppressScrollEvents = true;
		if (!frame) {
			frame = requestAnimationFrame(step);
		}
	}

	function step(now) {
		frame = 0;
		if (target === null) {
			return;
		}
		const elapsedFrames = Math.min(4, (now - lastTime) / (1000 / 60));
		lastTime = now;
		const remaining = target - position;
		if (Math.abs(remaining) < 1) {
			position = target;
			target = null;
		} else {
			position += remaining * (1 - Math.pow(1 - EASING, elapsedFrames));
		}
		nativeScrollTo({ left: window.scrollX, top: position, behavior: 'instant' });
		window.dispatchEvent(new Event(SCROLL_EVENT));

		if (target !== null) {
			frame = requestAnimationFrame(step);
		} else {
			// The scroll event for this last position fires before the next frame's callbacks.
			requestAnimationFrame(() => {
				if (target === null) {
					suppressScrollEvents = false;
				}
			});
		}
	}

	function stop() {
		cancelAnimationFrame(frame);
		frame = 0;
		target = null;
		suppressScrollEvents = false;
	}

	// While gliding, hide the intermediate scroll events from the preview's own scroll handler.
	// Otherwise it would report each in-between position back to the editor and the two would fight.
	window.addEventListener('scroll', event => {
		if (suppressScrollEvents) {
			event.stopImmediatePropagation();
		}
	}, true);

	// The user taking over the preview cancels the glide immediately.
	for (const type of ['wheel', 'touchstart', 'keydown', 'mousedown']) {
		window.addEventListener(type, stop, { capture: true, passive: true });
	}
})();
