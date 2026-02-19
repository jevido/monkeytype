<script>
	const TEST_SECONDS = 30;
	const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
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
	let mapOrder = $state([]);
	let mapIndex = $state(0);
	let mappingHint = $state('');
	let physicalToVirtual = $state({});
	let timeLeft = $state(TEST_SECONDS);
	let testStarted = $state(false);
	let canonicalPrompt = $state('');
	let displayPrompt = $state('');
	let typedEntries = $state([]);

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
	const visibleStart = $derived(Math.max(0, typedCount - 36));
	const visibleText = $derived(displayPrompt.slice(visibleStart, visibleStart + 180));

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
		displayPrompt = encodeForDisplay(canonicalPrompt);
	}

	function startMapping() {
		phase = 'mapping';
		mapOrder = randomize(ALPHABET);
		mapIndex = 0;
		mappingHint = 'Press the key where the shown letter lives on your real keyboard.';
		physicalToVirtual = {};
		typedEntries = [];
		timeLeft = TEST_SECONDS;
		testStarted = false;
		canonicalPrompt = '';
		displayPrompt = '';
	}

	function shuffleMapping() {
		if (mappedCount !== ALPHABET.length) return;
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
		phase = 'testing';
		mappingHint = '';
		resetRound();
	}

	function finishTest() {
		if (phase !== 'testing') return;
		phase = 'results';
	}

	function startOver() {
		startMapping();
	}

	function playAgain() {
		phase = 'ready';
		resetRound();
	}

	function pushTypedChar(char) {
		if (typedEntries.length + 60 > canonicalPrompt.length) {
			canonicalPrompt = `${canonicalPrompt} ${generatePrompt(120)}`;
			displayPrompt = encodeForDisplay(canonicalPrompt);
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
		if (!testStarted && key !== 'backspace') {
			testStarted = true;
		}

		if (key === 'backspace') {
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
			return;
		}

		pushTypedChar(mapped);
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

	$effect(() => {
		displayPrompt = encodeForDisplay(canonicalPrompt);
	});

	$effect(() => {
		if (phase !== 'testing' || !testStarted) return;
		if (timeLeft <= 0) {
			finishTest();
			return;
		}

		const interval = setInterval(() => {
			timeLeft -= 1;
			if (timeLeft <= 0) {
				timeLeft = 0;
				finishTest();
			}
		}, 1000);

		return () => clearInterval(interval);
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<main class="app-shell">
	<header class="hero">
		<p class="eyebrow">Blind Layout Mode</p>
		<h1>Monkeytype: Memory Keyboard</h1>
		<p>
			Map every letter by instinct, optionally shuffle it, then survive a 30-second typing sprint on
			your own virtual layout.
		</p>
	</header>

	<section class="panel">
		{#if phase === 'intro'}
			<h2>How this round works</h2>
			<ol>
				<li>Map all 26 letters. You will be shown one letter at a time.</li>
				<li>Press the physical key where you believe that letter belongs.</li>
				<li>Optionally quick-shuffle your mapping, then run the 30-second test.</li>
			</ol>
			<button class="cta" onclick={startMapping}>Start Mapping</button>
		{/if}

		{#if phase === 'mapping' || phase === 'ready'}
			<div class="status-row">
				<p>
					Mapped <strong>{mappedCount}</strong>/26
				</p>
				{#if phase === 'mapping'}
					<p class="target">Map this letter: <span>{currentTarget.toUpperCase()}</span></p>
				{/if}
			</div>

			{#if mappingHint}
				<p class="hint">{mappingHint}</p>
			{/if}

			<div class="keyboard">
				{#each KEYBOARD_ROWS as row}
					<div class="key-row">
						{#each row.split('') as physical}
							<div class={['keycap', physicalToVirtual[physical] ? 'mapped' : 'empty']}>
								<span class="physical">{physical.toUpperCase()}</span>
								<span class="arrow">→</span>
								<span class="virtual">{(physicalToVirtual[physical] ?? '_').toUpperCase()}</span>
							</div>
						{/each}
					</div>
				{/each}
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
				<p>Type using your remapped layout. First key starts the timer.</p>
			</div>

			<p class="prompt" aria-label="typing prompt">
				{#each visibleText.split('') as char, offset (visibleStart + offset)}
					{@const i = visibleStart + offset}
					<span
						class={[
							'char',
							i < typedCount && typedEntries[i]?.correct && 'ok',
							i < typedCount && !typedEntries[i]?.correct && 'bad',
							i === typedCount && 'current'
						]}
					>
						{char === ' ' ? '·' : char}
					</span>
				{/each}
			</p>

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
			</div>

			<div class="actions">
				<button class="ghost" onclick={playAgain}>Play Again</button>
				<button class="cta" onclick={startOver}>Remap Keyboard</button>
			</div>
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

	ol {
		padding-left: 1.2rem;
	}

	li {
		margin-bottom: 0.45rem;
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

	.status-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
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

	.keyboard {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.85rem;
	}

	.key-row {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
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
		font-size: clamp(1rem, 2vw, 1.25rem);
		line-height: 1.9;
		background: #151d29;
		color: #71819a;
		padding: 1rem;
		border-radius: 12px;
		min-height: 145px;
		margin: 0.6rem 0;
	}

	.char.ok {
		color: #6be7ac;
	}

	.char.bad {
		color: #ff6f6f;
	}

	.char.current {
		background: #ffc14d;
		color: #1f1300;
		border-radius: 4px;
	}

	.mini-stats {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		font-size: 0.95rem;
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

	@media (max-width: 700px) {
		.app-shell {
			padding-top: 1.2rem;
		}

		.keycap {
			width: 56px;
			font-size: 0.8rem;
		}
	}
</style>
