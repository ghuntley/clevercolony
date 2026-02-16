const encoder = new TextEncoder();

export function sseChunk(data: unknown): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export function createTextSseStream(input: {
	text: string;
	delayMs?: number;
	metadata?: Record<string, unknown>;
}) {
	const delayMs = input.delayMs ?? 0;
	const chunks = input.text.split(/(\s+)/).filter((chunk) => chunk.length > 0);
	let index = 0;

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (index >= chunks.length) {
				controller.enqueue(sseChunk({ type: 'done', metadata: input.metadata ?? {} }));
				controller.close();
				return;
			}

			const token = chunks[index];
			index += 1;
			controller.enqueue(sseChunk({ type: 'token', token }));
			if (delayMs > 0) {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
	});
}
