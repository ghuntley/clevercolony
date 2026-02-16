import { describe, expect, it } from 'vitest';
import { createTextSseStream } from './sse';

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let output = '';
	while (true) {
		const chunk = await reader.read();
		if (chunk.done) break;
		output += decoder.decode(chunk.value, { stream: true });
	}
	return output;
}

describe('createTextSseStream', () => {
	it('emits token and done frames', async () => {
		const stream = createTextSseStream({
			text: 'hello world',
			metadata: { messageId: 'msg_1' }
		});
		const raw = await readStream(stream);
		const frames = raw
			.split('\n\n')
			.map((frame) => frame.trim())
			.filter(Boolean)
			.map((frame) => JSON.parse(frame.replace(/^data:\s*/, '')) as { type: string; token?: string });

		const tokens = frames.filter((frame) => frame.type === 'token').map((frame) => frame.token ?? '');
		expect(tokens.join('')).toBe('hello world');
		expect(frames.at(-1)?.type).toBe('done');
	});
});
