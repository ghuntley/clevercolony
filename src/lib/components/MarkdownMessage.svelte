<script lang="ts">
	import DOMPurify from 'isomorphic-dompurify';
	import { marked } from 'marked';

	interface Props {
		content: string;
	}

	let { content }: Props = $props();

	const rendered = $derived(
		DOMPurify.sanitize(marked.parse(content, { breaks: true }) as string, {
			USE_PROFILES: { html: true }
		})
	);
</script>

<article class="markdown">{@html rendered}</article>

<style>
	.markdown :global(p) {
		margin: 0 0 0.8rem;
	}
	.markdown :global(pre) {
		padding: 0.8rem;
		border: 2px solid #666;
		overflow-x: auto;
		background: #141414;
	}
	.markdown :global(code) {
		font-family: inherit;
	}
	.markdown :global(ul),
	.markdown :global(ol) {
		padding-left: 1.5rem;
	}
	.markdown :global(a) {
		color: #88c0ff;
	}
</style>
