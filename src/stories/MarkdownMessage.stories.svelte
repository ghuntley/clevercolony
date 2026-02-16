<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MarkdownMessage from '$lib/components/MarkdownMessage.svelte';

	const { Story } = defineMeta({
		title: 'CleverColony/MarkdownMessage',
		component: MarkdownMessage,
		tags: ['autodocs']
	});
</script>

<Story
	name="Default"
	args={{
		content:
			'# Clever Colony\n\nThis is **markdown** with a [source link](https://example.com).\n\n```ts\nconst hello = \"world\";\n```'
	}}
/>
