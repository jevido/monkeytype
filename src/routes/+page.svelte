<script>
	import { onMount } from 'svelte';
	import {
		GOOSE_MAX_ACTIVE,
		GOOSE_PASS_DURATION_MS,
		GOOSE_SPAWN_INTERVAL_MS,
		PREVIEW_ROW_CHARS,
		PREVIEW_ROWS,
		SHARE_BASE_URL,
		SKULLS,
		TEST_SECONDS,
		WORD_BANK
	} from '$lib/typing/constants.js';
	import { buildLineStarts, generatePrompt } from '$lib/typing/layout.js';

	let phase = $state('intro');
	let selectedSkulls = $state([]);
	let viewportWidth = $state(0);
	let timeLeft = $state(TEST_SECONDS);
	let testStarted = $state(false);
	let canonicalPrompt = $state('');
	let typedEntries = $state([]);
	let testHint = $state('');
	let challengeHint = $state('');
	let shareStatus = $state('');
	let activeGeese = $state([]);
	let dyslecticFlipMask = $state([]);
	let partyParrots = $state([]);
	let timerHandle = null;
	let testEndsAt = 0;
	let gooseRaidInterval = null;
	let gooseAnimationFrame = null;
	let queuedGeese = [];
	const DIGITS = '0123456789';
	const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/\\|';

	const typedCount = $derived(typedEntries.length);
	const correctCount = $derived(typedEntries.filter((entry) => entry.correct).length);
	const wrongCount = $derived(typedEntries.length - correctCount);
	const accuracy = $derived(typedEntries.length ? (correctCount / typedEntries.length) * 100 : 0);
	const rawWpm = $derived((typedEntries.length / 5) * (60 / TEST_SECONDS));
	const wpm = $derived((correctCount / 5) * (60 / TEST_SECONDS));
	const displayPrompt = $derived(canonicalPrompt);
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
	const timeProgress = $derived((timeLeft / TEST_SECONDS) * 100);
	const isSmallScreen = $derived(viewportWidth > 0 && viewportWidth <= 760);
	const activeSkullNames = $derived.by(() =>
		SKULLS.filter((skull) => selectedSkulls.includes(skull.id)).map((skull) => skull.name)
	);

	function hasSkull(id) {
		return selectedSkulls.includes(id);
	}

	function randomFrom(charset) {
		return charset[Math.floor(Math.random() * charset.length)];
	}

	function applySkullMixToWord(word) {
		let mixed = '';
		for (const char of word) {
			if (!/[a-z]/i.test(char)) {
				mixed += char;
				continue;
			}
			if (hasSkull('with_numbers') && Math.random() < 0.14) {
				mixed += randomFrom(DIGITS);
				continue;
			}
			if (hasSkull('with_symbols') && Math.random() < 0.12) {
				mixed += randomFrom(SYMBOLS);
				continue;
			}
			if (hasSkull('with_capitals') && Math.random() < 0.35) {
				mixed += char.toUpperCase();
				continue;
			}
			mixed += char.toLowerCase();
		}
		return mixed;
	}

	function buildPromptWithSkulls(wordCount = 220) {
		return generatePrompt(wordCount)
			.split(' ')
			.map((word) => applySkullMixToWord(word))
			.join(' ');
	}

	function buildDyslecticMask(text) {
		return Array.from(text, (char) => /[a-z]/i.test(char) && Math.random() < 0.24);
	}

	function buildPartyParrots(count = 8) {
		return Array.from({ length: count }, (_, index) => ({
			id: `party-parrot-${index}-${Math.floor(Math.random() * 100000)}`,
			x: 6 + Math.random() * 88,
			y: 14 + Math.random() * 72,
			size: 1.7 + Math.random() * 1.2,
			delay: Math.random() * 1.2,
			duration: 0.9 + Math.random() * 1.5
		}));
	}

	function resetRound() {
		timeLeft = TEST_SECONDS;
		testStarted = false;
		typedEntries = [];
		canonicalPrompt = buildPromptWithSkulls();
		dyslecticFlipMask = buildDyslecticMask(canonicalPrompt);
		partyParrots = hasSkull('party_parrot_mode') ? buildPartyParrots() : [];
	}

	function startRun() {
		stopTimer();
		stopGooseRaids();
		phase = 'testing';
		testHint = 'Press any key to start. Backspace works.';
		challengeHint = '';
		shareStatus = '';
		resetRound();
	}

	function finishTest() {
		if (phase !== 'testing') return;
		stopTimer();
		stopGooseRaids();
		phase = 'results';
	}

	function startOver() {
		startRun();
	}

	function playAgain() {
		stopTimer();
		stopGooseRaids();
		phase = 'testing';
		resetRound();
		testHint = 'Press any key to start. Backspace works.';
		challengeHint = '';
		shareStatus = '';
	}

	function goToDashboard() {
		stopTimer();
		stopGooseRaids();
		phase = 'intro';
		testHint = '';
		challengeHint = '';
		shareStatus = '';
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
		if (selectedSkulls.length) {
			url.searchParams.set('skulls', selectedSkulls.join(','));
		}
		url.searchParams.set('wpm', wpm.toFixed(1));
		url.searchParams.set('acc', accuracy.toFixed(1));
		return url.toString();
	}

	function buildShareText(url) {
		const skullSummary = activeSkullNames.length ? activeSkullNames.join(', ') : 'None';
		return [
			'Monkeytype: Memory Keyboard Challenge',
			`I scored ${wpm.toFixed(1)} WPM at ${accuracy.toFixed(1)}% accuracy.`,
			`Skulls: ${skullSummary}`,
			'Beat it kiddo:',
			url
		].join('\n');
	}

	async function shareResult() {
		const url = buildShareUrl();
		const shareText = buildShareText(url);

		try {
			if (navigator.share) {
				await navigator.share({
					title: 'Monkeytype Blind Layout Challenge',
					text: shareText,
					url
				});
				shareStatus = 'Challenge link shared.';
				return;
			}

			await navigator.clipboard.writeText(shareText);
			shareStatus = 'Challenge link copied to clipboard.';
		} catch {
			shareStatus = 'Share failed. Please try again.';
		}
	}

	function pushTypedChar(char) {
		if (typedEntries.length + 60 > canonicalPrompt.length) {
			const extension = ` ${buildPromptWithSkulls(120)}`;
			canonicalPrompt = `${canonicalPrompt}${extension}`;
			dyslecticFlipMask = [...dyslecticFlipMask, ...buildDyslecticMask(extension)];
		}

		const expected = canonicalPrompt[typedEntries.length] ?? '';
		const correct = expected === char;
		typedEntries.push({
			expected,
			actual: char,
			correct
		});
		return correct;
	}

	function rerollUpcomingWord() {
		const cursor = typedEntries.length;
		let wordStart = cursor;

		while (wordStart < canonicalPrompt.length && canonicalPrompt[wordStart] === ' ') {
			wordStart += 1;
		}

		const replacement = applySkullMixToWord(
			WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)]
		);
		if (wordStart >= canonicalPrompt.length) {
			canonicalPrompt = `${canonicalPrompt}${canonicalPrompt.endsWith(' ') ? '' : ' '}${replacement}`;
			return;
		}

		let wordEnd = wordStart;
		while (wordEnd < canonicalPrompt.length && canonicalPrompt[wordEnd] !== ' ') {
			wordEnd += 1;
		}

		canonicalPrompt = `${canonicalPrompt.slice(0, wordStart)}${replacement}${canonicalPrompt.slice(wordEnd)}`;
	}

	function handleTypingKey(key) {
		if (timeLeft <= 0) return;

		if (!testStarted && key !== 'Backspace') {
			testStarted = true;
			testHint = '';
			startTimer();
		}

		if (key === 'Backspace') {
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
			const correct = pushTypedChar(' ');
			if (hasSkull('word_roulette') && Math.random() < 1 / 3) {
				rerollUpcomingWord();
			}
			if (!correct && hasSkull('fucking_geese')) {
				spawnGooseRaid(1);
			}
			return;
		}

		const correct = pushTypedChar(key);
		if (!correct && hasSkull('fucking_geese')) {
			spawnGooseRaid(1);
		}
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

	function spawnGooseRaid(count = 1) {
		if (phase !== 'testing' || !testStarted) return;
		const totalActive = activeGeese.length + queuedGeese.length;
		if (totalActive >= GOOSE_MAX_ACTIVE) return;

		const remainingSlots = GOOSE_MAX_ACTIVE - totalActive;
		const waveSize = Math.min(remainingSlots, Math.max(0, Math.floor(count)));

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

		const key = event.key;
		const typingKey = key.length === 1 || key === 'Backspace';
		if (!typingKey) return;

		if (key === ' ' || key === 'Backspace') {
			event.preventDefault();
		}

		if (phase === 'testing') {
			handleTypingKey(key);
		}
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const skullParam = params.get('skulls');
		if (skullParam) {
			const requestedSkulls = skullParam
				.split(',')
				.map((value) => value.trim())
				.filter((value) => SKULLS.some((skull) => skull.id === value));
			selectedSkulls = Array.from(new Set(requestedSkulls));
		}

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

<svelte:head>
	<title>Typing</title>
</svelte:head>

<main class={['app-shell', hasSkull('party_parrot_mode') && phase === 'testing' && 'party-shell']}>
	<header class="hero">
		<div class="hero-top">
			<p class="eyebrow">Blind Layout Mode</p>
			<button class="ghost dashboard-btn" onclick={goToDashboard}>Back to Dashboard</button>
		</div>
		<h1>Monkeytype: Memory Keyboard</h1>
		<p>So you think you can type fast huh?</p>
		<p>Are you ready to put your money where your mouth is kiddo?</p>
	</header>

	<section class="panel">
		{#if isSmallScreen}
			<p class="mobile-note">
				Small-screen view is active. A hardware keyboard gives the best blind-typing experience.
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
			<p>Start typing.</p>
			{#if challengeHint}
				<p class="controls">{challengeHint}</p>
			{/if}
			<div class="actions">
				<button class="cta" onclick={startRun}>Start</button>
			</div>
		{/if}

		{#if phase === 'testing'}
			<div class="test-head">
				<p class="clock">{timeLeft}s</p>
				<p>Type with your normal keyboard layout.</p>
			</div>
			<div class="progress" aria-hidden="true">
				<div class="fill timer" style={`width: ${timeProgress}%`}></div>
			</div>
			{#if !testStarted}
				<p class="hint">Press any key to start the timer.</p>
			{/if}
			{#if testHint}
				<p class="controls">{testHint}</p>
			{/if}

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

			<div
				class={[
					'prompt',
					hasSkull('dyslectic_simulator') && 'dyslectic-sim',
					hasSkull('party_parrot_mode') && 'party-prompt'
				]}
				aria-label="typing prompt"
			>
				{#each promptRows as row (row.id)}
					<div class={['prompt-row', row.active && 'active']}>
						{#each row.text.split('') as char, offset (row.start + offset)}
							{@const i = row.start + offset}
							<span
								class={[
									'char',
									hasSkull('dyslectic') && dyslecticFlipMask[i] && 'flip-vertical',
									i < typedCount && typedEntries[i]?.correct && 'ok',
									i < typedCount && !typedEntries[i]?.correct && 'bad',
									i === typedCount && 'current',
									hasSkull('party_parrot_mode') && 'party-char'
								]}
								style={`--party-color-delay: -${(i % 13) * 0.08}s;`}
							>
								{char}
							</span>
						{/each}
					</div>
				{/each}

				{#if hasSkull('party_parrot_mode')}
					{#each partyParrots as parrot (parrot.id)}
						<span
							class="party-parrot"
							style={`left: ${parrot.x}%; top: ${parrot.y}%; --party-parrot-size: ${parrot.size}rem; --party-parrot-delay: ${parrot.delay}s; --party-parrot-duration: ${parrot.duration}s;`}
							aria-hidden="true"
						>
							🦜
						</span>
					{/each}
				{/if}

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
				<button class="cta" onclick={startOver}>New Run</button>
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
		position: relative;
		z-index: 1;
	}

	.app-shell.party-shell::before {
		content: '';
		position: fixed;
		inset: 0;
		z-index: -1;
		background: linear-gradient(
			120deg,
			#ff2b2b,
			#ff8f1f,
			#ffe71f,
			#39ff7a,
			#36d6ff,
			#7f7dff,
			#ff52d9,
			#ff2b2b
		);
		background-size: 420% 420%;
		animation: rainbow-shift 8s linear infinite;
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

	.fill.timer {
		background: linear-gradient(90deg, #5fd48f, #f1b94a);
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

	.prompt.dyslectic-sim {
		animation: dyslectic-warp 1900ms ease-in-out infinite;
	}

	.prompt.dyslectic-sim .prompt-row {
		animation: dyslectic-row-jitter 1300ms steps(4, end) infinite;
	}

	.prompt.dyslectic-sim .prompt-row:nth-child(2) {
		animation-delay: 0.2s;
	}

	.prompt.dyslectic-sim .prompt-row:nth-child(3) {
		animation-delay: 0.4s;
	}

	.prompt.dyslectic-sim .char {
		text-shadow:
			-0.05em 0.03em rgba(255, 80, 80, 0.28),
			0.06em -0.02em rgba(90, 185, 255, 0.34),
			0 0 0.03em rgba(255, 255, 255, 0.22);
		animation: dyslectic-shadow-drift 950ms steps(2, end) infinite;
	}

	.prompt.party-prompt {
		border-color: rgba(255, 255, 255, 0.7);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.15),
			0 0 0 1px rgba(255, 255, 255, 0.25),
			0 0 28px -12px rgba(255, 255, 255, 0.45);
	}

	.prompt-row {
		display: block;
		color: #58616c;
	}

	.prompt-row.active {
		color: #69727d;
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

	.char.flip-vertical {
		display: inline-block;
		transform: scaleY(-1);
		transform-origin: center;
	}

	.prompt.party-prompt .char.party-char {
		animation: party-char-color 1s steps(1, end) infinite;
		animation-delay: var(--party-color-delay, 0s);
	}

	.party-parrot {
		position: absolute;
		z-index: 36;
		transform: translate(-50%, -50%);
		font-size: var(--party-parrot-size, 2rem);
		line-height: 1;
		pointer-events: none;
		filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.45));
		animation: party-parrot-vibe var(--party-parrot-duration, 1.3s) ease-in-out infinite;
		animation-delay: var(--party-parrot-delay, 0s);
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

	@keyframes rainbow-shift {
		0% {
			background-position: 0% 50%;
		}
		100% {
			background-position: 100% 50%;
		}
	}

	@keyframes dyslectic-warp {
		0%,
		100% {
			filter: saturate(1) contrast(1);
			transform: perspective(700px) rotateX(0deg) rotateY(0deg);
		}
		50% {
			filter: saturate(1.08) contrast(1.06);
			transform: perspective(700px) rotateX(1.2deg) rotateY(-1.3deg);
		}
	}

	@keyframes dyslectic-row-jitter {
		0%,
		100% {
			transform: translate(0, 0);
		}
		20% {
			transform: translate(0.04em, -0.01em);
		}
		40% {
			transform: translate(-0.05em, 0.02em);
		}
		60% {
			transform: translate(0.03em, 0.01em);
		}
		80% {
			transform: translate(-0.02em, -0.03em);
		}
	}

	@keyframes dyslectic-shadow-drift {
		0% {
			text-shadow:
				-0.05em 0.03em rgba(255, 80, 80, 0.3),
				0.06em -0.02em rgba(90, 185, 255, 0.32),
				0 0 0.03em rgba(255, 255, 255, 0.2);
		}
		50% {
			text-shadow:
				0.07em 0.01em rgba(255, 80, 80, 0.35),
				-0.05em -0.03em rgba(90, 185, 255, 0.34),
				0 0 0.04em rgba(255, 255, 255, 0.24);
		}
		100% {
			text-shadow:
				-0.04em -0.02em rgba(255, 80, 80, 0.28),
				0.05em 0.03em rgba(90, 185, 255, 0.3),
				0 0 0.03em rgba(255, 255, 255, 0.2);
		}
	}

	@keyframes party-char-color {
		0% {
			color: #ff5f6d;
		}
		16% {
			color: #ffb347;
		}
		33% {
			color: #fff95b;
		}
		50% {
			color: #78ff7b;
		}
		66% {
			color: #5fd0ff;
		}
		83% {
			color: #bd8cff;
		}
		100% {
			color: #ff7bf0;
		}
	}

	@keyframes party-parrot-vibe {
		0%,
		100% {
			transform: translate(-50%, -50%) rotate(-6deg) scale(0.97);
		}
		25% {
			transform: translate(-50%, -54%) rotate(7deg) scale(1.06);
		}
		50% {
			transform: translate(-50%, -48%) rotate(-8deg) scale(1);
		}
		75% {
			transform: translate(-50%, -53%) rotate(8deg) scale(1.05);
		}
	}

	@media (max-width: 700px) {
		.app-shell {
			padding-top: 1.2rem;
		}

		.panel {
			padding: 0.85rem;
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

		.skull-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
