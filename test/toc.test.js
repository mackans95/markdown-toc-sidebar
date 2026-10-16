const { ancestorIndices, buildEntries, focusTarget, hasChildren, hiddenIndices, storeCollapsed } = require('../media/toc');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

function levels(...ls) {
	return ls.map(level => ({ level }));
}

function depths(...ls) {
	return buildEntries(levels(...ls)).map(e => e.depth);
}

function levelsShown(maxDepth, ...ls) {
	return buildEntries(levels(...ls), { maxDepth }).map(e => e.level);
}

// The title as 'title', every other entry as its depth.
function shape(options, ...ls) {
	return buildEntries(levels(...ls), options).map(e => (e.isTitle ? 'title' : e.depth));
}

// The title as 'title', every other entry as its number.
function numbers(options, ...ls) {
	return buildEntries(levels(...ls), { numbering: true, ...options }).map(e => (e.isTitle ? 'title' : e.number));
}

describe('ancestorIndices', () => {
	// 0 h1
	// 1   h2
	// 2     h3
	// 3   h2
	// 4     h3
	const sample = levels(1, 2, 3, 2, 3);

	test('finds the enclosing sections', () => {
		assert.deepEqual(ancestorIndices(sample, 4), new Set([3, 0]));
	});
	test('is empty for the first entry', () => {
		assert.deepEqual(ancestorIndices(sample, 0), new Set());
	});
	test('skips siblings', () => {
		assert.deepEqual(ancestorIndices(sample, 3), new Set([0]));
	});
	test('follows the chain up to the top', () => {
		assert.deepEqual(ancestorIndices(levels(1, 2, 3, 4), 3), new Set([2, 1, 0]));
	});
	test('treats a skipped level as a direct parent', () => {
		assert.deepEqual(ancestorIndices(levels(2, 4), 1), new Set([0]));
	});
	test('walks to the top when there is no h1', () => {
		assert.deepEqual(ancestorIndices(levels(2, 3, 3), 2), new Set([0]));
	});
	test('is empty when no entry is active', () => {
		assert.deepEqual(ancestorIndices(levels(1, 2), -1), new Set());
	});
});

describe('hasChildren', () => {
	test('is true when the next entry is deeper', () => {
		assert.equal(hasChildren(levels(2, 3), 0), true);
	});
	test('counts a skipped level as a child', () => {
		assert.equal(hasChildren(levels(2, 4), 0), true);
	});
	test('is false for a sibling or a shallower entry next', () => {
		assert.equal(hasChildren(levels(2, 2), 0), false);
		assert.equal(hasChildren(levels(3, 2), 0), false);
	});
	test('is false for the last entry', () => {
		assert.equal(hasChildren(levels(2, 3), 1), false);
	});
});

describe('hiddenIndices', () => {
	// Ids a-f, so collapsed sections can be named.
	// a h1
	// b   h2
	// c     h3
	// d     h3
	// e   h2
	// f     h3
	const outline = [1, 2, 3, 3, 2, 3].map((level, i) => ({ id: 'abcdef'[i], level }));
	const hidden = (...ids) => hiddenIndices(outline, new Set(ids));

	test('hides nothing when nothing is collapsed', () => {
		assert.deepEqual(hidden(), new Set());
	});
	test('hides the sections under a collapsed entry, not its siblings', () => {
		assert.deepEqual(hidden('b'), new Set([2, 3]));
	});
	test('hides everything under a collapsed top entry', () => {
		assert.deepEqual(hidden('a'), new Set([1, 2, 3, 4, 5]));
	});
	test('keeps hiding inside a collapsed section that contains another', () => {
		assert.deepEqual(hidden('a', 'b'), new Set([1, 2, 3, 4, 5]));
	});
	test('handles several collapsed sections', () => {
		assert.deepEqual(hidden('b', 'e'), new Set([2, 3, 5]));
	});
	test('hides nothing for a collapsed entry without children', () => {
		assert.deepEqual(hidden('c'), new Set());
	});
	test('hides a skipped-level child', () => {
		const skipped = [{ id: 'x', level: 2 }, { id: 'y', level: 4 }, { id: 'z', level: 2 }];
		assert.deepEqual(hiddenIndices(skipped, new Set(['x'])), new Set([1]));
	});
});

