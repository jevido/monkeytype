# Monkeytype Blind Keyboard Game Roadmap

## Vision

Create a typing game where users first map letters by keyboard memory, then complete a 30-second typing test using that remapped layout, and receive Monkeytype-style results.

## Core Game Loop

1. Blind key mapping (`a-z`)
2. Optional quick shuffle of mapped layout
3. 30-second remapped typing test
4. Results screen with speed and accuracy metrics

## Current Status

- [x] Basic playable prototype in `src/routes/+page.svelte`
- [x] Mapping flow for 26 letters
- [x] Virtual keyboard visualization
- [x] Quick shuffle action
- [x] 30-second test timer
- [x] Remapped prompt and remapped input handling
- [x] Results with WPM, raw WPM, accuracy, correct/wrong

## Phase 1: Gameplay Polish

- [x] Add stronger typing focus UX (start prompt and input lock states)
- [x] Improve error handling for unsupported keys/layout edge cases
- [x] Add smoother progress feedback during mapping and testing
- [x] Improve mobile keyboard and small-screen behavior

## Phase 2: Scoring Accuracy

- [ ] Align score math closer to Monkeytype behavior
- [ ] Add character-by-character mistake timeline
- [ ] Add consistency metric (speed variance)
- [ ] Add optional stricter modes (no backspace, punctuation, numbers)

## Phase 3: Retention Features

- [ ] Persist best scores and recent runs in localStorage
- [ ] Add personal stats page (avg WPM, avg accuracy, top layout)
- [ ] Add challenge presets (easy/normal/hard layouts)
- [ ] Add seeded daily challenge

## Phase 4: Competitive/Share Features

- [ ] Add shareable result card
- [ ] Add URL-based challenge seeds
- [ ] Add optional online leaderboard/API

## Technical Roadmap

- [ ] Extract game logic into reusable modules (`src/lib/game/*`)

## Definition of Done (MVP+)

- [ ] Game loop is stable on desktop and mobile
- [ ] Score output is consistent and trusted
- [ ] At least one replay/retention mechanic is shipped
- [ ] Automated tests cover critical flow
