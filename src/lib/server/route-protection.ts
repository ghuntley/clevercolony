const UNPROTECTED_PATHS = new Set<string>(['/login']);
const UNPROTECTED_API_PREFIXES = ['/api/auth', '/api/health'];

function matchesPrefixPath(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isUnprotectedPath(pathname: string): boolean {
	if (UNPROTECTED_PATHS.has(pathname)) return true;
	if (pathname.startsWith('/_app/')) return true;
	if (pathname.startsWith('/favicon')) return true;
	if (pathname === '/robots.txt') return true;
	return UNPROTECTED_API_PREFIXES.some((prefix) => matchesPrefixPath(pathname, prefix));
}
