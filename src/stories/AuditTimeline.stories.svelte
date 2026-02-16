<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AuditTimeline from '$lib/components/AuditTimeline.svelte';
	import type { AuditEvent } from '$lib/types';

	const sampleEvents: AuditEvent[] = [
		{
			id: 'evt_1',
			createdAt: Date.now() - 5000,
			actorSessionId: 'sess_123',
			conversationId: 'conv_abc',
			actionType: 'prompt.submit',
			payload: { model: 'glm-4.7', provider: 'zai', webSearchEnabled: true },
			promptText: 'Summarize latest SvelteKit release changes',
			prevHash: 'GENESIS',
			eventHash: 'hash_1'
		},
		{
			id: 'evt_2',
			createdAt: Date.now() - 3000,
			actorSessionId: 'sess_123',
			conversationId: 'conv_abc',
			actionType: 'memory.update',
			payload: { id: 'mem_5' },
			promptText: null,
			prevHash: 'hash_1',
			eventHash: 'hash_2'
		},
		{
			id: 'evt_3',
			createdAt: Date.now() - 1200,
			actorSessionId: 'sess_123',
			conversationId: 'conv_abc',
			actionType: 'tool.mermaid',
			payload: { length: 120 },
			promptText: null,
			prevHash: 'hash_2',
			eventHash: 'hash_3'
		}
	];

	const { Story } = defineMeta({
		title: 'CleverColony/AuditTimeline',
		component: AuditTimeline,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ events: sampleEvents }} />
