<script lang="ts">
	let password = $state('');
	let pending = $state(false);
	let errorMessage = $state('');

	async function login(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		pending = true;
		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ password })
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => ({}))) as { message?: string };
				errorMessage = body.message ?? 'Login failed. Check your password.';
				return;
			}
			window.location.href = '/';
		} catch {
			errorMessage = 'Unexpected error. Please try again.';
		} finally {
			pending = false;
		}
	}
</script>

<main class="auth-shell">
	<section class="panel">
		<h1>Clever Colony</h1>
		<p>Enter shared access password.</p>
		<form onsubmit={login}>
			<label for="password">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				bind:value={password}
				placeholder="••••••••"
				autocomplete="current-password"
				required
			/>
			<button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
		</form>
		{#if errorMessage}
			<p class="error">{errorMessage}</p>
		{/if}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
			'Courier New', monospace;
		background: #0f0f0f;
		color: #f2f2f2;
	}

	.auth-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 2rem;
	}

	.panel {
		width: min(90vw, 48ch);
		border: 2px solid #666;
		padding: 2rem;
		background: #111;
	}

	h1 {
		margin: 0 0 1rem;
		font-size: 1.6rem;
	}

	p {
		margin: 0 0 1rem;
	}

	form {
		display: grid;
		gap: 0.75rem;
	}

	input,
	button {
		font: inherit;
		border: 2px solid #666;
		background: #1b1b1b;
		color: #f2f2f2;
		padding: 0.6rem 0.75rem;
	}

	button {
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error {
		color: #ff8b8b;
		margin-top: 1rem;
	}
</style>
