<script lang="ts">
	import mermaid from 'mermaid';
	import { onMount } from 'svelte';

	interface Props {
		source: string;
	}

	let { source }: Props = $props();
	let svg = $state<string>('');
	let renderError = $state<string>('');
	let expandedSource = $state(false);

	onMount(async () => {
		try {
			mermaid.initialize({
				startOnLoad: false,
				securityLevel: 'strict',
				theme: 'dark'
			});
			const id = `mermaid-${crypto.randomUUID()}`;
			const rendered = await mermaid.render(id, source);
			svg = rendered.svg;
		} catch (error) {
			renderError = error instanceof Error ? error.message : 'Unable to render diagram';
		}
	});
</script>

<section class="diagram">
	<header>
		<strong>Mermaid diagram</strong>
		<div class="actions">
			<button type="button" onclick={() => (expandedSource = !expandedSource)}>
				{expandedSource ? 'Hide source' : 'Show source'}
			</button>
			<button type="button" onclick={() => navigator.clipboard.writeText(source)}>Copy source</button>
		</div>
	</header>

	{#if renderError}
		<p class="error">Render failed: {renderError}</p>
	{/if}

	{#if svg}
		<div class="svg">{@html svg}</div>
	{/if}

	{#if expandedSource || renderError}
		<pre>{source}</pre>
	{/if}
</section>

<style>
	.diagram {
		border: 2px solid #666;
		padding: 0.75rem;
		background: #141414;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.6rem;
	}

	.actions {
		display: inline-flex;
		gap: 0.4rem;
	}

	button {
		font: inherit;
		border: 2px solid #666;
		background: #111;
		color: inherit;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
	}

	.svg {
		overflow-x: auto;
	}

	pre {
		margin: 0;
		border: 2px solid #444;
		padding: 0.6rem;
		overflow-x: auto;
	}

	.error {
		color: #ff8b8b;
	}
</style>
