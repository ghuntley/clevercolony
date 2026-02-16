export type ProviderId = 'zai' | 'cloudflare-ai';

export type ToolName = 'web_search' | 'mermaid';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type MessageContentType = 'text' | 'image' | 'diagram';

export interface ModelDefinition {
	id: string;
	provider: ProviderId;
	label: string;
	preset: 'fast' | 'balanced' | 'reasoning' | 'image-fast' | 'image-quality';
	modality: 'text' | 'image';
}

export interface Conversation {
	id: string;
	title: string;
	isPinned: boolean;
	provider: ProviderId;
	model: string;
	createdAt: number;
	updatedAt: number;
}

export interface ChatMessage {
	id: string;
	conversationId: string;
	role: MessageRole;
	contentType: MessageContentType;
	content: string;
	metadata?: Record<string, unknown>;
	createdAt: number;
	updatedAt: number;
}

export interface MemoryRecord {
	id: string;
	scope: 'global' | 'conversation';
	conversationId: string | null;
	content: string;
	tags: string[];
	score: number;
	createdAt: number;
	updatedAt: number;
}

export interface AuditEvent {
	id: string;
	createdAt: number;
	actorSessionId: string;
	conversationId: string | null;
	actionType: string;
	payload: Record<string, unknown>;
	promptText: string | null;
	prevHash: string;
	eventHash: string;
}

export interface Citation {
	title: string;
	url: string;
	snippet: string;
	source?: string;
}

export interface DiagramPayload {
	diagramType: 'mermaid';
	mermaidSource: string;
	title?: string;
}
