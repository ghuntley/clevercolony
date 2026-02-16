<script lang="ts">
	import type { AuditEvent } from '$lib/types';

	interface Props {
		events: AuditEvent[];
	}

	let { events }: Props = $props();
	let selected = $state<AuditEvent | null>(null);

	function formatTime(timestamp: number) {
		return new Date(timestamp).toLocaleString();
	}
</script>

<section class="audit">
	<header>
		<h3>Immutable audit trail</h3>
		<span class="badge">append-only + hash-chain</span>
	</header>

	<ul>
		{#each events as event (event.id)}
			<li>
				<button type="button" class="row" onclick={() => (selected = event)}>
					<div>
						<strong>{event.actionType}</strong>
						<p>{formatTime(event.createdAt)}</p>
					</div>
					<small>{event.id.slice(0, 8)}…</small>
				</button>
			</li>
		{/each}
	</ul>

	{#if selected}
		<aside>
			<header>
				<strong>{selected.actionType}</strong>
				<button type="button" onclick={() => (selected = null)}>Close</button>
			</header>
			<p><b>At:</b> {formatTime(selected.createdAt)}</p>
			<p><b>Session:</b> {selected.actorSessionId}</p>
			<p><b>Conversation:</b> {selected.conversationId ?? 'n/a'}</p>
			{#if selected.promptText}
				<details open>
					<summary>Prompt text</summary>
					<pre>{selected.promptText}</pre>
				</details>
			{/if}
			<details>
				<summary>Payload</summary>
				<pre>{JSON.stringify(selected.payload, null, 2)}</pre>
			</details>
			<details>
				<summary>Hash chain</summary>
				<pre>prev: {selected.prevHash}
event: {selected.eventHash}</pre
				>
			</details>
		</aside>
	{/if}
</section>

<style>
	.audit {
		display: grid;
		gap: 0.5rem;
	}

	.audit > header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.badge {
		border: 2px solid #7ea97e;
		padding: 0.2rem 0.4rem;
		font-size: 0.8rem;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.4rem;
		max-height: 18rem;
		overflow: auto;
	}

	.row {
		width: 100%;
		text-align: left;
		border: 2px solid #555;
		background: #151515;
		color: inherit;
		padding: 0.5rem;
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		cursor: pointer;
	}

	p {
		margin: 0.2rem 0;
	}

	aside {
		border: 2px solid #555;
		padding: 0.6rem;
		background: #121212;
	}

	aside > header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	pre {
		margin: 0.4rem 0 0;
		overflow-x: auto;
	}

	button {
		font: inherit;
		border: 2px solid #555;
		background: #101010;
		color: inherit;
	}
</style>
