<script lang="ts">
	import { onMount } from 'svelte';
	import MarkdownMessage from '$lib/components/MarkdownMessage.svelte';
	import MermaidDiagram from '$lib/components/MermaidDiagram.svelte';
	import AuditTimeline from '$lib/components/AuditTimeline.svelte';
	import { groupConversationsByRecency } from '$lib/conversation-groups';
	import { sortConversations } from '$lib/conversation-sort';
	import { getModelOptionLabel } from '$lib/model-presentation';
	import { MAX_IMAGE_PROMPT_CHARS, MAX_TEXT_PROMPT_CHARS } from '$lib/request-limits';
	import type { AuditEvent, ChatMessage, Conversation, MemoryRecord, ModelDefinition } from '$lib/types';

	type Mode = 'chat' | 'image';
	type Theme = 'dark' | 'light';
	type AuditFilterState = {
		actionType: string;
		conversationQuery: string;
		dateFrom: string;
		dateTo: string;
	};
	const AUDIT_PAGE_SIZE = 100;

	let loading = $state(true);
	let errorMessage = $state('');
	let conversations = $state<Conversation[]>([]);
	let activeConversationId = $state<string | null>(null);
	let messages = $state<ChatMessage[]>([]);
	let models = $state<ModelDefinition[]>([]);
	let selectedModelId = $state('');
	let mode = $state<Mode>('chat');
	let theme = $state<Theme>('dark');
	let prompt = $state('');
	let generating = $state(false);
	let webSearchEnabled = $state(false);
	let conversationSearch = $state('');
	let selectedConversationIds = $state<string[]>([]);
	let memories = $state<MemoryRecord[]>([]);
	let newMemoryText = $state('');
	let editingMemoryId = $state<string | null>(null);
	let editingMemoryText = $state('');
	let auditEvents = $state<AuditEvent[]>([]);
	let auditChainValid = $state<boolean | null>(null);
	let auditOffset = $state(0);
	let auditHasMore = $state(false);
	let auditTotalCount = $state(0);
	let auditLoading = $state(false);
	let auditActionType = $state('');
	let auditConversationQuery = $state('');
	let auditDateFrom = $state('');
	let auditDateTo = $state('');
	let streamingText = $state('');
	let messagesContainer = $state<HTMLElement | null>(null);
	let sidebarOpen = $state(false);
	let rightRailOpen = $state(false);
	let isMobileViewport = $state(false);

	const filteredConversations = $derived(
		conversations.filter((conversation) =>
			conversation.title.toLowerCase().includes(conversationSearch.toLowerCase())
		)
	);

	const pinnedConversations = $derived(filteredConversations.filter((conversation) => conversation.isPinned));
	const regularConversations = $derived(filteredConversations.filter((conversation) => !conversation.isPinned));
	const regularConversationGroups = $derived(groupConversationsByRecency(regularConversations));
	const visibleConversationOrder = $derived([...pinnedConversations, ...regularConversations]);
	const activeConversation = $derived(conversations.find((conversation) => conversation.id === activeConversationId) ?? null);
	const canSubmitPrompt = $derived(!generating && Boolean(activeConversationId) && prompt.trim().length > 0);
	const canCreateMemory = $derived(newMemoryText.trim().length > 0);
	const canSaveMemoryEdit = $derived(editingMemoryText.trim().length > 0);
	const promptLimit = $derived(mode === 'chat' ? MAX_TEXT_PROMPT_CHARS : MAX_IMAGE_PROMPT_CHARS);

	function scrollMessagesToBottom() {
		if (!messagesContainer) return;
		messagesContainer.scrollTop = messagesContainer.scrollHeight;
	}

	function closeMobilePanels() {
		sidebarOpen = false;
		rightRailOpen = false;
	}

	function shouldIgnoreKeyboardShortcut(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		return (
			target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.tagName === 'SELECT' ||
			target.isContentEditable
		);
	}

	function switchConversationByOffset(offset: number) {
		if (!activeConversationId || visibleConversationOrder.length < 2) return;
		const index = visibleConversationOrder.findIndex((conversation) => conversation.id === activeConversationId);
		if (index < 0) return;
		const nextIndex = (index + offset + visibleConversationOrder.length) % visibleConversationOrder.length;
		const nextConversation = visibleConversationOrder[nextIndex];
		if (nextConversation && nextConversation.id !== activeConversationId) {
			void openConversation(nextConversation.id);
		}
	}

	$effect(() => {
		const availableModels = models.filter((model) => (mode === 'chat' ? model.modality === 'text' : model.modality === 'image'));
		if (availableModels.length === 0) return;
		if (!availableModels.some((model) => model.id === selectedModelId)) {
			selectedModelId = availableModels[0].id;
		}
	});

	$effect(() => {
		if (!activeConversation || !selectedModelId) return;
		if (activeConversation.model === selectedModelId) return;
		const model = models.find((item) => item.id === selectedModelId);
		if (!model) return;
		void updateConversation(activeConversation.id, {
			model: selectedModelId,
			provider: model.provider
		});
	});

	async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
		const response = await fetch(url, init);
		if (!response.ok) {
			const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
			throw new Error(body.message ?? body.error ?? `${response.status} ${response.statusText}`);
		}
		return response.json() as Promise<T>;
	}

	async function loadModels() {
		const data = await fetchJson<{ models: ModelDefinition[] }>('/api/models');
		models = data.models;
		if (!selectedModelId && models.length > 0) {
			selectedModelId = models.find((model) => model.modality === 'text')?.id ?? models[0].id;
		}
	}

	async function loadConversations() {
		const data = await fetchJson<{ conversations: Conversation[] }>('/api/conversations');
		conversations = sortConversations(data.conversations);
		if (!activeConversationId && conversations.length > 0) {
			await openConversation(conversations[0].id, false);
		}
	}

	async function openConversation(conversationId: string, syncModel = true) {
		activeConversationId = conversationId;
		const data = await fetchJson<{ messages: ChatMessage[] }>(`/api/conversations/${conversationId}`);
		messages = data.messages;
		queueMicrotask(scrollMessagesToBottom);
		if (isMobileViewport) {
			closeMobilePanels();
		}
		if (syncModel) {
			const conversation = conversations.find((item) => item.id === conversationId);
			if (conversation) {
				selectedModelId = conversation.model;
			}
		}
		await loadMemories();
	}

	async function createConversation() {
		const model = models.find((item) => item.id === selectedModelId);
		const data = await fetchJson<{ conversation: Conversation }>('/api/conversations', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				title: 'New chat',
				model: selectedModelId,
				provider: model?.provider
			})
		});
		conversations = sortConversations([data.conversation, ...conversations]);
		await openConversation(data.conversation.id, false);
	}

	async function updateConversation(conversationId: string, payload: Record<string, unknown>) {
		const data = await fetchJson<{ conversation: Conversation }>(`/api/conversations/${conversationId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
		conversations = sortConversations(
			conversations.map((conversation) => (conversation.id === conversationId ? data.conversation : conversation))
		);
	}

	async function renameConversation(conversationId: string) {
		const current = conversations.find((conversation) => conversation.id === conversationId);
		if (!current) return;
		const nextTitle = window.prompt('Rename conversation', current.title)?.trim();
		if (!nextTitle) return;
		await updateConversation(conversationId, { title: nextTitle });
	}

	async function togglePin(conversationId: string, isPinned: boolean) {
		await updateConversation(conversationId, { isPinned: !isPinned });
	}

	async function removeConversation(conversationId: string) {
		if (!confirm('Delete this conversation?')) return;
		await fetchJson<{ deleted: boolean }>(`/api/conversations/${conversationId}`, { method: 'DELETE' });
		conversations = sortConversations(conversations.filter((conversation) => conversation.id !== conversationId));
		if (activeConversationId === conversationId) {
			activeConversationId = null;
			messages = [];
			if (conversations.length > 0) {
				await openConversation(conversations[0].id, false);
			}
		}
	}

	function toggleBulkSelection(conversationId: string) {
		selectedConversationIds = selectedConversationIds.includes(conversationId)
			? selectedConversationIds.filter((item) => item !== conversationId)
			: [...selectedConversationIds, conversationId];
	}

	async function bulkPin(setPinned: boolean) {
		await Promise.all(
			selectedConversationIds.map((conversationId) => updateConversation(conversationId, { isPinned: setPinned }))
		);
		selectedConversationIds = [];
	}

	async function bulkDelete() {
		if (!confirm(`Delete ${selectedConversationIds.length} conversations?`)) return;
		await Promise.all(
			selectedConversationIds.map((conversationId) =>
				fetchJson<{ deleted: boolean }>(`/api/conversations/${conversationId}`, { method: 'DELETE' })
			)
		);
		conversations = sortConversations(
			conversations.filter((conversation) => !selectedConversationIds.includes(conversation.id))
		);
		if (activeConversationId && selectedConversationIds.includes(activeConversationId)) {
			activeConversationId = conversations[0]?.id ?? null;
			if (activeConversationId) {
				await openConversation(activeConversationId, false);
			} else {
				messages = [];
			}
		}
		selectedConversationIds = [];
	}

	async function loadMemories() {
		const query = activeConversationId ? `?conversationId=${encodeURIComponent(activeConversationId)}` : '';
		const data = await fetchJson<{ memories: MemoryRecord[] }>(`/api/memories${query}`);
		memories = data.memories;
	}

	async function createMemory() {
		const content = newMemoryText.trim();
		if (!content) return;
		const data = await fetchJson<{ memory: MemoryRecord }>('/api/memories', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				scope: activeConversationId ? 'conversation' : 'global',
				conversationId: activeConversationId,
				content
			})
		});
		memories = [data.memory, ...memories];
		newMemoryText = '';
	}

	async function saveMemoryEdit() {
		if (!editingMemoryId) return;
		const content = editingMemoryText.trim();
		if (!content) return;
		const data = await fetchJson<{ memory: MemoryRecord }>('/api/memories', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				id: editingMemoryId,
				content
			})
		});
		memories = memories.map((memory) => (memory.id === data.memory.id ? data.memory : memory));
		editingMemoryId = null;
		editingMemoryText = '';
	}

	async function removeMemory(id: string) {
		await fetchJson<{ deleted: boolean }>(`/api/memories?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
		memories = memories.filter((memory) => memory.id !== id);
	}

	async function loadAudit(options?: { reset?: boolean }) {
		const reset = options?.reset ?? true;
		if (auditLoading) return;
		auditLoading = true;
		const offset = reset ? 0 : auditOffset;
		const params = new URLSearchParams({
			limit: String(AUDIT_PAGE_SIZE),
			offset: String(offset),
			verify: reset ? '1' : '0'
		});
		if (auditActionType) params.set('actionType', auditActionType);
		if (auditConversationQuery) params.set('conversationQuery', auditConversationQuery);
		if (auditDateFrom) params.set('dateFrom', auditDateFrom);
		if (auditDateTo) params.set('dateTo', auditDateTo);
		try {
			const data = await fetchJson<{
				events: AuditEvent[];
				chainValid?: boolean;
				hasMore?: boolean;
				totalCount?: number;
			}>(`/api/audit?${params.toString()}`);
			auditEvents = reset ? data.events : [...auditEvents, ...data.events];
			auditOffset = offset + data.events.length;
			auditHasMore = Boolean(data.hasMore);
			if (typeof data.totalCount === 'number') {
				auditTotalCount = data.totalCount;
			}
			if (reset) {
				auditChainValid = typeof data.chainValid === 'boolean' ? data.chainValid : null;
			}
		} finally {
			auditLoading = false;
		}
	}

	function handleAuditFilterChange(next: AuditFilterState) {
		const changed =
			auditActionType !== next.actionType ||
			auditConversationQuery !== next.conversationQuery ||
			auditDateFrom !== next.dateFrom ||
			auditDateTo !== next.dateTo;
		if (!changed) return;
		auditActionType = next.actionType;
		auditConversationQuery = next.conversationQuery;
		auditDateFrom = next.dateFrom;
		auditDateTo = next.dateTo;
		void loadAudit({ reset: true });
	}

	function parseSseFrame(frame: string): { type: string; token?: string; metadata?: Record<string, unknown> } | null {
		const line = frame
			.split('\n')
			.map((entry) => entry.trim())
			.find((entry) => entry.startsWith('data:'));
		if (!line) return null;
		try {
			return JSON.parse(line.slice(5).trim()) as {
				type: string;
				token?: string;
				metadata?: Record<string, unknown>;
			};
		} catch {
			return null;
		}
	}

	function appendMessage(message: ChatMessage) {
		messages = [...messages, message];
		queueMicrotask(scrollMessagesToBottom);
	}

	async function sendChatPrompt() {
		if (generating || !activeConversationId || !prompt.trim()) return;
		const messageText = prompt.trim();
		prompt = '';
		generating = true;
		streamingText = '';
		const model = models.find((item) => item.id === selectedModelId);

		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			conversationId: activeConversationId,
			role: 'user',
			contentType: 'text',
			content: messageText,
			createdAt: Date.now(),
			updatedAt: Date.now()
		};
		appendMessage(userMessage);

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					conversationId: activeConversationId,
					text: messageText,
					model: selectedModelId,
					provider: model?.provider,
					webSearchEnabled
				})
			});
			if (!response.ok || !response.body) {
				throw new Error('Unable to stream assistant response');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let doneMetadata: Record<string, unknown> | null = null;
			while (true) {
				const chunk = await reader.read();
				if (chunk.done) break;
				buffer += decoder.decode(chunk.value, { stream: true });
				const frames = buffer.split('\n\n');
				buffer = frames.pop() ?? '';
				for (const frame of frames) {
					const data = parseSseFrame(frame);
					if (!data) continue;
					if (data.type === 'token' && data.token) {
						streamingText += data.token;
						queueMicrotask(scrollMessagesToBottom);
					}
					if (data.type === 'done') {
						doneMetadata = data.metadata ?? null;
					}
				}
			}

			appendMessage({
				id: (doneMetadata?.messageId as string) ?? crypto.randomUUID(),
				conversationId: activeConversationId,
				role: 'assistant',
				contentType: 'text',
				content: streamingText,
				metadata: {
					citations: doneMetadata?.citations ?? []
				},
				createdAt: Date.now(),
				updatedAt: Date.now()
			});

			const diagram = doneMetadata?.diagram as { mermaidSource?: string } | undefined;
			if (diagram?.mermaidSource) {
				appendMessage({
					id: crypto.randomUUID(),
					conversationId: activeConversationId,
					role: 'assistant',
					contentType: 'diagram',
					content: diagram.mermaidSource,
					metadata: diagram,
					createdAt: Date.now(),
					updatedAt: Date.now()
				});
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to send message';
		} finally {
			generating = false;
			streamingText = '';
			await loadConversations();
			await loadAudit({ reset: true });
		}
	}

	$effect(() => {
		streamingText;
		if (!streamingText) return;
		queueMicrotask(scrollMessagesToBottom);
	});

	$effect(() => {
		if (typeof document === 'undefined') return;
		const shouldLockScroll = isMobileViewport && (sidebarOpen || rightRailOpen);
		document.body.style.overflow = shouldLockScroll ? 'hidden' : '';
		return () => {
			document.body.style.overflow = '';
		};
	});

	async function sendImagePrompt() {
		if (generating || !activeConversationId || !prompt.trim()) return;
		const model = models.find((item) => item.id === selectedModelId);
		generating = true;
		try {
			await fetchJson('/api/images', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					conversationId: activeConversationId,
					prompt: prompt.trim(),
					model: selectedModelId,
					provider: model?.provider
				})
			});
			prompt = '';
			await openConversation(activeConversationId, false);
			await loadAudit({ reset: true });
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
		} finally {
			generating = false;
		}
	}

	async function handleSubmit() {
		errorMessage = '';
		if (!canSubmitPrompt) return;
		if (mode === 'chat') {
			await sendChatPrompt();
			return;
		}
		await sendImagePrompt();
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/login';
	}

	function applyTheme(nextTheme: Theme) {
		theme = nextTheme;
		document.documentElement.dataset.theme = nextTheme;
		window.localStorage.setItem('clever-colony-theme', nextTheme);
	}

	onMount(() => {
		const mobileQuery = window.matchMedia('(max-width: 900px)');
		const syncViewport = () => {
			isMobileViewport = mobileQuery.matches;
			if (!mobileQuery.matches) {
				closeMobilePanels();
			}
		};
		syncViewport();
		mobileQuery.addEventListener('change', syncViewport);

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && (sidebarOpen || rightRailOpen)) {
				closeMobilePanels();
				return;
			}
			if (shouldIgnoreKeyboardShortcut(event.target)) return;
			const isModifier = event.ctrlKey || event.metaKey;
			if (isModifier && event.shiftKey && event.key === 'ArrowUp') {
				event.preventDefault();
				switchConversationByOffset(-1);
				return;
			}
			if (isModifier && event.shiftKey && event.key === 'ArrowDown') {
				event.preventDefault();
				switchConversationByOffset(1);
				return;
			}
			if (isModifier && event.shiftKey && event.key.toLowerCase() === 'o') {
				event.preventDefault();
				void createConversation();
			}
		};
		window.addEventListener('keydown', onKeyDown);

		const storedTheme = window.localStorage.getItem('clever-colony-theme');
		if (storedTheme === 'dark' || storedTheme === 'light') {
			applyTheme(storedTheme);
		} else {
			applyTheme(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
		}

		void (async () => {
			try {
				await Promise.all([loadModels(), loadConversations(), loadAudit()]);
				await loadMemories();
			} catch (error) {
				errorMessage = error instanceof Error ? error.message : 'Failed to initialize application';
			} finally {
				loading = false;
			}
		})();

		return () => {
			window.removeEventListener('keydown', onKeyDown);
			mobileQuery.removeEventListener('change', syncViewport);
		};
	});
