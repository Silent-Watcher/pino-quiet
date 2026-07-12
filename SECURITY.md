# Security Policy

## Supported Versions

We provide security fixes for the following versions of `pino-quiet`:

| Version   | Supported          |
| --------- | ------------------ |
| 1.x       | ✅ Yes              |
| 0.9.x     | ❌ No (pre-release) |
| < 0.9     | ❌ No               |

Only the latest `1.x` minor/patch release is actively maintained. Users on `0.x` releases are strongly encouraged to upgrade to `1.0.0` or later — see [CHANGELOG.md](./CHANGELOG.md) for migration notes.

## Reporting a Vulnerability

If you discover a security vulnerability in `pino-quiet`, please **do not open a public GitHub issue**. Instead:

1. Report it privately via **[GitHub Security Advisories](https://github.com/Silent-Watcher/pino-quiet/security/advisories/new)** for this repository, or
2. Email **backendwithali@gmail.com** with:
   - A description of the vulnerability and its potential impact
   - Steps to reproduce it (a minimal code sample is ideal)
   - The affected version(s)
   - Your suggested severity, if you have one

### What to expect

- **Acknowledgement:** within 72 hours of your report.
- **Initial assessment:** within 7 days, including whether the report is accepted, needs more information, or is declined.
- **Fix & disclosure:** for accepted reports, we aim to ship a patched release within 30 days. We will credit the reporter in the release notes and `CHANGELOG.md` unless you prefer to remain anonymous.

Please give us a reasonable amount of time to investigate and patch a reported issue before disclosing it publicly.

## Scope

`pino-quiet` is a logging transport that processes and forwards log data. Things we consider in scope for a security report include (non-exhaustive):

- Prototype pollution or unsafe merging when processing log objects
- Denial-of-service vectors (e.g. unbounded memory growth via crafted log input) beyond the documented `maxRepeats`/`flushIntervalMs` safeguards
- Arbitrary file write/overwrite issues related to the `destination` option
- Any issue allowing a log producer to execute code or corrupt output in a way that affects downstream consumers

Out of scope: vulnerabilities in `pino`, `pino-pretty`, `sonic-boom`, or `pino-abstract-transport` themselves — please report those upstream to their respective maintainers.

## Dependencies

This project uses [Dependabot](.github/DEPENDABOT.yml) to keep dependencies up to date on a monthly schedule. If a dependency vulnerability affects `pino-quiet`, we will release a patched version promptly after an upstream fix is available.

Thank you for helping keep `pino-quiet` and its users safe.
