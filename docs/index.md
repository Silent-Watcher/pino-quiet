---
layout: home

hero:
  name: pino-quiet
  tagline: A lightweight Pino transport that collapses repeated consecutive log messages into a single entry with a repetition counter.
  actions:
    - theme: brand
      text: Get started
      link: /guide/quick-start
    - theme: alt
      text: Options reference
      link: /api/options
    - theme: alt
      text: GitHub
      link: https://github.com/Silent-Watcher/pino-quiet

features:
  - icon: 🔇
    title: Noise reduction
    details: Turns 1,000 identical "Connection failed" logs into a single (x1000) entry. Zero changes to your logging calls.
  - icon: 🔀
    title: Two modes
    details: Run standalone as a terminal transport writing to stdout or a file, or as a pipeline stage before pino-pretty.
  - icon: 🎚️
    title: Pluggable comparison
    details: Fast message-only matching, strict deep-object comparison, level-aware matching, case insensitivity, or your own comparator.
  - icon: 🛡️
    title: Self-healing buffers
    details: Idle batches auto-flush after a configurable interval, hot loops are capped by maxRepeats, and nothing is ever silently dropped.
  - icon: 🚫
    title: Level exclusions
    details: excludeLevels lets errors and other critical levels bypass deduplication entirely, one entry per record.
  - icon: 📦
    title: Fully typed
    details: First-class TypeScript definitions, ESM-only, native require(esm) interop on Node.js >= 22.12.
---
