# PromptPad

A local prompt template manager for Windows / macOS / Linux, built with Tauri 2 + React 19 + TypeScript.

## Features

- Create, edit, delete reusable prompt templates
- `{{variable}}` placeholders with built-ins (`date`, `time`, `datetime`, `clipboard`) and a fill-in dialog
- Fuzzy search across title, content, and tags
- Tags, favorites, and pinned items
- One-click copy to clipboard
- Import / export as JSON (full store) or Markdown (single prompt with YAML frontmatter)
- Lives locally — your prompts never leave the machine

## Develop

```sh
pnpm install
pnpm tauri dev
```

## Build

```sh
pnpm tauri build
```

Outputs the installer under `src-tauri/target/release/bundle/`.

## Data location

- Windows: `D:\PromptPad\prompts.json` by default
- macOS / Linux: `~/PromptPad/prompts.json`

Override with the `PROMPTPAD_DATA_DIR` environment variable.

## Tech stack

- [Tauri 2](https://tauri.app/) — desktop shell
- [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/) — UI
- [Tailwind CSS 4](https://tailwindcss.com/) — styling
- [Fuse.js](https://fusejs.io/) — fuzzy search
