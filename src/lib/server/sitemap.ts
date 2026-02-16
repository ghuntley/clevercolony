function xmlEscape(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

export function buildSitemapXml(origin: string): string {
	const loginUrl = `${origin}/login`;
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url>
		<loc>${xmlEscape(loginUrl)}</loc>
		<changefreq>weekly</changefreq>
		<priority>0.5</priority>
	</url>
</urlset>`;
}