describe('focusTarget', () => {
	// 0 h1
	// 1   h2
	// 2     h3  (hidden)
	// 3     h3  (hidden)
	// 4   h2
	// 5     h3
	const outline = [1, 2, 3, 3, 2, 3].map((level, i) => ({ level, hidden: i === 2 || i === 3 }));
	const move = (index, key) => focusTarget(outline, index, key);

	test('moves down and up past hidden entries', () => {
		assert.equal(move(1, 'ArrowDown'), 4);
		assert.equal(move(4, 'ArrowUp'), 1);
	});
	test('stays put at the ends of the list', () => {
		assert.equal(move(0, 'ArrowUp'), 0);
		assert.equal(move(5, 'ArrowDown'), 5);
	});
	test('goes to the first and last visible entry', () => {
		assert.equal(move(4, 'Home'), 0);
		assert.equal(move(1, 'End'), 5);
	});
	test('goes to the parent', () => {
		assert.equal(move(5, 'ArrowLeft'), 4);
		assert.equal(move(4, 'ArrowLeft'), 0);
	});
	test('stays put on the left for the top entry', () => {
		assert.equal(move(0, 'ArrowLeft'), 0);
	});
	test('goes to the first child', () => {
		assert.equal(move(4, 'ArrowRight'), 5);
	});
	test('stays put on the right without visible children', () => {
		assert.equal(move(5, 'ArrowRight'), 5);
		assert.equal(move(1, 'ArrowRight'), 1);
	});
	test('treats a skipped level as parent and child', () => {
		const skipped = [{ level: 2 }, { level: 4 }];
		assert.equal(focusTarget(skipped, 1, 'ArrowLeft'), 0);
		assert.equal(focusTarget(skipped, 0, 'ArrowRight'), 1);
	});
	test('ignores other keys', () => {
		assert.equal(move(1, 'Enter'), undefined);
		assert.equal(move(1, 'a'), undefined);
	});
});

describe('storeCollapsed', () => {
	test('adds a file', () => {
		assert.deepEqual(storeCollapsed({}, 'a.md', ['x'], 1, 50), { 'a.md': { ids: ['x'], time: 1 } });
	});
	test('replaces a file and keeps the others', () => {
		const store = { 'a.md': { ids: ['x'], time: 1 }, 'b.md': { ids: ['y'], time: 2 } };
		assert.deepEqual(storeCollapsed(store, 'a.md', ['z'], 3, 50), { 'a.md': { ids: ['z'], time: 3 }, 'b.md': { ids: ['y'], time: 2 } });
	});
	test('drops a file with nothing collapsed', () => {
		const store = { 'a.md': { ids: ['x'], time: 1 }, 'b.md': { ids: ['y'], time: 2 } };
		assert.deepEqual(storeCollapsed(store, 'a.md', [], 3, 50), { 'b.md': { ids: ['y'], time: 2 } });
	});
	test('keeps only the most recently changed files', () => {
		const store = { 'a.md': { ids: ['x'], time: 1 }, 'b.md': { ids: ['y'], time: 2 } };
		assert.deepEqual(Object.keys(storeCollapsed(store, 'c.md', ['z'], 3, 2)).sort(), ['b.md', 'c.md']);
	});
	test('does not change the stored map', () => {
		const store = { 'a.md': { ids: ['x'], time: 1 } };
		storeCollapsed(store, 'a.md', [], 2, 50);
		assert.deepEqual(store, { 'a.md': { ids: ['x'], time: 1 } });
	});
});

