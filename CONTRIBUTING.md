# Contributing to Skillify

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/LGDiMaggio/skilli.fy.git
cd skilli.fy
npm install
npm run build
npm test
```

## Project Structure

```
packages/
  core/        Schemas, workflow mining, skill generation, validation, packing
  recorder/    Recording providers (terminal, fs, process, window)
  mcp/         MCP server detection, registry, config generation
  cli/         CLI commands (record, generate, validate, pack)
```

## How to Contribute

### Bug Reports
- Open an issue with a clear title and description
- Include steps to reproduce, expected behavior, and actual behavior
- Attach your OS, Node.js version, and Skillify version

### Feature Requests
- Open an issue tagged `enhancement`
- Describe the use case and expected behavior

### Pull Requests
1. Fork the repo and create a branch from `main`
2. Add tests for new functionality
3. Ensure `npm test` and `npm run typecheck` pass
4. Write clear commit messages
5. Open a PR with a description of the change

### Adding a Recording Provider
1. Implement the `RecordingProvider` interface in `packages/recorder/src/providers/`
2. Export it from `packages/recorder/src/providers/index.ts`
3. Register it in the CLI's `record` command
4. Add tests

### Adding an MCP Server to the Registry
1. Add an entry to `MCP_REGISTRY` in `packages/mcp/src/registry.ts`
2. Include signals (process names, hostnames, command patterns, file patterns)
3. Add install instructions and prerequisites
4. Test detection with a sample recording

## Code Style
- TypeScript strict mode
- Zod for runtime validation
- ESM modules
- Clear JSDoc comments on public APIs

## License
By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
