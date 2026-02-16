import { spawn } from 'node:child_process';
import process from 'node:process';

export async function applyLocalD1Migrations() {
	const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
	const child = spawn(
		npxCommand,
		['wrangler', 'd1', 'migrations', 'apply', 'clever-colony', '--local', '--config', 'wrangler.toml'],
		{
			stdio: 'inherit',
			env: {
				...process.env,
				CI: '1'
			}
		}
	);

	const exitCode = await new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('exit', resolve);
	});
	if (exitCode !== 0) {
		throw new Error(`Local D1 migration command exited with code ${exitCode}`);
	}
}
