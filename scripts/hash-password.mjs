import crypto from 'node:crypto';

const password = process.argv[2];
if (!password) {
	console.error('Usage: node scripts/hash-password.mjs "<password>"');
	process.exit(1);
}

const iterations = 210000;
const salt = crypto.randomBytes(16);
const digest = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');

const toBase64Url = (buffer) =>
	buffer
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');

const hash = `pbkdf2_sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(digest)}`;
console.log(hash);
