import { spawn } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

async function findAvailablePort() {
	const server = createServer();
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	const address = server.address();
	if (!address || typeof address === 'string') {
		server.close();
		throw new Error('Unable to determine available local port for preview smoke checks.');
	}
	const port = address.port;
	await new Promise((resolve, reject) => {
		server.close((error) => {
			if (error) reject(error);
			else resolve();
		});
	});
	return port;
}

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

async function readJsonSafe(response) {
	try {
		return await response.json();
	} catch {
		return {};
	}
}

function toBase64Url(bytes) {
	return Buffer.from(bytes)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function buildPasswordHash(password, iterations = 210_000) {
	const salt = randomBytes(16);
	const digest = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
	return `pbkdf2_sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(digest)}`;
}

function parseSetCookieValue(setCookieHeader) {
	const cookiePair = (setCookieHeader ?? '').split(';')[0] ?? '';
	return cookiePair.trim();
}

async function waitForPreviewServer(child, baseUrl) {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		if (child.exitCode !== null) {
			throw new Error(`Preview server exited unexpectedly with code ${child.exitCode}`);
		}

		try {
			const response = await fetch(`${baseUrl}/api/health`);
			if (response.ok) {
				return;
			}
		} catch {
			// retry
		}

		await delay(500);
	}

	throw new Error('Timed out waiting for preview server to accept requests.');
}

async function stopPreviewServer(child) {
	if (child.exitCode !== null) return;

	child.kill('SIGTERM');
	await Promise.race([
		new Promise((resolve) => child.once('exit', resolve)),
		delay(5000)
	]);

	if (child.exitCode === null) {
		child.kill('SIGKILL');
		await new Promise((resolve) => child.once('exit', resolve));
	}
}