describe('buildEntries', () => {
	test('returns nothing for no headings', () => {
		assert.deepEqual(depths(), []);
	});
	test('indents from the lowest level present', () => {
		assert.deepEqual(depths(2, 3, 2), [0, 1, 0]);
	});
	test('keeps the gap when a level is skipped', () => {
		assert.deepEqual(depths(2, 4), [0, 2]);
	});
	test('keeps other fields and does not change the input', () => {
		const headings = [{ id: 'intro', text: 'Intro', level: 2 }];
		assert.deepEqual(buildEntries(headings), [{ id: 'intro', text: 'Intro', level: 2, depth: 0 }]);
		assert.deepEqual(headings, [{ id: 'intro', text: 'Intro', level: 2 }]);
	});

	describe('maxDepth', () => {
		test('hides deeper levels', () => {
			assert.deepEqual(levelsShown(2, 1, 2, 3, 2), [1, 2, 2]);
		});
		test('shows everything at 6', () => {
			assert.deepEqual(levelsShown(6, 1, 2, 3, 4, 5, 6), [1, 2, 3, 4, 5, 6]);
		});
		test('shows everything when not given', () => {
			assert.deepEqual(buildEntries(levels(1, 2, 3)).map(e => e.level), [1, 2, 3]);
		});
		test('never hides the top level', () => {
			assert.deepEqual(levelsShown(1, 2, 3, 2), [2, 2]);
		});
		test('does not change the depth of what is shown', () => {
			assert.deepEqual(buildEntries(levels(2, 3, 4), { maxDepth: 3 }).map(e => e.depth), [0, 1]);
		});
	});

	describe('topHeading', () => {
		const asTitle = { topHeading: 'title' };

		test('makes a lone top heading the title', () => {
			assert.deepEqual(shape(asTitle, 1, 2, 3, 2), ['title', 0, 1, 0]);
		});
		test('makes no title when the top level has several headings', () => {
			assert.deepEqual(shape(asTitle, 1, 2, 1), [0, 1, 0]);
		});
		test('makes no title when the top heading is not first', () => {
			assert.deepEqual(shape(asTitle, 2, 1, 2), [1, 0, 1]);
		});
		test('lists the top heading by default', () => {
			assert.deepEqual(shape({}, 1, 2), [0, 1]);
		});
		test('indents the rest from its own top level', () => {
			assert.deepEqual(shape(asTitle, 1, 3, 3), ['title', 0, 0]);
		});
		test('works together with maxDepth', () => {
			assert.deepEqual(shape({ ...asTitle, maxDepth: 2 }, 1, 2, 3), ['title', 0]);
		});
		test('keeps a title with nothing under it', () => {
			assert.deepEqual(shape(asTitle, 1), ['title']);
		});
		test('keeps the title entry otherwise unchanged', () => {
			const [title] = buildEntries([{ id: 'doc', text: 'Doc', level: 1 }, { id: 'a', text: 'A', level: 2 }], asTitle);
			assert.deepEqual(title, { id: 'doc', text: 'Doc', level: 1, depth: 0, isTitle: true });
		});
	});

	describe('numbering', () => {
		test('numbers by place in the outline', () => {
			assert.deepEqual(numbers({}, 1, 2, 3, 2, 1), ['1', '1.1', '1.1.1', '1.2', '2']);
		});
		test('restarts the count under each parent', () => {
			assert.deepEqual(numbers({}, 2, 3, 3, 2, 3), ['1', '1.1', '1.2', '2', '2.1']);
		});
		test('adds no 0 for a skipped level', () => {
			assert.deepEqual(numbers({}, 2, 4), ['1', '1.1']);
		});
		test('continues the count when coming back up past a deeper level', () => {
			assert.deepEqual(numbers({}, 2, 4, 3, 4), ['1', '1.1', '1.2', '1.2.1']);
		});
		test('continues the count when a skipped level is closed by a shallower one', () => {
			assert.deepEqual(numbers({}, 1, 3, 4, 2), ['1', '1.1', '1.1.1', '1.2']);
		});
		test('starts at 1 when the document starts on h2', () => {
			assert.deepEqual(numbers({}, 2, 2, 3), ['1', '2', '2.1']);
		});
		test('numbers only what maxDepth shows', () => {
			assert.deepEqual(numbers({ maxDepth: 2 }, 1, 2, 3, 2), ['1', '1.1', '1.2']);
		});
		test('leaves the title unnumbered and starts the list at 1', () => {
			assert.deepEqual(numbers({ topHeading: 'title' }, 1, 2, 3, 2), ['title', '1', '1.1', '2']);
		});
		test('is off by default', () => {
			assert.deepEqual(buildEntries(levels(1, 2)).map(e => 'number' in e), [false, false]);
		});
	});
});
