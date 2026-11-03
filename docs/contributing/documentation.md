# Documentation

This site is built with [VitePress](https://vitepress.dev) from the `docs/` folder.

## Commands

```sh
npm run docs:dev      # dev server with hot reload
npm run docs:build    # production build into docs/.vitepress/dist
npm run docs:preview  # serve the production build locally
```

## Layout

| Path | Content |
| --- | --- |
| `docs/guide/` | Concepts and how-tos |
| `docs/api/` | Reference: factory, options, types, defaults |
| `docs/recipes/` | Copy-paste patterns |
| `docs/troubleshooting/` | Common issues and compatibility |
| `docs/migration/` | Upgrade guides |
| `docs/contributing/` | Contributor docs |
| `docs/public/` | Static assets (logo, social image) |
| `docs/.vitepress/config.ts` | Site config, navigation and sidebar |

## Adding a page

1. Create the Markdown file in the right folder.
2. Add it to the `sidebar` in `docs/.vitepress/config.ts`. Pages not listed there are only reachable through links.
3. Run `npm run docs:build`. The build **fails on dead links**, which is intended.

## Writing rules

- Verify every claim against `src/` and the tests. Do not document combinations that are not supported or tested.
- Run code samples and paste real output.
- The site describes `master`. Mark anything not in the latest npm release with an *Unreleased* note.
- The version shown in the navigation comes from `package.json`.
- Wrap generic types such as `Record<string, any>` in backticks, otherwise VitePress parses them as HTML.

## Deployment

The site is served from `/pino-quiet/` (the `base` in the config) at `https://silent-watcher.github.io/pino-quiet/`.
