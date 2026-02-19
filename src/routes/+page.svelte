<script>
	import { onMount } from 'svelte';

	const TEST_SECONDS = 30;
	const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
	const SHARE_BASE_URL = 'https://monkeytype.jevido.nl/';
	const PREVIEW_ROWS = 3;
	const PREVIEW_ROW_CHARS = 48;
	const GOOSE_PASS_DURATION_MS = 4800;
	const GOOSE_SPAWN_INTERVAL_MS = 1800;
	const GOOSE_WAVE_MIN = 2;
	const GOOSE_WAVE_MAX = 4;
	const GOOSE_MAX_ACTIVE = 40;
	const MODES = ['mapping', 'normal', 'caesarly_ambitions', 'random'];
	const MODE_LABELS = {
		mapping: 'Mapping',
		normal: 'Normal',
		caesarly_ambitions: 'Caesarly Ambitions',
		random: 'Random'
	};
	const SKULLS = [
		{
			id: 'no_backspace',
			name: 'No Backspace',
			description: 'Backspace is disabled during the test.'
		},
		{
			id: 'blackout_rows',
			name: 'Blackout Rows',
			description: 'Only the top row stays readable while typing.'
		},
		{
			id: 'fucking_geese',
			name: 'Fucking Geese',
			description: 'A goose keeps flying over your prompt text to distract you.'
		}
	];
	const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
	const WORD_BANK = [
		'about',
		'above',
		'across',
		'after',
		'again',
		'almost',
		'alpha',
		'anchor',
		'apple',
		'arrow',
		'aware',
		'balance',
		'basic',
		'beacon',
		'become',
		'before',
		'better',
		'beyond',
		'blaze',
		'board',
		'bold',
		'brain',
		'bridge',
		'brisk',
		'burst',
		'cable',
		'calm',
		'carry',
		'chain',
		'chart',
		'check',
		'chess',
		'clear',
		'climb',
		'clock',
		'cloud',
		'color',
		'crisp',
		'curve',
		'dance',
		'delta',
		'dream',
		'drift',
		'drive',
		'early',
		'earth',
		'echo',
		'elite',
		'ember',
		'energy',
		'enjoy',
		'enter',
		'equal',
		'event',
		'extra',
		'faith',
		'field',
		'final',
		'flare',
		'focus',
		'frame',
		'fresh',
		'front',
		'ghost',
		'giant',
		'glide',
		'glow',
		'grace',
		'graph',
		'great',
		'green',
		'guide',
		'happy',
		'heart',
		'honey',
		'human',
		'ideal',
		'image',
		'input',
		'joint',
		'jolly',
		'judge',
		'kinda',
		'known',
		'laser',
		'later',
		'learn',
		'level',
		'light',
		'logic',
		'lucky',
		'magic',
		'mango',
		'match',
		'metal',
		'might',
		'model',
		'motion',
		'native',
		'never',
		'noble',
		'novel',
		'ocean',
		'offer',
		'omega',
		'other',
		'paper',
		'party',
		'peace',
		'phase',
		'pilot',
		'pixel',
		'plane',
		'power',
		'prime',
		'quick',
		'quiet',
		'radio',
		'range',
		'rapid',
		'ready',
		'rebel',
		'right',
		'river',
		'robot',
		'round',
		'scale',
		'scope',
		'score',
		'secret',
		'sense',
		'shape',
		'shift',
		'shine',
		'short',
		'signal',
		'silver',
		'smart',
		'solid',
		'spark',
		'speed',
		'spice',
		'spirit',
		'start',
		'stone',
		'storm',
		'story',
		'strong',
		'sunny',
		'super',
		'switch',
		'symbol',
		'table',
		'taste',
		'teacher',
		'tensor',
		'theme',
		'tiger',
		'timing',
		'today',
		'token',
		'total',
		'touch',
		'tower',
		'track',
		'travel',
		'unique',
		'upper',
		'urban',
		'valid',
		'value',
		'video',
		'vivid',
		'voice',
		'water',
		'whale',
		'whole',
		'world',
		'youth',
		'zebra'
	];

	let phase = $state('intro');
	let mode = $state('mapping');
	let selectedSkulls = $state([]);
	let viewportWidth = $state(0);
	let mapOrder = $state([]);
	let mapIndex = $state(0);
	let mappingHint = $state('');
	let physicalToVirtual = $state({});
	let timeLeft = $state(TEST_SECONDS);
	let testStarted = $state(false);
	let canonicalPrompt = $state('');
	let typedEntries = $state([]);
	let testHint = $state('');
	let challengeHint = $state('');
	let shareStatus = $state('');
	let layoutSource = $state('custom');
	let activeGeese = $state([]);
	let timerHandle = null;
	let testEndsAt = 0;
	let gooseRaidInterval = null;
	let gooseAnimationFrame = null;
	let queuedGeese = [];

	const mappedCount = $derived(Object.keys(physicalToVirtual).length);
	const currentTarget = $derived(mapOrder[mapIndex] ?? '');
	const typedCount = $derived(typedEntries.length);
	const correctCount = $derived(typedEntries.filter((entry) => entry.correct).length);
	const wrongCount = $derived(typedEntries.length - correctCount);
	const accuracy = $derived(typedEntries.length ? (correctCount / typedEntries.length) * 100 : 0);
	const rawWpm = $derived((typedEntries.length / 5) * (60 / TEST_SECONDS));
	const wpm = $derived((correctCount / 5) * (60 / TEST_SECONDS));
	const virtualToPhysical = $derived.by(() => {
		const reverse = {};
		for (const [physical, virtual] of Object.entries(physicalToVirtual)) {
			reverse[virtual] = physical;
		}
		return reverse;
	});
	const displayPrompt = $derived(encodeForDisplay(canonicalPrompt));
	const lineStarts = $derived(buildLineStarts(displayPrompt, PREVIEW_ROW_CHARS));
	const activeLineIndex = $derived.by(() => {
		let index = 0;
		for (let i = 0; i < lineStarts.length; i += 1) {
			if (lineStarts[i] <= typedCount) {
				index = i;
			} else {
				break;
			}
		}
		return index;
	});
	const promptRows = $derived.by(() => {
		const rows = [];
		for (let offset = 0; offset < PREVIEW_ROWS; offset += 1) {
			const line = activeLineIndex + offset;
			const start = lineStarts[line] ?? displayPrompt.length;
			const end = lineStarts[line + 1] ?? displayPrompt.length;
			rows.push({
				id: `${line}-${start}`,
				start,
				text: displayPrompt.slice(start, end),
				active: offset === 0
			});
		}
		return rows;
	});
	const mapProgress = $derived((mappedCount / ALPHABET.length) * 100);
	const timeProgress = $derived((timeLeft / TEST_SECONDS) * 100);
	const isSmallScreen = $derived(viewportWidth > 0 && viewportWidth <= 760);
	const modeLabel = $derived(MODE_LABELS[mode] ?? 'Unknown');
	const activeSkullNames = $derived.by(() =>
		SKULLS.filter((skull) => selectedSkulls.includes(skull.id)).map((skull) => skull.name)
	);

	function hasSkull(id) {
		return selectedSkulls.includes(id);
	}

	function randomize(items) {
		const clone = [...items];
		for (let i = clone.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[clone[i], clone[j]] = [clone[j], clone[i]];
		}
		return clone;
	}

	function generatePrompt(wordCount = 220) {
		const words = Array.from({ length: wordCount }, () => {
			const index = Math.floor(Math.random() * WORD_BANK.length);
			return WORD_BANK[index];
		});
		return words.join(' ');
	}

	function buildLineStarts(text, maxChars) {
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

	function encodeForDisplay(text) {
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

	function resetRound() {
		timeLeft = TEST_SECONDS;
		testStarted = false;
		typedEntries = [];
		canonicalPrompt = generatePrompt();
	}

	function isValidLayoutCode(code) {
		if (!code || code.length !== ALPHABET.length) return false;
		const chars = code.split('');
		if (chars.some((char) => !ALPHABET.includes(char))) return false;
		return new Set(chars).size === ALPHABET.length;
	}

	function mappingFromCode(code) {
		const nextMap = {};
		for (let i = 0; i < ALPHABET.length; i += 1) {
			nextMap[ALPHABET[i]] = code[i];
		}
		return nextMap;
	}

	function layoutCodeFromMapping() {
		return ALPHABET.map((key) => physicalToVirtual[key]).join('');
	}

	function createIdentityMapping() {
		const nextMap = {};
		for (const key of ALPHABET) {
			nextMap[key] = key;
		}
		return nextMap;
	}

	function createRandomMapping() {
		const shuffledLetters = randomize(ALPHABET);
		const nextMap = {};
		for (let i = 0; i < ALPHABET.length; i += 1) {
			nextMap[ALPHABET[i]] = shuffledLetters[i];
		}
		return nextMap;
	}

	function createCaesarShiftMapping(shift = 3) {
		const nextMap = {};
		for (let i = 0; i < ALPHABET.length; i += 1) {
			nextMap[ALPHABET[i]] = ALPHABET[(i + shift) % ALPHABET.length];
		}
		return nextMap;
	}

	function startMapping() {
		mode = 'mapping';
		stopTimer();
		stopGooseRaids();
		phase = 'mapping';
		layoutSource = 'custom';
		mapOrder = randomize(ALPHABET);
		mapIndex = 0;
		mappingHint = 'Press the key where the shown letter lives on your real keyboard.';
		physicalToVirtual = {};
		typedEntries = [];
		timeLeft = TEST_SECONDS;
		testStarted = false;
		canonicalPrompt = '';
		testHint = '';
		challengeHint = '';
		shareStatus = '';
	}

	function startModeLayout(selectedMode) {
		mode = selectedMode;
		stopTimer();
		stopGooseRaids();
		phase = 'ready';
		layoutSource = 'mode';
		mapOrder = [];
		mapIndex = 0;
		if (selectedMode === 'normal') {
			physicalToVirtual = createIdentityMapping();
			mappingHint = 'Normal layout loaded (standard keyboard).';
		} else if (selectedMode === 'caesarly_ambitions') {
			physicalToVirtual = createCaesarShiftMapping(3);
			mappingHint = 'Caesar layout loaded (+3 shift on every key).';
		} else if (selectedMode === 'random') {
			physicalToVirtual = createRandomMapping();
			mappingHint = 'Random layout generated.';
		} else {
			physicalToVirtual = createIdentityMapping();
			mappingHint = 'Normal layout loaded (standard keyboard).';
		}
		testHint = '';
		challengeHint = '';
		shareStatus = '';
		resetRound();
	}

	function shuffleMapping() {
		if (mappedCount !== ALPHABET.length) return;

		if (layoutSource === 'mode') {
			if (mode === 'normal') {
				physicalToVirtual = createIdentityMapping();
				mappingHint = 'Normal layout restored (no shuffle).';
			} else if (mode === 'caesarly_ambitions') {
				physicalToVirtual = createCaesarShiftMapping(3);
				mappingHint = 'Caesar layout restored (+3 shift).';
			} else if (mode === 'random') {
				physicalToVirtual = createRandomMapping();
				mappingHint = 'Random layout regenerated.';
			}
			resetRound();
			return;
		}

		const keys = Object.keys(physicalToVirtual);
		const mappedLetters = randomize(Object.values(physicalToVirtual));
		const nextMap = {};
		for (let i = 0; i < keys.length; i += 1) {
			nextMap[keys[i]] = mappedLetters[i];
		}
		physicalToVirtual = nextMap;
		mappingHint = 'Mapping shuffled. The target text has been remapped too.';
		resetRound();
	}

	function beginTest() {
		if (phase !== 'ready') return;
		stopGooseRaids();
		phase = 'testing';
		mappingHint = '';
		shareStatus = '';
		testHint =
			'Press any mapped letter key to start. Backspace works, unsupported keys are ignored.';
		resetRound();
	}

	function finishTest() {
		if (phase !== 'testing') return;
		stopTimer();
		stopGooseRaids();
		phase = 'results';
	}

	function startOver() {
		startMapping();
	}

	function playAgain() {
		stopTimer();
		stopGooseRaids();
		phase = 'ready';
		resetRound();
		testHint = '';
		shareStatus = '';
	}

	function goToDashboard() {
		stopTimer();
		stopGooseRaids();
		phase = 'intro';
		mapOrder = [];
		mapIndex = 0;
		mappingHint = '';
		testHint = '';
		challengeHint = '';
		shareStatus = '';
		physicalToVirtual = {};
	}

	function toggleSkull(id) {
		if (selectedSkulls.includes(id)) {
			selectedSkulls = selectedSkulls.filter((value) => value !== id);
		} else {
			selectedSkulls = [...selectedSkulls, id];
		}
	}

	function toggleAllSkulls() {
		if (selectedSkulls.length === SKULLS.length) {
			selectedSkulls = [];
		} else {
			selectedSkulls = SKULLS.map((skull) => skull.id);
		}
	}

	function buildShareUrl() {
		const url = new URL(SHARE_BASE_URL);
		url.searchParams.set('layout', layoutCodeFromMapping());
		url.searchParams.set('mode', mode);
		if (selectedSkulls.length) {
			url.searchParams.set('skulls', selectedSkulls.join(','));
		}
		url.searchParams.set('wpm', wpm.toFixed(1));
		url.searchParams.set('acc', accuracy.toFixed(1));
		return url.toString();
	}

	async function shareResult() {
		if (mappedCount !== ALPHABET.length) return;
		const url = buildShareUrl();
		const skullText = activeSkullNames.length ? ` [${activeSkullNames.join(', ')}]` : '';
		const shareText = `I scored ${wpm.toFixed(1)} WPM (${accuracy.toFixed(1)}% accuracy) on Monkeytype Blind Layout. Can you beat it?`;
		const fullShareText = `${shareText}${skullText}`;

		try {
			if (navigator.share) {
				await navigator.share({
					title: 'Monkeytype Blind Layout Challenge',
					text: fullShareText,
					url
				});
				shareStatus = 'Challenge link shared.';
				return;
			}

			await navigator.clipboard.writeText(`${fullShareText} ${url}`);
			shareStatus = 'Challenge link copied to clipboard.';
		} catch {
			shareStatus = 'Share failed. Please try again.';
		}
	}

	function pushTypedChar(char) {
		if (typedEntries.length + 60 > canonicalPrompt.length) {
			canonicalPrompt = `${canonicalPrompt} ${generatePrompt(120)}`;
		}

		const expected = canonicalPrompt[typedEntries.length] ?? '';
		typedEntries.push({
			expected,
			actual: char,
			correct: expected === char
		});
	}

	function handleMappingKey(physicalKey) {
		if (!currentTarget) return;
		if (physicalToVirtual[physicalKey]) {
			mappingHint = `"${physicalKey.toUpperCase()}" is already mapped. Pick a different key.`;
			return;
		}

		physicalToVirtual[physicalKey] = currentTarget;
		mapIndex += 1;

		if (mapIndex >= ALPHABET.length) {
			phase = 'ready';
			mappingHint = 'Mapping complete. You can quick-shuffle or start the 30-second run.';
			resetRound();
		}
	}

	function handleTypingKey(event, key) {
		if (timeLeft <= 0) return;

		if (!testStarted && key !== 'backspace') {
			testStarted = true;
			testHint = '';
			startTimer();
		}

		if (key === 'backspace') {
			if (hasSkull('no_backspace')) {
				testHint = 'No Backspace skull is active.';
				return;
			}
			if (typedEntries.length > 0) {
				typedEntries.pop();
			}
			return;
		}

		if (key === ' ') {
			pushTypedChar(' ');
			return;
		}

		const mapped = physicalToVirtual[key];
		if (!mapped) {
			event.preventDefault();
			testHint = `Key "${key.toUpperCase()}" has no mapped letter in this mode.`;
			return;
		}

		pushTypedChar(mapped);
	}

	function stopTimer() {
		if (timerHandle !== null) {
			clearInterval(timerHandle);
			timerHandle = null;
		}
	}

	function startTimer() {
		stopTimer();
		testEndsAt = Date.now() + TEST_SECONDS * 1000;
		if (hasSkull('fucking_geese')) {
			startGooseRaids();
		}
		timerHandle = setInterval(() => {
			const remainingMs = Math.max(0, testEndsAt - Date.now());
			timeLeft = Math.ceil(remainingMs / 1000);
			if (remainingMs === 0) {
				finishTest();
			}
		}, 100);
	}

	function findPromptFlightPath() {
		const prompt = document.querySelector('.prompt');
		if (!prompt) return null;

		const rect = prompt.getBoundingClientRect();
		const padX = Math.max(18, Math.min(36, rect.width * 0.06));
		const padY = Math.max(14, Math.min(28, rect.height * 0.2));
		const startOnLeft = Math.random() < 0.5;
		const y = padY + Math.random() * Math.max(rect.height - padY * 2, 1);
		const startX = startOnLeft ? padX : rect.width - padX;
		const endX = startOnLeft ? rect.width - padX : padX;
		const endY = Math.max(padY, Math.min(rect.height - padY, y + (Math.random() * 18 - 9)));
		return {
			startX,
			startY: y,
			endX,
			endY,
			minX: padX,
			maxX: rect.width - padX,
			minY: padY,
			maxY: rect.height - padY
		};
	}

	function stopGooseAnimation() {
		if (gooseAnimationFrame !== null) {
			cancelAnimationFrame(gooseAnimationFrame);
			gooseAnimationFrame = null;
		}
	}

	function gooseStep() {
		if (queuedGeese.length) {
			activeGeese = [...activeGeese, ...queuedGeese];
			queuedGeese = [];
		}

		if (!activeGeese.length) {
			stopGooseAnimation();
			return;
		}

		const now = Date.now();
		const nextGeese = [];
		for (const goose of activeGeese) {
			const elapsed = now - goose.startedAt;
			const progress = Math.min(1, elapsed / GOOSE_PASS_DURATION_MS);
			const baseX = goose.startX + (goose.endX - goose.startX) * progress;
			const baseY = goose.startY + (goose.endY - goose.startY) * progress;
			const wobbleX =
				Math.sin(progress * goose.wobbleFreqX + goose.wobblePhaseX) * goose.wobbleAmpX;
			const wobbleY =
				Math.sin(progress * goose.wobbleFreqY + goose.wobblePhaseY) * goose.wobbleAmpY;
			const jitterX = (Math.random() - 0.5) * 1.6;
			const jitterY = (Math.random() - 0.5) * 1.6;
			const nextX = baseX + wobbleX + jitterX;
			const nextY = baseY + wobbleY + jitterY;
			goose.x = Math.min(goose.maxX, Math.max(goose.minX, nextX));
			goose.y = Math.min(goose.maxY, Math.max(goose.minY, nextY));
			if (progress >= 1) {
				const nextPath = findPromptFlightPath();
				if (nextPath) {
					retargetGoose(goose, nextPath, now);
				}
			}
			nextGeese.push(goose);
		}
		activeGeese = queuedGeese.length ? [...nextGeese, ...queuedGeese] : nextGeese;
		queuedGeese = [];

		if (!activeGeese.length) {
			stopGooseAnimation();
			return;
		}

		gooseAnimationFrame = requestAnimationFrame(gooseStep);
	}

	function startGooseAnimation() {
		stopGooseAnimation();
		gooseAnimationFrame = requestAnimationFrame(gooseStep);
	}

	function retargetGoose(goose, path, startedAt = Date.now()) {
		goose.x = path.startX;
		goose.y = path.startY;
		goose.startX = path.startX;
		goose.startY = path.startY;
		goose.endX = path.endX;
		goose.endY = path.endY;
		goose.minX = path.minX;
		goose.maxX = path.maxX;
		goose.minY = path.minY;
		goose.maxY = path.maxY;
		goose.wobbleAmpX = 12 + Math.random() * 12;
		goose.wobbleAmpY = 8 + Math.random() * 10;
		goose.wobbleFreqX = Math.PI * 2 * (2 + Math.random() * 3);
		goose.wobbleFreqY = Math.PI * 2 * (3 + Math.random() * 4);
		goose.wobblePhaseX = Math.random() * Math.PI * 2;
		goose.wobblePhaseY = Math.random() * Math.PI * 2;
		goose.startedAt = startedAt;
	}

	function spawnGooseRaid() {
		if (phase !== 'testing' || !testStarted) return;
		const totalActive = activeGeese.length + queuedGeese.length;
		if (totalActive >= GOOSE_MAX_ACTIVE) return;

		const remainingSlots = GOOSE_MAX_ACTIVE - totalActive;
		const waveSize = Math.min(
			remainingSlots,
			GOOSE_WAVE_MIN + Math.floor(Math.random() * (GOOSE_WAVE_MAX - GOOSE_WAVE_MIN + 1))
		);

		for (let i = 0; i < waveSize; i += 1) {
			const path = findPromptFlightPath();
			if (!path) break;

			const goose = {
				id: `${Date.now()}-${Math.floor(Math.random() * 100000)}-${i}`
			};
			retargetGoose(goose, path);
			queuedGeese.push(goose);
		}
		testHint = `${activeGeese.length + queuedGeese.length} geese active. Keep typing through the chaos.`;
		startGooseAnimation();
	}

	function startGooseRaids() {
		stopGooseRaids();
		spawnGooseRaid();
		gooseRaidInterval = setInterval(spawnGooseRaid, GOOSE_SPAWN_INTERVAL_MS);
	}

	function shooGoose(gooseId) {
		const countBefore = activeGeese.length;
		activeGeese = activeGeese.filter((goose) => goose.id !== gooseId);
		if (activeGeese.length < countBefore) {
			testHint = 'Goose shooed away.';
		}
		if (!activeGeese.length) {
			stopGooseAnimation();
		}
	}

	function stopGooseRaids() {
		if (gooseRaidInterval) {
			clearInterval(gooseRaidInterval);
			gooseRaidInterval = null;
		}
		stopGooseAnimation();
		activeGeese = [];
		queuedGeese = [];
	}

	function handleKeydown(event) {
		if (event.altKey || event.ctrlKey || event.metaKey) return;

		const key = event.key.toLowerCase();
		const isLetter = key.length === 1 && key >= 'a' && key <= 'z';
		const typingKey = isLetter || key === 'backspace' || key === ' ';
		if (!typingKey) return;

		if (key === ' ' || key === 'backspace') {
			event.preventDefault();
		}

		if (phase === 'mapping') {
			if (isLetter) {
				handleMappingKey(key);
			}
			return;
		}

		if (phase === 'testing') {
			handleTypingKey(event, key);
		}
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const modeParam = params.get('mode');
		if (modeParam && MODES.includes(modeParam)) {
			mode = modeParam;
		}
		const skullParam = params.get('skulls');
		if (skullParam) {
			const requestedSkulls = skullParam
				.split(',')
				.map((value) => value.trim())
				.filter((value) => SKULLS.some((skull) => skull.id === value));
			selectedSkulls = Array.from(new Set(requestedSkulls));
		}

		const layout = params.get('layout');
		if (!isValidLayoutCode(layout)) return;

		physicalToVirtual = mappingFromCode(layout);
		phase = 'ready';
		layoutSource = 'custom';
		mapOrder = [];
		mapIndex = 0;
		mappingHint = 'Shared layout loaded from URL. Start the 30-second test when ready.';
		testHint = '';
		resetRound();

		const sharedWpm = params.get('wpm');
		const sharedAcc = params.get('acc');
		if (sharedWpm && sharedAcc) {
			challengeHint = `Shared challenge score: ${sharedWpm} WPM @ ${sharedAcc}% accuracy.`;
		}

		return () => {
			stopTimer();
			stopGooseRaids();
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} bind:innerWidth={viewportWidth} />

<main class="app-shell">
	<header class="hero">
		<div class="hero-top">
			<p class="eyebrow">Blind Layout Mode</p>
			<button class="ghost dashboard-btn" onclick={goToDashboard}>Back to Dashboard</button>
		</div>
		<h1>Monkeytype: Memory Keyboard</h1>
		<p>
			Map every letter by instinct, optionally shuffle it, then survive a 30-second typing sprint on
			your own virtual layout.
		</p>
	</header>

	<section class="panel">
		{#if isSmallScreen}
			<p class="mobile-note">
				Small-screen mode is active. A hardware keyboard gives the best blind-typing experience.
			</p>
		{/if}

		{#if phase === 'intro'}
			<h2>Start a run</h2>
			<div class="skull-config">
				<p class="skull-title">Skulls</p>
				<div class="skull-grid">
					{#each SKULLS as skull (skull.id)}
						<button
							class={['skull', selectedSkulls.includes(skull.id) && 'on']}
							onclick={() => toggleSkull(skull.id)}
						>
							<strong>{skull.name}</strong>
							<span>{skull.description}</span>
						</button>
					{/each}
				</div>
				<button class="ghost skulls-toggle" onclick={toggleAllSkulls}>
					{selectedSkulls.length === SKULLS.length ? 'Disable All Skulls' : 'All Skulls On'}
				</button>
			</div>
			<p>Pick how you want this run to begin.</p>
			<div class="start-grid">
				<div class="start-card">
					<h3>Mapping</h3>
					<p>Map each letter manually from memory, then type on your custom layout.</p>
					<button class="cta" onclick={startMapping}>Start</button>
				</div>
				<div class="start-card">
					<h3>Normal</h3>
					<p>Start with the default keyboard mapping (A to A, B to B, and so on).</p>
					<button class="ghost" onclick={() => startModeLayout('normal')}>Start</button>
				</div>
				<div class="start-card">
					<h3>Caesarly Ambitions</h3>
					<p>Apply a Caesar +3 keyboard remap (A to D, B to E, C to F...).</p>
					<button class="ghost" onclick={() => startModeLayout('caesarly_ambitions')}>
						Start
					</button>
				</div>
				<div class="start-card">
					<h3>Random</h3>
					<p>Generate a fully shuffled layout instantly and jump straight into a run.</p>
					<button class="ghost" onclick={() => startModeLayout('random')}>Start</button>
				</div>
			</div>
		{/if}

		{#if phase === 'mapping' || phase === 'ready'}
			<div class="status-row">
				<p>
					Mapped <strong>{mappedCount}</strong>/26
				</p>
				<p class="mode-badge">Mode: {modeLabel}</p>
				{#if phase === 'mapping'}
					<p class="target">Map this letter: <span>{currentTarget.toUpperCase()}</span></p>
				{/if}
			</div>
			<div class="progress" aria-hidden="true">
				<div class="fill map" style={`width: ${mapProgress}%`}></div>
			</div>

			{#if mappingHint}
				<p class="hint">{mappingHint}</p>
			{/if}
			{#if challengeHint}
				<p class="controls">{challengeHint}</p>
			{/if}

			<div class="keyboard-wrap">
				<div class="keyboard">
					{#each KEYBOARD_ROWS as row (row)}
						<div class="key-row">
							{#each row.split('') as physical (physical)}
								<div class={['keycap', physicalToVirtual[physical] ? 'mapped' : 'empty']}>
									<span class="physical">{physical.toUpperCase()}</span>
									<span class="arrow">→</span>
									<span class="virtual">{(physicalToVirtual[physical] ?? '_').toUpperCase()}</span>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>

			{#if phase === 'ready'}
				<div class="actions">
					<button class="ghost" onclick={shuffleMapping}>Quick Shuffle</button>
					<button class="cta" onclick={beginTest}>Start 30s Test</button>
				</div>
			{/if}
		{/if}

		{#if phase === 'testing'}
			<div class="test-head">
				<p class="clock">{timeLeft}s</p>
				<p>Type using your remapped layout.</p>
			</div>
			<div class="progress" aria-hidden="true">
				<div class="fill timer" style={`width: ${timeProgress}%`}></div>
			</div>
			{#if !testStarted}
				<p class="hint">Press any mapped key to start the timer.</p>
			{/if}
			{#if testHint}
				<p class="controls">{testHint}</p>
			{/if}
			aaaaaaaaaaaaaaa
			{#if hasSkull('fucking_geese')}
				<div class="goose-zone">
					{#if activeGeese.length}
						<p class="controls">
							{activeGeese.length} goose{activeGeese.length === 1 ? '' : 's'} flying over your prompt.
							Keep typing through it.
						</p>
					{:else}
						<p class="controls">No active goose pass.</p>
					{/if}
				</div>
			{/if}

			<div class="prompt" aria-label="typing prompt">
				{#each promptRows as row (row.id)}
					{@const obscured = hasSkull('blackout_rows') && !row.active}
					<div class={['prompt-row', row.active && 'active', obscured && 'obscured']}>
						{#each row.text.split('') as char, offset (row.start + offset)}
							{@const i = row.start + offset}
							{@const displayChar = obscured && char !== ' ' ? '•' : char}
							<span
								class={[
									'char',
									i < typedCount && typedEntries[i]?.correct && 'ok',
									i < typedCount && !typedEntries[i]?.correct && 'bad',
									i === typedCount && 'current'
								]}
							>
								{displayChar}
							</span>
						{/each}
					</div>
				{/each}

				{#if hasSkull('fucking_geese')}
					{#each activeGeese as goose (goose.id)}
						<button
							class="goose-flyer"
							style={`left: ${goose.x}px; top: ${goose.y}px;`}
							onpointerdown={() => shooGoose(goose.id)}
							aria-label="Shoo goose"
						>
							🪿
						</button>
					{/each}
				{/if}
			</div>

			<div class="test-keyboard-wrap" aria-label="virtual keyboard">
				<div class="test-keyboard">
					{#each KEYBOARD_ROWS as row (row)}
						<div class="key-row">
							{#each row.split('') as physical (physical)}
								<div
									class={[
										'keycap',
										'test-keycap',
										physicalToVirtual[physical] ? 'mapped' : 'empty'
									]}
								>
									<span class="physical">{physical.toUpperCase()}</span>
									<span class="arrow">→</span>
									<span class="virtual">{(physicalToVirtual[physical] ?? '_').toUpperCase()}</span>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>

			<div class="mini-stats">
				<span>WPM: {wpm.toFixed(1)}</span>
				<span>Accuracy: {accuracy.toFixed(1)}%</span>
				<span>Correct: {correctCount}</span>
			</div>
		{/if}

		{#if phase === 'results'}
			<h2>Results</h2>
			<div class="score-grid">
				<div>
					<p class="label">WPM</p>
					<p class="value">{wpm.toFixed(1)}</p>
				</div>
				<div>
					<p class="label">Raw WPM</p>
					<p class="value">{rawWpm.toFixed(1)}</p>
				</div>
				<div>
					<p class="label">Accuracy</p>
					<p class="value">{accuracy.toFixed(1)}%</p>
				</div>
				<div>
					<p class="label">Correct / Wrong</p>
					<p class="value">{correctCount} / {wrongCount}</p>
				</div>
				<div>
					<p class="label">Skulls</p>
					<p class="value value-skulls">
						{activeSkullNames.length ? activeSkullNames.join(', ') : 'None'}
					</p>
				</div>
			</div>

			<div class="actions">
				<button class="ghost" onclick={playAgain}>Play Again</button>
				<button class="cta" onclick={startOver}>Remap Keyboard</button>
				<button class="ghost" onclick={shareResult}>Share</button>
			</div>
			{#if shareStatus}
				<p class="controls">{shareStatus}</p>
			{/if}
		{/if}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		min-height: 100vh;
		font-family: 'Space Mono', 'JetBrains Mono', 'Fira Code', monospace;
		background:
			radial-gradient(1200px 600px at 10% -10%, #e8f7ff 0%, transparent 60%),
			radial-gradient(900px 600px at 100% 0%, #ffeccf 0%, transparent 60%),
			linear-gradient(170deg, #fffef8 0%, #fff6e8 100%);
		color: #1a2433;
	}

	.app-shell {
		max-width: 1024px;
		margin: 0 auto;
		padding: 2rem 1rem 3rem;
	}

	.hero {
		margin-bottom: 1.2rem;
	}

	.hero-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.7rem;
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.78rem;
		color: #9f5e00;
		margin: 0;
	}

	h1 {
		margin: 0.2rem 0 0.7rem;
		font-size: clamp(1.7rem, 3.8vw, 2.8rem);
		line-height: 1.1;
	}

	h2 {
		margin-top: 0;
	}

	h3 {
		margin: 0 0 0.35rem;
	}

	.hero p {
		max-width: 72ch;
	}

	.panel {
		background: rgba(255, 255, 255, 0.75);
		border: 1px solid #f5c78f;
		border-radius: 18px;
		padding: 1rem;
		box-shadow: 0 20px 40px -30px rgba(56, 35, 0, 0.6);
		backdrop-filter: blur(5px);
	}

	.mobile-note {
		margin: 0 0 0.8rem;
		padding: 0.6rem 0.7rem;
		border-radius: 10px;
		background: #fff2de;
		border: 1px solid #f0c88e;
		font-size: 0.86rem;
		color: #6f4824;
	}

	.start-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.start-card {
		background: #fff;
		border: 1px solid #f1d2a7;
		border-radius: 12px;
		padding: 0.8rem;
		display: grid;
		gap: 0.55rem;
	}

	.start-card p {
		margin: 0;
	}

	.skull-config {
		margin: 0.2rem 0 0.8rem;
		padding: 0.65rem;
		border: 1px solid #eed2af;
		border-radius: 12px;
		background: #fff9f0;
	}

	.skull-title {
		margin: 0 0 0.45rem;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: #6c4a24;
	}

	.skull-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.skull {
		text-align: left;
		display: grid;
		gap: 0.2rem;
		border: 1px solid #e7d8c2;
		background: #fff;
	}

	.skull strong {
		font-size: 0.88rem;
	}

	.skull span {
		font-size: 0.76rem;
		color: #69513a;
	}

	.skull.on {
		border-color: #d87f3c;
		background: #fff1e5;
	}

	.skulls-toggle {
		margin-top: 0.6rem;
	}

	button {
		font: inherit;
		border: 0;
		border-radius: 12px;
		padding: 0.68rem 0.95rem;
		cursor: pointer;
		transition: transform 120ms ease;
	}

	button:active {
		transform: translateY(1px);
	}

	.cta {
		background: linear-gradient(135deg, #ff7d2f, #ffaf40);
		color: #1f1300;
		font-weight: 700;
	}

	.ghost {
		background: #fff;
		border: 1px solid #ffc488;
	}

	.dashboard-btn {
		padding: 0.42rem 0.68rem;
		font-size: 0.82rem;
	}

	.status-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.mode-badge {
		margin: 0;
		font-size: 0.84rem;
		padding: 0.22rem 0.5rem;
		border-radius: 999px;
		border: 1px solid #f0c88e;
		background: #fff3e0;
		color: #6f4824;
	}

	.target {
		font-size: 1rem;
		margin: 0;
	}

	.target span {
		display: inline-block;
		background: #1a2433;
		color: #fff;
		border-radius: 8px;
		padding: 0.12rem 0.45rem;
		min-width: 1.4rem;
		text-align: center;
	}

	.hint {
		margin-top: 0.3rem;
		color: #784200;
	}

	.controls {
		font-size: 0.88rem;
		color: #6f4824;
	}

	.progress {
		height: 8px;
		border-radius: 999px;
		background: #f0e1cf;
		overflow: hidden;
		margin: 0.35rem 0 0.65rem;
	}

	.fill {
		height: 100%;
		transition: width 180ms linear;
	}

	.fill.map {
		background: linear-gradient(90deg, #f2a22e, #ffd27c);
	}

	.fill.timer {
		background: linear-gradient(90deg, #5fd48f, #f1b94a);
	}

	.keyboard-wrap {
		overflow-x: auto;
		padding-bottom: 0.25rem;
	}

	.keyboard {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.85rem;
		min-width: max-content;
	}

	.key-row {
		display: flex;
		justify-content: center;
		flex-wrap: nowrap;
		gap: 0.35rem;
	}

	.keycap {
		width: 64px;
		border: 1px solid #d8dde6;
		border-radius: 10px;
		padding: 0.35rem;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		row-gap: 0.15rem;
		background: #f6f8fb;
	}

	.keycap.empty {
		opacity: 0.72;
	}

	.keycap.mapped {
		border-color: #ffaf40;
		background: #fff5e8;
	}

	.physical,
	.virtual {
		font-weight: 700;
		text-align: center;
	}

	.arrow {
		text-align: center;
		color: #8c98a8;
	}

	.actions {
		display: flex;
		gap: 0.7rem;
		margin-top: 1rem;
		flex-wrap: wrap;
	}

	.test-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.clock {
		font-size: 1.4rem;
		font-weight: 700;
		margin: 0;
		color: #8f3f00;
	}

	.prompt {
		font-size: clamp(1.02rem, 1.45vw, 1.55rem);
		line-height: 1.8;
		background:
			radial-gradient(800px 400px at 50% 20%, rgba(255, 255, 255, 0.04), transparent 60%),
			linear-gradient(180deg, #2e333a 0%, #2a2f36 100%);
		color: #5f666f;
		padding: 1.1rem 1.2rem;
		border-radius: 16px;
		border: 1px solid #40464f;
		min-height: 170px;
		margin: 0.8rem 0;
		letter-spacing: 0;
		word-spacing: 0.03em;
		display: grid;
		grid-template-rows: repeat(3, minmax(0, 1fr));
		gap: 0.22rem;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.03),
			inset 0 -24px 36px -28px rgba(0, 0, 0, 0.45);
		position: relative;
		overflow: hidden;
	}

	.prompt-row {
		display: block;
		color: #58616c;
	}

	.prompt-row.active {
		color: #69727d;
	}

	.prompt-row.obscured {
		color: #3e444d;
		opacity: 0.22;
		filter: blur(2.4px);
	}

	.prompt-row.obscured .char {
		color: #4a5058 !important;
		border-bottom-color: transparent !important;
	}

	.char.ok {
		color: #c6ccd4;
	}

	.char.bad {
		color: #d57e7e;
	}

	.char.current {
		background: transparent;
		color: #f1f4f8;
		border-bottom: 2px solid #f2be6a;
	}

	.mini-stats {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		font-size: 0.95rem;
	}

	.goose-zone {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
		margin: 0.2rem 0 0.55rem;
	}

	.test-keyboard-wrap {
		overflow-x: auto;
		padding: 0.25rem 0 0.2rem;
	}

	.test-keyboard {
		display: grid;
		gap: 0.42rem;
		min-width: max-content;
	}

	.test-keycap {
		background: #f4f7fb;
		border-color: #d1dae6;
	}

	.goose-flyer {
		position: absolute;
		z-index: 70;
		transform: translate(-50%, -50%);
		pointer-events: auto;
		font-size: 2.3rem;
		line-height: 1;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: pointer;
	}

	.goose-flyer:active {
		transform: translate(-50%, -50%);
	}

	.score-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 0.7rem;
	}

	.score-grid > div {
		background: #fff;
		border: 1px solid #f7d4a6;
		border-radius: 12px;
		padding: 0.8rem;
	}

	.label {
		margin: 0;
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: #8b5b1f;
	}

	.value {
		margin: 0.35rem 0 0;
		font-size: 1.7rem;
		font-weight: 700;
	}

	.value-skulls {
		font-size: 0.98rem;
		line-height: 1.35;
	}

	@media (max-width: 700px) {
		.app-shell {
			padding-top: 1.2rem;
		}

		.panel {
			padding: 0.85rem;
		}

		.keycap {
			width: 50px;
			font-size: 0.74rem;
			padding: 0.28rem;
		}

		.prompt {
			min-height: 132px;
			line-height: 1.65;
			padding: 1rem;
		}

		.actions {
			display: grid;
			grid-template-columns: 1fr;
			gap: 0.55rem;
		}

		.actions button {
			width: 100%;
		}

		.start-grid {
			grid-template-columns: 1fr;
		}

		.skull-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
