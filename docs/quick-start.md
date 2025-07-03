# Quick Start Guide

## Overview

The File Search project consists of three main components:

- **Go Scanner Agent**: Lightweight agent that scans file systems
- **NestJS API Server**: Backend API for data processing and management
- **React Frontend**: User interface for search and administration

## Prerequisites

- Node.js 18 or higher
- pnpm package manager
- PostgreSQL database
- Go 1.17 or higher (for agent development)

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd file-search
pnpm install
```

### 2. Database Setup

Start PostgreSQL using Docker:

```bash
docker-compose -f docker-compose/docker-compose-postgres.yaml up -d
```

### 3. Environment Configuration

Create environment files:

```bash
# Copy environment templates
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env
```

### 4. Database Migration

Run database migrations:

```bash
pnpm nx run server:migrate
```

### 5. Start Development Servers

Start the backend server:

```bash
pnpm nx serve server
```

Start the frontend client:

```bash
pnpm nx serve client
```

## Agent Deployment

### Building the Go Agent

```bash
cd go-agent
go build -o file-scanner ./cmd/scanner
```

### Agent Configuration

Create a `config.yaml` file:

```yaml
server:
  url: 'http://localhost:3000'
  api_key: 'your-api-key'

scan_paths:
  - '/path/to/scan'
  - '/another/path'

batch_size: 100
scan_interval: '1h'
```

### Running the Agent

```bash
./file-scanner --config config.yaml
```

## Next Steps

- Review the [File Scanner Agent Architecture Overview](./HLD-Go-File-Scanner.md)
