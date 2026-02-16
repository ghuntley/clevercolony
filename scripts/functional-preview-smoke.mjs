import process from 'node:process';
import { applyLocalD1Migrations } from './local-d1.mjs';
import { startPreviewServer, stopPreviewServer } from './preview-runtime.mjs';
import {
	PREVIEW_TEST_PASSWORD,
	PREVIEW_TEST_SESSION_SECRET,
	buildPasswordHash
} from './test-auth-credentials.mjs';

const REQUEST_TIMEOUT_MS = 15_000;

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function parseSetCookieValue(setCookieHeader) {
	const cookiePair = (setCookieHeader ?? '').split(';')[0] ?? '';
	return cookiePair.trim();
}

async function readJsonSafe(response) {
	try {
		return await response.json();
	} catch {
		return {};
	}
}

async function fetchWithTimeout(url, init) {
	const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
	const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
	return fetch(url, {
		...init,
		signal
	});
}

async function run() {
	await applyLocalD1Migrations();

	const preview = await startPreviewServer({
		extraEnv: {
			APP_ACCESS_PASSWORD_HASH: buildPasswordHash(PREVIEW_TEST_PASSWORD),
			APP_SESSION_SECRET: PREVIEW_TEST_SESSION_SECRET
		}
	});

	try {
		const unauthenticatedList = await fetchWithTimeout(`${preview.baseUrl}/api/conversations`, {
			redirect: 'manual'
		});
		assert(
			unauthenticatedList.status === 401,
			`Expected unauthenticated /api/conversations to return 401, got ${unauthenticatedList.status}`
		);

		const invalidLoginResponse = await fetchWithTimeout(`${preview.baseUrl}/api/auth/login`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				password: 'definitely-wrong'
			})
		});
		assert(
			invalidLoginResponse.status === 401,
			`Expected invalid login to return 401, got ${invalidLoginResponse.status}`
		);

		const loginResponse = await fetchWithTimeout(`${preview.baseUrl}/api/auth/login`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				password: PREVIEW_TEST_PASSWORD
			})
		});
		assert(loginResponse.status === 201, `Expected login 201, got ${loginResponse.status}`);
		const loginBody = await readJsonSafe(loginResponse);
		assert(loginBody.authenticated === true, 'Expected login response authenticated=true');
		const sessionCookie = parseSetCookieValue(loginResponse.headers.get('set-cookie') ?? '');
		assert(sessionCookie.startsWith('clever_colony_session='), 'Expected login to return session cookie');

		const createConversationResponse = await fetchWithTimeout(`${preview.baseUrl}/api/conversations`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				cookie: sessionCookie
			},
			body: JSON.stringify({
				title: 'Functional smoke conversation',
				provider: 'zai',
				model: 'glm-4.7'
			})
		});
		assert(
			createConversationResponse.status === 201,
			`Expected conversation create 201, got ${createConversationResponse.status}`
		);
		const createConversationBody = await readJsonSafe(createConversationResponse);
		const conversationId = createConversationBody.conversation?.id;
		assert(typeof conversationId === 'string' && conversationId.length > 0, 'Expected conversation id in create response');

		const listConversationsResponse = await fetchWithTimeout(`${preview.baseUrl}/api/conversations`, {
			headers: {
				cookie: sessionCookie
			}
		});
		assert(
			listConversationsResponse.status === 200,
			`Expected conversation list 200, got ${listConversationsResponse.status}`
		);
		const listConversationsBody = await readJsonSafe(listConversationsResponse);
		const listedConversation = (listConversationsBody.conversations ?? []).find(
			(conversation) => conversation.id === conversationId
		);
		assert(Boolean(listedConversation), 'Expected created conversation to appear in conversation list');

		const updateConversationResponse = await fetchWithTimeout(
			`${preview.baseUrl}/api/conversations/${conversationId}`,
			{
				method: 'PATCH',
				headers: {
					'content-type': 'application/json',
					cookie: sessionCookie
				},
				body: JSON.stringify({
					title: 'Functional smoke conversation (renamed)',
					isPinned: true
				})
			}
		);
		assert(
			updateConversationResponse.status === 200,
			`Expected conversation patch 200, got ${updateConversationResponse.status}`
		);
		const updateConversationBody = await readJsonSafe(updateConversationResponse);
		assert(updateConversationBody.conversation?.isPinned === true, 'Expected updated conversation to be pinned');
		assert(
			updateConversationBody.conversation?.title === 'Functional smoke conversation (renamed)',
			'Expected updated conversation title to match patched title'
		);

		const getConversationResponse = await fetchWithTimeout(`${preview.baseUrl}/api/conversations/${conversationId}`, {
			headers: {
				cookie: sessionCookie
			}
		});
		assert(
			getConversationResponse.status === 200,
			`Expected conversation get 200, got ${getConversationResponse.status}`
		);
		const getConversationBody = await readJsonSafe(getConversationResponse);
		assert(
			Array.isArray(getConversationBody.messages) && getConversationBody.messages.length === 0,
			'Expected new conversation to have empty messages array'
		);

		const createMemoryResponse = await fetchWithTimeout(`${preview.baseUrl}/api/memories`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				cookie: sessionCookie
			},
			body: JSON.stringify({
				scope: 'conversation',
				conversationId,
				content: 'Functional smoke memory content',
				tags: ['smoke', 'memory'],
				score: 0.9
			})
		});
		assert(createMemoryResponse.status === 201, `Expected memory create 201, got ${createMemoryResponse.status}`);
		const createMemoryBody = await readJsonSafe(createMemoryResponse);
		const memoryId = createMemoryBody.memory?.id;
		assert(typeof memoryId === 'string' && memoryId.length > 0, 'Expected memory id in create response');

		const listMemoriesResponse = await fetchWithTimeout(
			`${preview.baseUrl}/api/memories?conversationId=${encodeURIComponent(conversationId)}`,
			{
				headers: {
					cookie: sessionCookie
				}
			}
		);
		assert(listMemoriesResponse.status === 200, `Expected memory list 200, got ${listMemoriesResponse.status}`);
		const listMemoriesBody = await readJsonSafe(listMemoriesResponse);
		const listedMemory = (listMemoriesBody.memories ?? []).find((memory) => memory.id === memoryId);
		assert(Boolean(listedMemory), 'Expected created memory to appear in scoped memory list');

		const updateMemoryResponse = await fetchWithTimeout(`${preview.baseUrl}/api/memories`, {
			method: 'PATCH',
			headers: {
				'content-type': 'application/json',
				cookie: sessionCookie
			},
			body: JSON.stringify({
				id: memoryId,
				content: 'Functional smoke memory content (edited)',
				tags: ['smoke', 'edited'],
				score: 0.8
			})
		});
		assert(updateMemoryResponse.status === 200, `Expected memory update 200, got ${updateMemoryResponse.status}`);
		const updateMemoryBody = await readJsonSafe(updateMemoryResponse);
		assert(
			updateMemoryBody.memory?.content === 'Functional smoke memory content (edited)',
			'Expected updated memory content to match patch'
		);

		const deleteMemoryResponse = await fetchWithTimeout(
			`${preview.baseUrl}/api/memories?id=${encodeURIComponent(memoryId)}`,
			{
				method: 'DELETE',
				headers: {
					cookie: sessionCookie
				}
			}
		);
		assert(deleteMemoryResponse.status === 200, `Expected memory delete 200, got ${deleteMemoryResponse.status}`);

		const listAfterDeleteResponse = await fetchWithTimeout(
			`${preview.baseUrl}/api/memories?conversationId=${encodeURIComponent(conversationId)}`,
			{
				headers: {
					cookie: sessionCookie
				}
			}
		);
		const listAfterDeleteBody = await readJsonSafe(listAfterDeleteResponse);
		const deletedMemory = (listAfterDeleteBody.memories ?? []).find((memory) => memory.id === memoryId);
		assert(!deletedMemory, 'Expected deleted memory to no longer appear in memory list');

		const auditResponse = await fetchWithTimeout(
			`${preview.baseUrl}/api/audit?conversationId=${encodeURIComponent(conversationId)}&limit=50&verify=1`,
			{
				headers: {
					cookie: sessionCookie
				}
			}
		);
		assert(auditResponse.status === 200, `Expected audit fetch 200, got ${auditResponse.status}`);
		const auditBody = await readJsonSafe(auditResponse);
		assert(auditBody.chainValid === true, 'Expected audit hash chain to validate successfully');
		const actionTypes = new Set((auditBody.events ?? []).map((event) => event.actionType));
		for (const requiredActionType of [
			'conversation.create',
			'conversation.update',
			'memory.create',
			'memory.update',
			'memory.delete'
		]) {
			assert(actionTypes.has(requiredActionType), `Expected audit events to include ${requiredActionType}`);
		}

		const deleteConversationResponse = await fetchWithTimeout(
			`${preview.baseUrl}/api/conversations/${conversationId}`,
			{
				method: 'DELETE',
				headers: {
					cookie: sessionCookie
				}
			}
		);
		assert(
			deleteConversationResponse.status === 200,
			`Expected conversation delete 200, got ${deleteConversationResponse.status}`
		);

		const conversationAfterDeleteResponse = await fetchWithTimeout(
			`${preview.baseUrl}/api/conversations/${conversationId}`,
			{
				headers: {
					cookie: sessionCookie
				}
			}
		);
		assert(
			conversationAfterDeleteResponse.status === 404,
			`Expected deleted conversation fetch to return 404, got ${conversationAfterDeleteResponse.status}`
		);

		const logoutResponse = await fetchWithTimeout(`${preview.baseUrl}/api/auth/logout`, {
			method: 'POST',
			headers: {
				cookie: sessionCookie
			}
		});
		assert(logoutResponse.status === 200, `Expected logout 200, got ${logoutResponse.status}`);
		const logoutBody = await readJsonSafe(logoutResponse);
		assert(logoutBody.authenticated === false, 'Expected logout response authenticated=false');

		const listAfterLogoutResponse = await fetchWithTimeout(`${preview.baseUrl}/api/conversations`, {
			headers: {
				cookie: sessionCookie
			}
		});
		assert(
			listAfterLogoutResponse.status === 401,
			`Expected post-logout /api/conversations to return 401, got ${listAfterLogoutResponse.status}`
		);

		console.log('Functional preview smoke checks passed.');
	} finally {
		await stopPreviewServer(preview.child);
	}
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
