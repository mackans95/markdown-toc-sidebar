const { ancestorIndices, buildEntries } = require('../media/toc');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

function levels(...ls) {
	return ls.map(level => ({ level }));
}

function depths(...ls) {
	return buildEntries(levels(...ls)).map(e => e.depth);
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
});
