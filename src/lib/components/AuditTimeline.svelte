<script lang="ts">
	import type { AuditEvent } from '$lib/types';
	import { collectAuditActionTypes, filterAuditEvents } from '$lib/audit-filters';

	interface Props {
		events: AuditEvent[];
		chainValid?: boolean | null;
	}

	let { events, chainValid = null }: Props = $props();
	let selected = $state<AuditEvent | null>(null);
	let actionType = $state('');
	let conversationQuery = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');

	function formatTime(timestamp: number) {
		return new Date(timestamp).toLocaleString();
	}

	const actionTypes = $derived(collectAuditActionTypes(events));
	const filteredEvents = $derived(
		filterAuditEvents(events, {
			actionType,
			conversationQuery,
			dateFrom,
			dateTo
		})
	);
</script>

<section class="audit">
	<header>
		<h3>Immutable audit trail</h3>
		<div class="badges">
			<span class="badge">append-only + hash-chain</span>
			{#if chainValid === true}
				<span class="badge ok">chain verified</span>
			{:else if chainValid === false}
				<span class="badge danger">chain mismatch</span>
			{/if}
		</div>
	</header>

	<div class="filters">
		<label>
			Action
			<select bind:value={actionType}>
				<option value="">All</option>
				{#each actionTypes as action}
					<option value={action}>{action}</option>
				{/each}
			</select>
		</label>
		<label>
			Conversation
			<input bind:value={conversationQuery} placeholder="conv id contains..." />
		</label>
		<label>
			From
			<input bind:value={dateFrom} type="date" />
		</label>
		<label>
			To
			<input bind:value={dateTo} type="date" />
		</label>
	</div>

	<ul>
		{#each filteredEvents as event (event.id)}
			<li>
				<button type="button" class="row" onclick={() => (selected = event)}>
					<div>
						<strong>{event.actionType}</strong>
						<p>{formatTime(event.createdAt)}</p>
					</div>
					<small>{event.id.slice(0, 8)}…</small>
				</button>
			</li>
		{:else}
			<li class="empty">No events match current filters.</li>
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

	.badges {
		display: inline-flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.badge {
		border: 2px solid #7ea97e;
		padding: 0.2rem 0.4rem;
		font-size: 0.8rem;
	}

	.badge.ok {
		border-color: #7ea97e;
	}

	.badge.danger {
		border-color: #d27777;
	}

	.filters {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.filters label {
		display: grid;
		gap: 0.2rem;
		font-size: 0.85rem;
	}

	.filters input,
	.filters select {
		width: 100%;
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

	.empty {
		border: 2px dashed #555;
		padding: 0.6rem;
		color: #a0a0a0;
		font-size: 0.9rem;
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

	@media (max-width: 800px) {
		.filters {
			grid-template-columns: 1fr;
		}
	}
</style>
