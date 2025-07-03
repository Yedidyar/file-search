# Documentation

This directory contains the technical documentation for the File Search project, built with [VitePress](https://vitepress.dev/).

## Structure

```
docs/
├── .vitepress/
│   ├── config.mts          # VitePress configuration
│   ├── dist/               # Built documentation (generated)
│   └── cache/              # VitePress cache (generated)
├── index.md                # Homepage
├── quick-start.md          # Quick start guide
├── HLD-Go-File-Scanner.md  # High-level design document
└── README.md               # This file
```

## Development

### Start Development Server

```bash
pnpm docs:dev
```

This will start the VitePress development server at `http://localhost:5173`.

### Build Documentation

```bash
pnpm docs:build
```

This will build the static documentation site to `docs/.vitepress/dist/`.

### Preview Built Documentation

```bash
pnpm docs:preview
```

This will serve the built documentation locally for testing.

## Writing Documentation

### Adding New Pages

1. Create a new `.md` file in the `docs/` directory
2. Add the page to the navigation in `docs/.vitepress/config.mts`
3. Update the sidebar configuration if needed

### Markdown Features

VitePress supports enhanced Markdown features including:

- **Syntax highlighting** for code blocks
- **Mermaid diagrams** (as seen in the architecture document)
- **Custom containers** for tips, warnings, etc.
- **Math expressions** with KaTeX
- **Component embedding** in Markdown

### Configuration

The main configuration file is `docs/.vitepress/config.mts`. This file controls:

- Site metadata (title, description)
- Navigation structure
- Sidebar organization
- Theme configuration
- Social links

## Deployment

The documentation can be deployed to any static hosting service:

- **GitHub Pages**: Use the built-in GitHub Actions workflow
- **Netlify**: Connect your repository and set build command to `pnpm docs:build`
- **Vercel**: Import project and set build command to `pnpm docs:build`

The built files will be in the `docs/.vitepress/dist/` directory.
