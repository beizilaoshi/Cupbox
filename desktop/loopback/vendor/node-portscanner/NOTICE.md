# node-portscanner

MIT, Copyright (c) 2011 Brandon Ace Alexander. See LICENSE.

Source: https://github.com/baalexander/node-portscanner/tree/9a92dcce423da9bc16b4f3c621bacdf7dcc0bfc1

portscanner.js is the unchanged upstream reference. Cupbox's port-check.js adapts its checkPortStatus socket lifecycle, refusal handling and timeout/close behavior. It removes arbitrary hosts, port ranges and dependency-driven range scanning, and adds strict integer checks, fixed IPv4 127.0.0.1 and AbortSignal cancellation. The reference module is not executed. No runtime download or third-party executable is required.
