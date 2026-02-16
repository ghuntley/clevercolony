const UNPROTECTED_PATHS = new Set<string>([
	'/login',
	'/robots.txt',
	'/sitemap.xml',
	'/favicon.ico',
	'/manifest.webmanifest',
	'/site.webmanifest'
]);
const UNPROTECTED_API_EXACT_PATHS = new Set<string>(['/api/health']);
const UNPROTECTED_API_PREFIXES = ['/api/auth'];
const UNPROTECTED_PREFIXES = ['/_app/'];

function matchesPrefixPath(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isUnprotectedPath(pathname: string): boolean {
	if (UNPROTECTED_PATHS.has(pathname)) return true;
	if (UNPROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
	if (UNPROTECTED_API_EXACT_PATHS.has(pathname)) return true;
	return UNPROTECTED_API_PREFIXES.some((prefix) => matchesPrefixPath(pathname, prefix));
}
