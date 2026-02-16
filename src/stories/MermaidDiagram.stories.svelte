<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MermaidDiagram from '$lib/components/MermaidDiagram.svelte';

	const { Story } = defineMeta({
		title: 'CleverColony/MermaidDiagram',
		component: MermaidDiagram,
		tags: ['autodocs']
	});
</script>

<Story
	name="Flowchart"
	args={{
		source: `flowchart TD
    A[User Prompt] --> B{Tool Enabled?}
    B -->|Yes| C[Run Web Search]
    B -->|No| D[Model Response]
    C --> D`
	}}
/>

<Story
	name="Invalid Source Fallback"
	args={{
		source: `flowchart TD
    A --> --> B`
	}}
/>
