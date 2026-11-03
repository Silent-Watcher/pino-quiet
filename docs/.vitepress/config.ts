import { defineConfig } from 'vitepress';
import pkg from '../../package.json' with { type: 'json' };

const repo = 'https://github.com/Silent-Watcher/pino-quiet';

export default defineConfig({
	title: 'pino-quiet',
	description:
		'A lightweight Pino transport that collapses repeated consecutive log messages.',
	head: [
		[
			'link',
			{
				rel: 'icon',
				href: '/pino-quiet/logo.svg',
				type: 'image/svg+xml',
			},
		],
	],
	base: '/pino-quiet/',
	lang: 'en-US',

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
					{ text: 'Excluded levels', link: '/guide/excluded-levels' },
					{ text: 'Pipeline mode', link: '/guide/pipeline' },
					{
						text: 'Pino integration & workers',
						link: '/guide/pino-integration',
					},
				],
			},
			{
				text: 'Reference',
				items: [
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
				items: [{ text: 'From 0.9.x', link: '/migration/from-0.x' }],
			},
			{
				text: 'Contributing',
				items: [
					{ text: 'Development', link: '/contributing/development' },
					{ text: 'Testing', link: '/contributing/testing' },
				],
			},
		],
		search: {
			provider: 'local',
		},
		socialLinks: [{ icon: 'github', link: repo }],
		footer: {
			message: `Released under the MIT License. Current version: ${pkg.version}.`,
			copyright: 'Copyright © 2024-present Ali Nazari',
		},
		outline: { level: [2, 3], label: 'On this page' },
	},
});