</script>

{#if loading}
	<main class="loading">Loading Clever Colony…</main>
{:else}
	<div class="app">
		<aside class="sidebar {isMobileViewport && sidebarOpen ? 'open' : ''}">
			<header>
				<h1>Clever Colony</h1>
				<button type="button" onclick={createConversation}>+ New chat</button>
				{#if isMobileViewport}
					<button type="button" class="panel-close" onclick={closeMobilePanels}>✕</button>
				{/if}
			</header>
			<input bind:value={conversationSearch} placeholder="Search your threads…" />

			{#if selectedConversationIds.length > 0}
				<div class="bulk">
					<span>{selectedConversationIds.length} selected</span>
					<button type="button" onclick={() => bulkPin(true)}>Pin</button>
					<button type="button" onclick={() => bulkPin(false)}>Unpin</button>
					<button type="button" onclick={bulkDelete}>Delete</button>
				</div>
			{/if}

			{#if pinnedConversations.length > 0}
				<section>
					<h2>Pinned</h2>
					{#each pinnedConversations as conversation (conversation.id)}
						<div class="conversation-row {activeConversationId === conversation.id ? 'active' : ''}">
							<input
								type="checkbox"
								checked={selectedConversationIds.includes(conversation.id)}
								onchange={() => toggleBulkSelection(conversation.id)}
							/>
							<button type="button" class="title" onclick={() => openConversation(conversation.id)}>
								{conversation.title}
							</button>
							<div class="row-actions">
								<button type="button" onclick={() => renameConversation(conversation.id)}>✎</button>
								<button type="button" onclick={() => togglePin(conversation.id, conversation.isPinned)}>★</button>
								<button type="button" onclick={() => removeConversation(conversation.id)}>⌫</button>
							</div>
						</div>
					{/each}
				</section>
			{/if}

			<section>
				<h2>Chats</h2>
				{#each regularConversationGroups as group (group.label)}
					<div class="conversation-group">
						<h3>{group.label}</h3>
						{#each group.conversations as conversation (conversation.id)}
							<div class="conversation-row {activeConversationId === conversation.id ? 'active' : ''}">
								<input
									type="checkbox"
									checked={selectedConversationIds.includes(conversation.id)}
									onchange={() => toggleBulkSelection(conversation.id)}
								/>
								<button type="button" class="title" onclick={() => openConversation(conversation.id)}>
									{conversation.title}
								</button>
								<div class="row-actions">
									<button type="button" onclick={() => renameConversation(conversation.id)}>✎</button>
									<button type="button" onclick={() => togglePin(conversation.id, conversation.isPinned)}>☆</button>
									<button type="button" onclick={() => removeConversation(conversation.id)}>⌫</button>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="sidebar-empty">No chats found.</p>
				{/each}
			</section>

			<button type="button" class="logout" onclick={logout}>Logout</button>
		</aside>

		<main class="chat">
			<header class="chat-header">
				<div>
					<h2>{activeConversation?.title ?? 'No conversation selected'}</h2>
					<p>{activeConversation ? activeConversation.model : 'Choose a conversation to start'}</p>
				</div>
				{#if isMobileViewport}
					<div class="mobile-panel-controls">
						<button
							type="button"
							onclick={() => {
								sidebarOpen = true;
								rightRailOpen = false;
							}}
						>
							Threads
						</button>
						<button
							type="button"
							onclick={() => {
								rightRailOpen = true;
								sidebarOpen = false;
							}}
						>
							Context
						</button>
					</div>
				{/if}
				<div class="controls">
					<label>
						Mode
						<select bind:value={mode}>
							<option value="chat">Chat</option>
							<option value="image">Image</option>
						</select>
					</label>
					<label>
						Model
						<select bind:value={selectedModelId}>
							{#each models.filter((model) => (mode === 'chat' ? model.modality === 'text' : model.modality === 'image')) as model}
								<option value={model.id}>{getModelOptionLabel(model)}</option>
							{/each}
						</select>
					</label>
					<label class="toggle">
						<input type="checkbox" bind:checked={webSearchEnabled} disabled={mode !== 'chat'} />
						Web search
					</label>
					<button type="button" disabled title="File attachments are not enabled in this release">
						Attachments (soon)
					</button>
					<button type="button" onclick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}>
						Theme: {theme === 'dark' ? 'Dark' : 'Light'}
					</button>
				</div>
			</header>

			<section class="messages" bind:this={messagesContainer}>
				{#if messages.length === 0}
					<p class="empty">Start a new chat and send a prompt.</p>
				{/if}
				{#each messages as message (message.id)}
					<article class="message {message.role}">
						<header>
							<strong>{message.role}</strong>
							<time>{new Date(message.createdAt).toLocaleTimeString()}</time>
						</header>
						{#if message.contentType === 'text'}
							<MarkdownMessage content={message.content} />
							{@const citations = (message.metadata?.citations ?? []) as Array<{ title: string; url: string }>}
							{@const webSearchStatus = (message.metadata?.webSearchStatus ?? '') as string}
							{#if citations.length}
								<footer>
									<strong>Sources</strong>
									<ul>
										{#each citations as citation}
											<li><a href={citation.url} target="_blank" rel="noopener noreferrer">{citation.title}</a></li>
										{/each}
									</ul>
								</footer>
							{:else if webSearchStatus === 'missing_api_key'}
								<p class="status-note">Web search skipped: SERPER_API_KEY is not configured.</p>
							{:else if webSearchStatus === 'error'}
								<p class="status-note">Web search unavailable for this response.</p>
							{/if}
						{:else if message.contentType === 'image'}
							<p>{message.content}</p>
							{#if typeof message.metadata?.url === 'string'}
								<img src={message.metadata.url} alt="Generated artwork" loading="lazy" />
							{/if}
						{:else if message.contentType === 'diagram'}
							<MermaidDiagram source={message.content} />
						{/if}
					</article>
				{/each}
				{#if streamingText}
					<article class="message assistant streaming">
						<header>
							<strong>assistant</strong>
							<time>streaming…</time>
						</header>
						<MarkdownMessage content={streamingText} />
					</article>
				{/if}
			</section>

			<form
				class="composer"
				onsubmit={(event) => {
					event.preventDefault();
					void handleSubmit();
				}}
				title="Enter to send · Shift+Enter newline · Ctrl/Cmd+Shift+O new chat · Ctrl/Cmd+Shift+↑/↓ switch thread"
			>
				<textarea
					bind:value={prompt}
					rows="4"
					maxlength={promptLimit}
					placeholder={mode === 'chat'
						? 'Ask anything (Enter to send, Shift+Enter newline)'
						: 'Describe the image you want to generate'}
					onkeydown={(event) => {
						if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
							event.preventDefault();
							void handleSubmit();
						}
					}}
				></textarea>
				<p class="composer-count">{prompt.length}/{promptLimit}</p>
				<button type="submit" disabled={!canSubmitPrompt}>
					{generating ? 'Working…' : mode === 'chat' ? 'Send' : 'Generate image'}
				</button>
			</form>

			{#if errorMessage}
				<p class="error">{errorMessage}</p>
			{/if}
		</main>

		<aside class="right-rail {isMobileViewport && rightRailOpen ? 'open' : ''}">
			{#if isMobileViewport}
				<div class="right-rail-mobile-header">
					<strong>Context panel</strong>
					<button type="button" class="panel-close" onclick={closeMobilePanels}>✕</button>
				</div>
			{/if}
			<section class="memory">
				<header>
					<h3>Memory subsystem</h3>
				</header>
				<div class="memory-create">
					<textarea bind:value={newMemoryText} rows="3" placeholder="Remember this…"></textarea>
					<button type="button" onclick={createMemory} disabled={!canCreateMemory}>Add memory</button>
				</div>
				<ul>
					{#each memories as memory (memory.id)}
						<li>
							{#if editingMemoryId === memory.id}
								<textarea bind:value={editingMemoryText} rows="3"></textarea>
								<div class="memory-actions">
									<button type="button" onclick={saveMemoryEdit} disabled={!canSaveMemoryEdit}>Save</button>
									<button
										type="button"
										onclick={() => {
											editingMemoryId = null;
											editingMemoryText = '';
										}}
									>
										Cancel
									</button>
								</div>
							{:else}
								<p>{memory.content}</p>
								<div class="memory-actions">
									<button
										type="button"
										onclick={() => {
											editingMemoryId = memory.id;
											editingMemoryText = memory.content;
										}}
									>
										Edit
									</button>
									<button type="button" onclick={() => removeMemory(memory.id)}>Delete</button>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</section>

			<AuditTimeline
				events={auditEvents}
				chainValid={auditChainValid}
				onFilterChange={handleAuditFilterChange}
			/>
			<div class="audit-controls">
				<p class="audit-count">Loaded {auditEvents.length}{auditTotalCount ? ` / ${auditTotalCount}` : ''} events</p>
				<button type="button" onclick={() => loadAudit({ reset: true })} disabled={auditLoading}>
					{auditLoading ? 'Refreshing…' : 'Refresh audit'}
				</button>
				{#if auditHasMore}
					<button type="button" onclick={() => loadAudit({ reset: false })} disabled={auditLoading}>
						{auditLoading ? 'Loading…' : 'Load older events'}
					</button>
				{/if}
			</div>
		</aside>

		{#if isMobileViewport && (sidebarOpen || rightRailOpen)}
			<button type="button" class="overlay-backdrop" onclick={closeMobilePanels} aria-label="Close side panels"></button>
		{/if}
	</div>
{/if}

<style>
	:global(html) {
		--cc-bg: #0f0f0f;
		--cc-text: #f3f3f3;
		--cc-border-strong: #555;
		--cc-border-soft: #444;
		--cc-surface: #151515;
		--cc-surface-muted: #141414;
		--cc-surface-subtle: #121212;
		--cc-accent-user: #6e8fbe;
		--cc-accent-assistant: #6d8f6d;
		--cc-accent-active: #7ea97e;
		--cc-error: #ff8b8b;
	}

	:global(html[data-theme='light']) {
		--cc-bg: #f5f5f5;
		--cc-text: #1c1c1c;
		--cc-border-strong: #606060;
		--cc-border-soft: #888;
		--cc-surface: #ffffff;
		--cc-surface-muted: #f1f1f1;
		--cc-surface-subtle: #ececec;
		--cc-accent-user: #3f69a6;
		--cc-accent-assistant: #3e7a3e;
		--cc-accent-active: #2f7d32;
		--cc-error: #b41f1f;
	}

	:global(body) {
		margin: 0;
		background: var(--cc-bg);
		color: var(--cc-text);
		font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
			'Courier New', monospace;
		font-variant-numeric: tabular-nums lining-nums;
	}

	.loading {
		min-height: 100vh;
		display: grid;
		place-items: center;
	}

	.app {
		display: grid;
		grid-template-columns: 34ch 1fr 34ch;
		min-height: 100vh;
	}

	.sidebar,
	.chat,
	.right-rail {
		border-right: 2px solid var(--cc-border-soft);
		padding: 1rem;
	}

	.right-rail {
		border-right: none;
	}

	.sidebar header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
		gap: 0.35rem;
	}

	input,
	select,
	textarea,
	button {
		font: inherit;
		color: inherit;
		background: var(--cc-surface);
		border: 2px solid var(--cc-border-strong);
		padding: 0.45rem 0.6rem;
	}

	button {
		cursor: pointer;
	}

	.sidebar > input {
		width: 100%;
		margin-bottom: 0.75rem;
	}

	.bulk {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin-bottom: 0.6rem;
	}

	section {
		margin-bottom: 1rem;
	}

	h1,
	h2,
	h3 {
		margin: 0 0 0.5rem;
	}

	.conversation-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 0.35rem;
	}

	.conversation-group h3 {
		margin: 0.55rem 0;
		font-size: 0.85rem;
		opacity: 0.82;
	}

	.sidebar-empty {
		margin: 0.5rem 0;
		opacity: 0.8;
		font-size: 0.9rem;
	}

	.conversation-row.active {
		outline: 2px solid var(--cc-accent-active);
	}

	.conversation-row .title {
		text-align: left;
	}

	.row-actions {
		display: inline-flex;
		gap: 0.3rem;
	}

	.logout {
		width: 100%;
	}

	.chat {
		display: grid;
		grid-template-rows: auto 1fr auto auto;
		gap: 1rem;
	}

	.chat-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.mobile-panel-controls {
		display: inline-flex;
		gap: 0.4rem;
	}

	.controls {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.controls label {
		display: grid;
		gap: 0.25rem;
	}

	.toggle {
		display: inline-flex !important;
		align-items: center;
		gap: 0.4rem;
	}

	.messages {
		overflow: auto;
		display: grid;
		gap: 0.8rem;
		padding-right: 0.3rem;
	}

	.message {
		border: 2px solid var(--cc-border-strong);
		padding: 0.75rem;
		background: var(--cc-surface-muted);
	}

	.message header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.55rem;
	}

	.message.user {
		border-color: var(--cc-accent-user);
	}

	.message.assistant {
		border-color: var(--cc-accent-assistant);
	}

	.message footer {
		margin-top: 0.6rem;
	}

	.message ul {
		margin: 0.4rem 0 0;
		padding-left: 1.3rem;
	}

	.status-note {
		margin: 0.6rem 0 0;
		opacity: 0.82;
		font-size: 0.88rem;
	}

	.message img {
		max-width: 100%;
		border: 2px solid var(--cc-border-strong);
	}

	.composer {
		display: grid;
		gap: 0.5rem;
	}

	.composer-count {
		margin: 0;
		font-size: 0.82rem;
		opacity: 0.78;
		text-align: right;
	}

	.error {
		margin: 0;
		color: var(--cc-error);
	}

	.memory {
		border: 2px solid var(--cc-border-strong);
		padding: 0.7rem;
		background: var(--cc-surface-subtle);
	}

	.memory-create {
		display: grid;
		gap: 0.45rem;
		margin-bottom: 0.75rem;
	}

	.memory ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.55rem;
		max-height: 26vh;
		overflow: auto;
	}

	.memory li {
		border: 2px solid var(--cc-border-soft);
		padding: 0.55rem;
	}

	.memory p {
		margin: 0;
	}

	.memory-actions {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.45rem;
	}

	.audit-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.65rem;
	}

	.audit-count {
		margin: 0;
		font-size: 0.85rem;
		opacity: 0.82;
		flex-basis: 100%;
	}

	.right-rail-mobile-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.7rem;
	}

	@media (max-width: 1300px) {
		.app {
			grid-template-columns: 30ch 1fr;
		}

		.right-rail {
			grid-column: 1 / -1;
			border-top: 2px solid var(--cc-border-soft);
		}
	}

	@media (max-width: 900px) {
		.app {
			grid-template-columns: 1fr;
		}

		.chat {
			border-right: none;
			border-bottom: none;
		}

		.sidebar,
		.right-rail {
			position: fixed;
			top: 0;
			bottom: 0;
			width: min(92vw, 34ch);
			background: var(--cc-bg);
			overflow: auto;
			z-index: 40;
			transition: transform 0.15s ease;
			padding-top: 0.8rem;
			padding-bottom: 1rem;
		}

		.sidebar {
			left: 0;
			transform: translateX(-105%);
			border-right: 2px solid var(--cc-border-soft);
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.right-rail {
			right: 0;
			transform: translateX(105%);
			border-left: 2px solid var(--cc-border-soft);
		}

		.right-rail.open {
			transform: translateX(0);
		}

		.overlay-backdrop {
			position: fixed;
			inset: 0;
			z-index: 30;
			background: rgb(0 0 0 / 0.45);
			border: none;
			padding: 0;
		}

		.panel-close {
			min-width: 2.4rem;
		}
	}
</style>
