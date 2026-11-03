import { defineConfig } from 'vitepress';
import pkg from '../../package.json' with { type: 'json' };

const repo = 'https://github.com/Silent-Watcher/pino-quiet';
const siteUrl = 'https://silent-watcher.github.io/pino-quiet/';
const description =
	'A lightweight Pino transport that collapses repeated consecutive log messages.';

export default defineConfig({
	title: 'pino-quiet',
	description,
	head: [
		[
			'link',
			{
				rel: 'icon',
				href: '/pino-quiet/logo.svg',
				type: 'image/svg+xml',
			},
		],
		['meta', { name: 'theme-color', content: '#1e293b' }],
		['meta', { property: 'og:type', content: 'website' }],
		['meta', { property: 'og:title', content: 'pino-quiet' }],
		['meta', { property: 'og:description', content: description }],
		['meta', { property: 'og:url', content: siteUrl }],
		['meta', { property: 'og:image', content: `${siteUrl}og-image.png` }],
		['meta', { name: 'twitter:card', content: 'summary_large_image' }],
		['meta', { name: 'twitter:image', content: `${siteUrl}og-image.png` }],
	],
	base: '/',
	lang: 'en-US',
	lastUpdated: true,
	sitemap: { hostname: siteUrl },

	themeConfig: {
		logo: '/logo.svg',
		siteTitle: 'pino-quiet',
		nav: [
			{
				text: 'Guide',
				link: '/guide/introduction',
				activeMatch: '/guide/',
			},
			{ text: 'API', link: '/api/options', activeMatch: '/api/' },
			{
				text: 'Recipes',
				link: '/recipes/common-patterns',
				activeMatch: '/recipes/',
			},
			{
				text: 'Troubleshooting',
				link: '/troubleshooting/common-issues',
				activeMatch: '/troubleshooting/',
			},
			{
				text: pkg.version,
				items: [
					{
						text: 'Changelog',
						link: `${repo}/blob/master/CHANGELOG.md`,
					},
					{
						text: 'npm',
						link: 'https://www.npmjs.com/package/pino-quiet',
					},
				],
			},
		],
		sidebar: [
			{
				text: 'Guide',
				items: [
					{ text: 'Introduction', link: '/guide/introduction' },
					{ text: 'Installation', link: '/guide/installation' },
					{ text: 'Quick start', link: '/guide/quick-start' },
					{ text: 'How it works', link: '/guide/how-it-works' },
					{
						text: 'Comparison modes',
						link: '/guide/comparison-modes',
					},
					{ text: 'Output format', link: '/guide/output-format' },
					{ text: 'Batching & flushing', link: '/guide/flushing' },
					{ text: 'Excluded levels', link: '/guide/excluded-levels' },
					{ text: 'Pipeline mode', link: '/guide/pipeline' },
					{
						text: 'Pino integration & workers',
						link: '/guide/pino-integration',
					},
					{ text: 'Shutdown & durability', link: '/guide/shutdown' },
					{ text: 'Limitations', link: '/guide/limitations' },
				],
			},
			{
				text: 'Reference',
				items: [
					{ text: 'pinoQuiet()', link: '/api/factory' },
					{ text: 'Options', link: '/api/options' },
					{ text: 'Types', link: '/api/types' },
					{ text: 'Configuration defaults', link: '/api/defaults' },
				],
			},
			{
				text: 'Recipes',
				items: [
					{
						text: 'Common patterns',
						link: '/recipes/common-patterns',
					},
					{ text: 'Observability', link: '/recipes/observability' },
					{ text: 'Performance', link: '/recipes/performance' },
				],
			},
			{
				text: 'Troubleshooting',
				items: [
					{
						text: 'Common issues',
						link: '/troubleshooting/common-issues',
					},
					{
						text: 'Compatibility',
						link: '/troubleshooting/compatibility',
					},
				],
			},
			{
				text: 'Migration',
				items: [
					{ text: 'From 0.9.x', link: '/migration/from-0.x' },
					{ text: 'From 1.0.x', link: '/migration/from-1.x' },
				],
			},
			{
				text: 'Contributing',
				items: [
					{ text: 'Development', link: '/contributing/development' },
					{ text: 'Testing', link: '/contributing/testing' },
					{
						text: 'Documentation',
						link: '/contributing/documentation',
					},
				],
			},
		],
		search: {
			provider: 'local',
		},
		editLink: {
			pattern: `${repo}/edit/master/docs/:path`,
			text: 'Edit this page on GitHub',
		},
		socialLinks: [{ icon: 'github', link: repo }],
		footer: {
			message: `Released under the MIT License. Current version: ${pkg.version}.`,
			copyright: 'Copyright © 2024-present Ali Nazari',
		},
		outline: { level: [2, 3], label: 'On this page' },
	},
});
