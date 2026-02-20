import { ALPHABET, WORD_BANK } from '$lib/typing/constants.js';

export function randomize(items) {
	const clone = [...items];
	for (let i = clone.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[clone[i], clone[j]] = [clone[j], clone[i]];
	}
	return clone;
}

export function generatePrompt(wordCount = 220) {
	const words = Array.from({ length: wordCount }, () => {
		const index = Math.floor(Math.random() * WORD_BANK.length);
		return WORD_BANK[index];
	});
	return words.join(' ');
}

export function buildLineStarts(text, maxChars) {
	const starts = [0];
	if (!text.length) return starts;

	let start = 0;
	while (start < text.length) {
		let end = Math.min(start + maxChars, text.length);
		if (end < text.length) {
			const softBreak = text.lastIndexOf(' ', end);
			if (softBreak > start + 16) {
				end = softBreak + 1;
			}
		}
		if (end <= start) end = Math.min(start + maxChars, text.length);
		start = end;
		starts.push(start);
	}

	return starts;
}

export function encodeForDisplay(text, virtualToPhysical) {
	let output = '';
	for (const char of text) {
		if (char === ' ') {
			output += ' ';
			continue;
		}
		output += virtualToPhysical[char] ?? '?';
	}
	return output;
}

export function isValidLayoutCode(code) {
	if (!code || code.length !== ALPHABET.length) return false;
	const chars = code.split('');
	if (chars.some((char) => !ALPHABET.includes(char))) return false;
	return new Set(chars).size === ALPHABET.length;
}

export function mappingFromCode(code) {
	const nextMap = {};
	for (let i = 0; i < ALPHABET.length; i += 1) {
		nextMap[ALPHABET[i]] = code[i];
	}
	return nextMap;
}

export function layoutCodeFromMapping(physicalToVirtual) {
	return ALPHABET.map((key) => physicalToVirtual[key]).join('');
}

export function createIdentityMapping() {
	const nextMap = {};
	for (const key of ALPHABET) {
		nextMap[key] = key;
	}
	return nextMap;
}

export function createRandomMapping() {
	const shuffledLetters = randomize(ALPHABET);
	const nextMap = {};
	for (let i = 0; i < ALPHABET.length; i += 1) {
		nextMap[ALPHABET[i]] = shuffledLetters[i];
	}
	return nextMap;
}

export function createCaesarShiftMapping(shift = 3) {
	const nextMap = {};
	for (let i = 0; i < ALPHABET.length; i += 1) {
		nextMap[ALPHABET[i]] = ALPHABET[(i + shift) % ALPHABET.length];
	}
	return nextMap;
}
