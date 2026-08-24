# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |

## Reporting a vulnerability

Please **do not** open a public issue for a security vulnerability.

Report it privately through
[GitHub's security advisory form](https://github.com/CountlinkX-Solutions/maplibrex/security/advisories/new),
or by email to admin@countlinkx.com.

Include the affected version, a description of the issue, and steps to
reproduce it. We aim to acknowledge reports within 72 hours and to ship a fix
or a mitigation plan within 30 days.

## Scope

MaplibreX renders map configuration supplied by your application into a
`data-config` attribute and hands it to MapLibre GL JS. Treat any user-supplied
value that reaches a component attribute — style URLs, tile URLs, popup HTML —
as untrusted input and sanitise it on the server. In particular, `popup_html`
and the `html` slot render raw markup and are not escaped.
