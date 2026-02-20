<script>
	let { rows, mapping, keycapClass = '' } = $props();
</script>

<div class="keyboard">
	{#each rows as row (row)}
		<div class="key-row">
			{#each row.split('') as physical (physical)}
				<div class={['keycap', keycapClass, mapping[physical] ? 'mapped' : 'empty']}>
					<span class="physical">{physical.toUpperCase()}</span>
					<span class="arrow">→</span>
					<span class="virtual">{(mapping[physical] ?? '_').toUpperCase()}</span>
				</div>
			{/each}
		</div>
	{/each}
</div>

<style>
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

	.test-keycap {
		background: #f4f7fb;
		border-color: #d1dae6;
	}

	@media (max-width: 700px) {
		.keycap {
			width: 50px;
			font-size: 0.74rem;
			padding: 0.28rem;
		}
	}
</style>
