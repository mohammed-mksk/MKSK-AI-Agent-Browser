# MKSK AI Automation Browser

This is a MKSK AI Automation Browser. It includes everything needed to build, run, and package the app.

## Project Overview

AI Automation Browser is an Electron application that lets you automate web tasks via natural language. It combines:
- Electron (main + preload) for desktop packaging and system integration
- React + Vite (renderer) for the UI
- Node services for orchestration and configuration
- Optional Python bridge using the `browser-use` library for advanced browser automation

Key capabilities include invoking AI providers (OpenAI, Anthropic, etc.), running automated browsing workflows, and packaging for Windows via `electron-builder`.

## What’s Included
- Application source: `src/` (main, preload, renderer)
- UI project: `src/renderer` (React + Vite)
- Assets: `assets/`
- Packaging configs and scripts: `build/` (no certificates)
- Helper/utility scripts: `scripts/`
- Python bridge: `python-bridge/` with `requirements.txt`
- Config examples: `.env.example`, `ai-browser-config.json`

## Prerequisites
- Node.js >= 18
- npm (bundled with Node) or a compatible package manager
- Python (optional, for `python-bridge/`), recommended 3.10+

## Setup

1) Install dependencies (root and renderer):
```
npm run install-all
```
Alternatively:
```
npm install
cd src/renderer && npm install
cd ../..
```

2) Environment variables: copy and edit `.env.example`:
```
cp .env.example .env   # On Windows: copy .env.example .env
```
Populate the relevant API key(s):
- `OPENAI_API_KEY` (recommended)
- or one of: `ANTHROPIC_API_KEY`, `AZURE_OPENAI_*`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`, `GROK_API_KEY`, `NOVITA_API_KEY`

3) (Optional) Python bridge setup:
```
python -m venv .venv
. .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r python-bridge/requirements.txt
```

## Running
- Live development (main + renderer):
```
npm run dev
```
- Build main only and run Electron:
```
npm run start:dev
```
- Full build then start:
```
npm run start
```

## Packaging (Windows)
The project uses `electron-builder` with configs in `build/`.
- Create packaged app(s):
```
npm run package:win
```
Other options:
- `npm run package` (default targets)
- `npm run dist:win` (no publish)
- `npm run publish` (publishes per config)

Note: `.gitignore` currently ignores `build/`. If you want to track packaging configs in GitLab, remove `build/` from `.gitignore` or replace it with a narrower ignore (e.g., keep `build/` but ignore `build/*.p12`). Certificates are not included in this copy.

## Repository Notes
- This folder was created from the original project while omitting internal docs, tests, screenshots, logs, and generated outputs.
- The app will regenerate `dist/` on build commands; generate your own `.env` from `.env.example` locally.
- If you need additional items excluded or included for GitLab, update the `.gitignore` and/or let us know what to adjust.

## License
See `package.json` for license metadata.

