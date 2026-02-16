import { describe, expect, it } from 'vitest';
import { buildSitemapXml } from './sitemap';

describe('buildSitemapXml', () => {
	it('includes the login url for the provided origin', () => {
		const xml = buildSitemapXml('https://clever-colony.example');
		expect(xml).toContain('<loc>https://clever-colony.example/login</loc>');
	});

	it('escapes XML-sensitive origin characters', () => {
		const xml = buildSitemapXml('https://example.com?a=1&b=<x>"y"');
		expect(xml).toContain('&amp;');
		expect(xml).toContain('&lt;');
		expect(xml).toContain('&quot;');
	});
});