async function run() {
	const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
	const previewPort = await findAvailablePort();
	const baseUrl = `http://127.0.0.1:${previewPort}`;
	const testPassword = 'preview-smoke-password';
	const testPasswordHash = buildPasswordHash(testPassword);
	const sessionSecret = 'preview-smoke-session-secret';
	const preview = spawn(npmCommand, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(previewPort)], {
		stdio: 'inherit',
		env: {
			...process.env,
			CI: '1',
			APP_ACCESS_PASSWORD_HASH: testPasswordHash,
			APP_SESSION_SECRET: sessionSecret
		}
	});

	try {
		await waitForPreviewServer(preview, baseUrl);

		const healthResponse = await fetch(`${baseUrl}/api/health`);
		assert(healthResponse.status === 200, `Expected /api/health 200, got ${healthResponse.status}`);
		const healthBody = await healthResponse.json();
		assert(healthBody.status === 'ok', 'Expected /api/health payload status=ok');
		assert(
			typeof healthBody.timestamp === 'number' && Number.isFinite(healthBody.timestamp),
			'Expected /api/health payload to include numeric timestamp'
		);
		const healthSubpathResponse = await fetch(`${baseUrl}/api/health/ready`, { redirect: 'manual' });
		assert(
			healthSubpathResponse.status === 401,
			`Expected /api/health/ready to stay protected with 401, got ${healthSubpathResponse.status}`
		);

		const rootResponse = await fetch(`${baseUrl}/`, { redirect: 'manual' });
		assert(rootResponse.status === 303, `Expected / to redirect with 303, got ${rootResponse.status}`);
		const location = rootResponse.headers.get('location') ?? '';
		assert(location.endsWith('/login'), `Expected / redirect location to end with /login, got "${location}"`);

		const robotsResponse = await fetch(`${baseUrl}/robots.txt`);
		assert(robotsResponse.status === 200, `Expected /robots.txt 200, got ${robotsResponse.status}`);
		const robotsBody = await robotsResponse.text();
		assert(
			robotsBody.includes('Sitemap: /sitemap.xml'),
			'Expected /robots.txt to advertise sitemap location'
		);

		const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
		assert(sitemapResponse.status === 200, `Expected /sitemap.xml 200, got ${sitemapResponse.status}`);
		const sitemapContentType = sitemapResponse.headers.get('content-type') ?? '';
		assert(
			sitemapContentType.includes('application/xml'),
			`Expected /sitemap.xml content-type to include application/xml, got ${sitemapContentType}`
		);
		const sitemapBody = await sitemapResponse.text();
		assert(
			sitemapBody.includes(`<loc>${baseUrl}/login</loc>`),
			'Expected /sitemap.xml to contain login URL entry for preview origin'
		);

		const manifestResponse = await fetch(`${baseUrl}/manifest.webmanifest`);
		assert(
			manifestResponse.status === 200,
			`Expected /manifest.webmanifest 200, got ${manifestResponse.status}`
		);
		const manifestBody = await readJsonSafe(manifestResponse);
		assert(
			manifestBody.short_name === 'CleverColony',
			'Expected /manifest.webmanifest to expose CleverColony short_name'
		);

		const siteManifestResponse = await fetch(`${baseUrl}/site.webmanifest`);
		assert(
			siteManifestResponse.status === 200,
			`Expected /site.webmanifest 200, got ${siteManifestResponse.status}`
		);
		const siteManifestBody = await readJsonSafe(siteManifestResponse);
		assert(
			siteManifestBody.short_name === 'CleverColony',
			'Expected /site.webmanifest to expose CleverColony short_name'
		);

		const modelsResponse = await fetch(`${baseUrl}/api/models`, { redirect: 'manual' });
		assert(
			modelsResponse.status === 401,
			`Expected unauthenticated /api/models to return 401, got ${modelsResponse.status}`
		);
		const modelsBody = await readJsonSafe(modelsResponse);
		assert(
			modelsBody.error === 'Authentication required',
			`Expected /api/models 401 payload to include Authentication required message`
		);

		const malformedLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{'
		});
		assert(
			malformedLoginResponse.status === 400,
			`Expected malformed /api/auth/login request to return 400, got ${malformedLoginResponse.status}`
		);
		const malformedLoginBody = await readJsonSafe(malformedLoginResponse);
		assert(
			malformedLoginBody.message === 'Invalid JSON body',
			'Expected malformed /api/auth/login to return Invalid JSON body'
		);

		const invalidLoginStartedAt = Date.now();
		const invalidLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				password: 'wrong-password'
			})
		});
		const invalidLoginElapsedMs = Date.now() - invalidLoginStartedAt;
		assert(
			invalidLoginResponse.status === 401,
			`Expected invalid /api/auth/login request to return 401, got ${invalidLoginResponse.status}`
		);
		assert(
			invalidLoginElapsedMs >= 280,
			`Expected invalid /api/auth/login request to take at least 280ms, got ${invalidLoginElapsedMs}ms`
		);
		const invalidLoginBody = await readJsonSafe(invalidLoginResponse);
		assert(
			invalidLoginBody.message === 'Invalid credentials',
			'Expected invalid /api/auth/login to return Invalid credentials'
		);

		const validLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				password: testPassword
			})
		});
		assert(validLoginResponse.status === 201, `Expected /api/auth/login 201, got ${validLoginResponse.status}`);
		const validLoginBody = await readJsonSafe(validLoginResponse);
		assert(validLoginBody.authenticated === true, 'Expected /api/auth/login to return authenticated=true');
		const setCookie = validLoginResponse.headers.get('set-cookie') ?? '';
		assert(
			setCookie.includes('clever_colony_session='),
			'Expected /api/auth/login to set clever_colony_session cookie'
		);
		assert(setCookie.toLowerCase().includes('httponly'), 'Expected /api/auth/login session cookie to be HttpOnly');
		assert(
			setCookie.toLowerCase().includes('samesite=lax'),
			'Expected /api/auth/login session cookie to use SameSite=Lax'
		);
		assert(
			!/;\s*secure\b/i.test(setCookie),
			'Expected preview /api/auth/login cookie to omit Secure attribute on local HTTP'
		);
		assert(
			!setCookie.toLowerCase().includes('max-age='),
			'Expected /api/auth/login session cookie to be browser-session scoped'
		);
		const sessionCookieHeader = parseSetCookieValue(setCookie);
		assert(sessionCookieHeader.length > 0, 'Expected /api/auth/login response to provide a usable cookie header');

		const authenticatedRootResponse = await fetch(`${baseUrl}/`, {
			redirect: 'manual',
			headers: {
				cookie: sessionCookieHeader
			}
		});
		assert(
			authenticatedRootResponse.status === 200,
			`Expected authenticated / request to return 200, got ${authenticatedRootResponse.status}`
		);
		const authenticatedLoginResponse = await fetch(`${baseUrl}/login`, {
			redirect: 'manual',
			headers: {
				cookie: sessionCookieHeader
			}
		});
		assert(
			authenticatedLoginResponse.status === 303,
			`Expected authenticated /login request to redirect with 303, got ${authenticatedLoginResponse.status}`
		);
		const authenticatedLoginLocation = authenticatedLoginResponse.headers.get('location') ?? '';
		assert(
			authenticatedLoginLocation === '/',
			`Expected authenticated /login redirect location to equal "/", got "${authenticatedLoginLocation}"`
		);

		const authenticatedModelsResponse = await fetch(`${baseUrl}/api/models`, {
			headers: {
				cookie: sessionCookieHeader
			}
		});
		assert(
			authenticatedModelsResponse.status === 200,
			`Expected authenticated /api/models to return 200, got ${authenticatedModelsResponse.status}`
		);
		const authenticatedModelsBody = await readJsonSafe(authenticatedModelsResponse);
		assert(
			Array.isArray(authenticatedModelsBody.models) && authenticatedModelsBody.models.length > 0,
			'Expected authenticated /api/models response to include model entries'
		);

		const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
			method: 'POST',
			headers: {
				cookie: sessionCookieHeader
			}
		});
		assert(logoutResponse.status === 200, `Expected /api/auth/logout 200, got ${logoutResponse.status}`);
		const logoutBody = await readJsonSafe(logoutResponse);
		assert(logoutBody.authenticated === false, 'Expected /api/auth/logout to return authenticated=false');
		const logoutSetCookie = logoutResponse.headers.get('set-cookie') ?? '';
		assert(
			logoutSetCookie.toLowerCase().includes('clever_colony_session='),
			'Expected /api/auth/logout to clear clever_colony_session cookie'
		);

		console.log('Preview smoke checks passed.');
	} finally {
		await stopPreviewServer(preview);
	}
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
