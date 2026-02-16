const UNPROTECTED_PATHS = new Set<string>(['/login']);
const UNPROTECTED_API_PREFIXES = ['/api/auth', '/api/health'];

export function isUnprotectedPath(pathname: string): boolean {
	if (UNPROTECTED_PATHS.has(pathname)) return true;
	if (pathname.startsWith('/_app/')) return true;
	if (pathname.startsWith('/favicon')) return true;
	if (pathname === '/robots.txt') return true;
	return UNPROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
