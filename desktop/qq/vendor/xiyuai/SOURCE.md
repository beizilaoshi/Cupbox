# Xiyu AI reused modules

Source: https://github.com/xiyuailove/xiyuai/tree/06928e2dbccf438109a9eeae80086bb12f729fd3 (retrieved 2026-10-23).

`emotion_engine.mjs` and `memory_decay.mjs` are unmodified upstream pure modules. Original copyright headers and the full MIT license are retained. Cupbox calls their pure calculation functions behind its own explicitly enabled QQ companion settings. It does not enable the upstream process-wide rollout switch or run the upstream database, web server, WeChat adapter, background jobs, or account system.

QQ scope checks, evidence validation, persistence, delivery confirmation, local management and the unified relationship score are Cupbox adaptations. No upstream sample user data, tokens, generated persona biographies, or image assets are included.

Vendored SHA256:

- emotion_engine.mjs: 33448ada22cef9dce005d26c8978e40909aee4cdb2ca50119bfbfecc94109855
- memory_decay.mjs: e013fa4c154f926a0c4870f700561bd527c545a24bbc583f3d63a2eae14f72d6
