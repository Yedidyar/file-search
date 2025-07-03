# High-Level Design: Go File Scanner Agent

## Executive Summary

This document outlines the design for a Go-based file scanning agent that will be deployed on target file servers to efficiently scan file systems and synchronize metadata.
The agent is designed to be fast, minimal, portable, and compatible with legacy systems including Windows Server 2008.

## Table of Contents

1. [Requirements](#requirements)
2. [Architecture Overview](#architecture-overview)
3. [Design Decisions & Tradeoffs](#design-decisions--tradeoffs)
4. [Component Design](#component-design)
5. [Integration Strategy](#integration-strategy)
6. [Implementation Plan](#implementation-plan)
7. [Milestones & Tasks](#milestones--tasks)
8. [MVP vs Future Features](#mvp-vs-future-features)
9. [Risk Assessment & Mitigation](#risk-assessment--mitigation)
10. [Performance Targets](#performance-targets)
11. [Security Considerations](#security-considerations)
12. [Deployment Strategies](#deployment-strategies)
13. [Configuration Reference](#configuration-reference)
14. [Monitoring & Observability](#monitoring--observability)
15. [Future Enhancements](#future-enhancements)

## Critical Path & Timeline Summary

### Feature-to-Phase Mapping

### Parallel Development Opportunities

- ✅ **Weeks 1-2**: File scanning engine can be developed in parallel with SQLite schema
- ✅ **Weeks 3-4**: API client development can start once server contract is defined
- ✅ **Weeks 5-6**: Backup/recovery mechanisms can be developed in parallel with state management
- ⚠️ **Blocker**: Server-side file_size column migration must complete before API integration testing

### Critical Dependencies

1. **Server Contract Definition** (Week 2): Required before API client implementation
2. **Database Migration** (Week 3): `file_size` column addition to existing `files` table
3. **Cross-Platform Testing** (Week 7): Required before production deployment

## Requirements

### Functional Requirements

**Must Have (POC/MVP):**

- Scan specified file system paths for file metadata
- Extract basic file information (filename, path, size, modification time, MIME type)
- Implement incremental scanning to detect file changes (mod time + size)
- Batch HTTP requests to the main API server
- Support configuration via static YAML files
- Run as scheduled task (cron, Task Scheduler)
- Maintain local state using SQLite for change detection
- Basic retry logic (3 attempts with simple backoff)
- Support API key authentication via environment variables
- Basic agent registration and heartbeat with server
- File deletion detection
- Support for ignore patterns (glob-based)

**Should Have (MVP):**

- Cross-platform compatibility (Linux, Windows, macOS)
- Configurable batch sizes and scan intervals
- Basic logging and error reporting
- Graceful handling of permission errors
- SQLite backup and recovery mechanisms

**Deferred to Post-MVP:**

- Server-side config updates and sync
- Atomic file-level processing with batch commits to SQLite
- Advanced exponential backoff and circuit breaker patterns
- Scan session management and resumption
- Comprehensive monitoring and observability

**Could Have (Future):**

- HTTP endpoint for on-demand scanning
- Real-time file system watching
- Content-based file hashing for duplicate detection
- Plugin system for custom file processors - TBD

### Non-Functional Requirements

**Performance (MVP Targets):**

- Handle thousands of files efficiently (10K+ files)
- Reasonable memory footprint (<200MB typical usage)
- Reasonable startup time (<10 seconds)
- Basic concurrent file processing (5-10 workers)
- Support up to 100K files per scan path (MVP limit)
- Streaming file processing (no full dataset in memory)

**Performance (Production Targets - Post MVP):**

- Handle tens of thousands of files efficiently
- Minimal memory footprint (<100MB typical usage)
- Fast startup time (<5 seconds)
- Concurrent file processing with worker pools (10-20 workers)
- Support up to 1M files per scan path
- Advanced performance optimizations

**Reliability (MVP):**

- Handle basic network failures with simple retry logic
- Handle file system permission errors gracefully
- Basic scan state persistence (restart from beginning acceptable for MVP)
- Idempotent operations with the main server
- Basic error recovery (delete corrupted SQLite and rescan)

**Reliability (Production - Post MVP):**

- Survive network outages with offline operation capability
- Maintain scan state across restarts with resume capability
- SQLite corruption recovery with backup mechanisms
- Circuit breaker pattern for API failures
- Advanced error handling and recovery

**Portability:**

- Single binary deployment
- Compatible with Go 1.17>= (Windows Server 2008 constraint)
- No external runtime dependencies
- Cross-compilation support

## Architecture Overview

```mermaid
graph TB
    subgraph "Target File Server"
        FS[File System]
        Agent[Go Scanner Agent]
        SQLite[(SQLite State DB)]
        Config[config.yaml]
        Backup[(SQLite Backup)]

        Agent --> FS
        Agent <--> SQLite
        Agent --> Config
        SQLite -.-> Backup
    end

    subgraph "Main System"
        API[NestJS API Server]
        DB[(PostgreSQL)]
        Search[(Typesense)]
        AgentMgmt[Agent Management]
    end

    Agent -->|HTTP POST /api/files/ingest| API
    Agent -->|POST /api/agents/register| AgentMgmt
    Agent -->|POST /api/agents/heartbeat| AgentMgmt
    Agent -->|GET /api/agents/config| AgentMgmt
    Agent -->|GET /api/agents/commands| AgentMgmt

    API --> DB
    API --> Search
    AgentMgmt --> DB

    subgraph "Schedulers"
        Cron[Linux Cron]
        TaskSched[Windows Task Scheduler]
        K8sCron[K8s CronJob]
    end

    Cron -.-> Agent
    TaskSched -.-> Agent
    K8sCron -.-> Agent
```

### Data Flow

#### Normal Scan Cycle Sequence

```mermaid
sequenceDiagram
    participant S as Scheduler
    participant A as Scanner Agent
    participant DB as SQLite DB
    participant API as Main API Server
    participant FS as File System

    S->>A: Trigger scan (cron/scheduled)
    A->>API: POST /agents/register
    API-->>A: 200 OK (agent registered)
    A->>API: GET /agents/config
    API-->>A: 200 OK (config data)

    A->>DB: Load last scan state
    DB-->>A: File states & timestamps

    loop For each scan path
        A->>FS: Read directory & file metadata
        FS-->>A: File list with mod times
        A->>DB: Compare with stored states
        DB-->>A: Changed files list
        A->>API: POST /files/ingest (batch)
        API-->>A: 200 OK (ingestion complete)
        A->>DB: Update file states atomically
    end


    A->>API: POST /agents/heartbeat
    API-->>A: 200 OK (heartbeat recorded)

    A->>DB: Create backup (if scheduled)
    A->>A: Log scan completion & metrics
```

#### Error Handling Flow

```mermaid
sequenceDiagram
    participant A as Scanner Agent
    participant API as Main API Server
    participant DB as SQLite DB
    participant CB as Circuit Breaker

    A->>API: POST /files/ingest (batch)
    API-->>A: 500 Server Error

    A->>CB: Record failure
    CB-->>A: Retry allowed

    A->>A: Wait (exponential backoff)
    A->>API: POST /files/ingest (retry)
    API-->>A: 500 Server Error

    A->>CB: Record failure
    CB-->>A: Circuit opened (stop retries)

    A->>DB: Mark batch as failed
    A->>A: Log error & continue with next batch

    Note over CB: Cool-down period (2 minutes)
    CB->>A: Circuit half-open (allow test)
    A->>API: POST /files/ingest (test request)
    API-->>A: 200 OK
    CB->>A: Circuit closed (resume normal operation)
```

### Data Flow Summary

    loop For each scan path
        A->>FS: Read directory & file metadata
        FS-->>A: File list with mod times
        A->>DB: Compare with stored states
        DB-->>A: Changed files list
    end

    A->>API: POST /files/ingest (batch)
    API-->>A: 200 OK (ingestion complete)
    A->>DB: Update file states atomically

    A->>API: POST /agents/heartbeat
    API-->>A: 200 OK (heartbeat recorded)

    A->>DB: Create backup (if scheduled)
    A->>A: Log scan completion & metrics

````

#### Error Handling Flow

```mermaid
sequenceDiagram
    participant A as Scanner Agent
    participant API as Main API Server
    participant DB as SQLite DB
    participant CB as Circuit Breaker

    A->>API: POST /files/ingest (batch)
    API-->>A: 500 Server Error

    A->>CB: Record failure
    CB-->>A: Retry allowed

    A->>A: Wait (exponential backoff)
    A->>API: POST /files/ingest (retry)
    API-->>A: 500 Server Error

    A->>CB: Record failure
    CB-->>A: Circuit opened (stop retries)

    A->>DB: Mark batch as failed
    A->>A: Log error & continue with next batch

    Note over CB: Cool-down period (2 minutes)
    CB->>A: Circuit half-open (allow test)
    A->>API: POST /files/ingest (test request)
    API-->>A: 200 OK
    CB->>A: Circuit closed (resume normal operation)
````

### Data Flow Summary

1. **Agent Registration**: Agent registers with server on startup
2. **Config Sync**: Agent pulls latest configuration from server
3. **Scheduler triggers** the Go agent or on-demand command received
4. **Incremental scan**: Agent scans configured paths, comparing with SQLite state
5. **Change detection**: Files are processed based on modification time + size
6. **Batch processing**: Changed files are batched for API submission
7. **HTTP requests**: Batched requests sent to main API server with retry logic
8. **State update**: SQLite updated atomically after successful server sync
9. **Heartbeat**: Regular status updates sent to server
10. **Backup**: Periodic SQLite backup for recovery

## Design Decisions & Tradeoffs

### Key Technology Decisions

| Decision             | Rationale                                                                                             | Tradeoffs                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Go Language**      | Fast native code, excellent concurrency, single binary deployment, Windows Server 2008 compatibility  | Learning curve for team, different from existing Node.js stack |
| **SQLite for State** | Embedded, no external dependencies, ACID transactions, excellent Go support, WAL mode for performance | Single-threaded writes (not an issue for this use case)        |
| **HTTP REST API**    | Simple, leverages existing `/files/ingest` endpoint, stateless                                        | Less efficient than message queues, but simpler                |

### File Change Detection Strategy

| Approach                   | Pros                                      | Cons                      | Decision           | **Switch Trigger**                                    |
| -------------------------- | ----------------------------------------- | ------------------------- | ------------------ | ----------------------------------------------------- |
| **Mod Time + Size Only**   | Fast, minimal I/O, works for 95% of cases | Misses rare edge cases    | ✅ **MVP Choice**  | Default for MVP                                       |
| **Content Hash (SHA-256)** | 100% accurate, detects all changes        | High I/O cost, slow scans | Future enhancement | Enable when serving >100 agents OR scanning >1M files |
| **Hybrid Approach**        | Fast + configurable accuracy              | Complex logic             | Future enhancement | Enable for high-accuracy requirements                 |

**MVP Decision**: Use modification time + file size for change detection to optimize for speed and simplicity.

**Production Trigger**: Enable content hashing when serving >100 agents or scanning >1M files per deployment.

### Architectural Tradeoffs

**Agent Responsibilities vs Server Responsibilities:**

- ✅ **Agent**: File I/O, metadata extraction, change detection, HTTP communication, local state management
- ✅ **Server**: Business logic, tagging rules, database operations, search indexing, agent management
- **Benefit**: Clean separation of concerns, agent stays minimal and fast

**Local State vs Stateless:**

- ✅ **Chose Local State (SQLite)**: Enables efficient incremental scanning and resume capability
- **Alternative**: Stateless with server-side change detection
- **Benefit**: Reduced network traffic, faster scans, works offline, resume interrupted scans

**Direct HTTP vs Message Queue:**

- ✅ **Chose Direct HTTP**: Simpler for MVP, leverages existing API
- **Alternative**: Message queue (Redis, RabbitMQ)
- **Benefit**: Fewer moving parts, easier deployment and debugging

**Server Config vs Local Config:**

- ✅ **Chose Server Config with Local Fallback**: Centralized management with offline capability
- **Alternative**: Local config only
- **Benefit**: Dynamic configuration updates, reduced operational overhead

## Component Design

### Project Structure (Nx Workspace)

```
apps/
├── scanner/                    # Go Scanner Agent
│   ├── cmd/
│   │   └── main.go            # Application entry point
│   ├── internal/
│   │   ├── agent/             # Core agent logic
│   │   │   ├── scanner.go     # File scanning engine
│   │   │   ├── state.go       # SQLite state management
│   │   │   └── config.go      # Configuration management
│   │   ├── api/               # HTTP API client
│   │   │   ├── client.go      # API client with retry logic
│   │   │   └── models.go      # Request/response models
│   │   ├── storage/           # SQLite operations
│   │   │   ├── schema.go      # Database schema
│   │   │   ├── migrations.go  # Schema migrations
│   │   │   └── backup.go      # Backup/recovery logic
│   │   └── utils/             # Utility functions
│   │       ├── filesystem.go  # File system operations
│   │       └── retry.go       # Retry and circuit breaker
│   ├── go.mod
│   ├── go.sum
│   └── project.json           # Nx project configuration
├── client/                     # Existing React app
└── server/                     # Existing NestJS app
```

### Core Components

#### 1. Scanner Engine (`internal/agent/scanner.go`)

```go
type Scanner struct {
    config     *Config
    state      *StateManager
    apiClient  *APIClient
    workerPool chan struct{} // Semaphore for concurrent workers
}

// Core scanning logic with resumption support
func (s *Scanner) ScanPaths(ctx context.Context, paths []string) error
func (s *Scanner) processFile(ctx context.Context, filePath string) (*FileMetadata, error)
func (s *Scanner) detectChanges(file *FileMetadata) (bool, error)
```

#### 2. State Manager (`internal/agent/state.go`)

```go
type StateManager struct {
    db *sql.DB
}

// SQLite operations for change detection and resumption
func (sm *StateManager) GetFileState(path string) (*FileState, error)
func (sm *StateManager) UpdateFileState(file *FileMetadata) error
func (sm *StateManager) CreateScanSession(paths []string) (*ScanSession, error)
func (sm *StateManager) ResumeScanSession(sessionID string) (*ScanSession, error)
```

#### 3. API Client (`internal/api/client.go`)

```go
type APIClient struct {
    baseURL    string
    apiKey     string
    httpClient *http.Client
    circuitBreaker *CircuitBreaker
}

// HTTP operations with retry logic and circuit breaker
func (c *APIClient) IngestFiles(ctx context.Context, files []FileMetadata) error
func (c *APIClient) RegisterAgent(ctx context.Context, agent *AgentInfo) error
func (c *APIClient) SendHeartbeat(ctx context.Context, status *AgentStatus) error
func (c *APIClient) GetConfig(ctx context.Context) (*Config, error)
func (c *APIClient) GetCommands(ctx context.Context) ([]Command, error)
```

### SQLite Schema Design

#### MVP Schema (Simplified)

```sql
-- File state for change detection (MVP)
CREATE TABLE file_states (
    path TEXT PRIMARY KEY,
    mod_time INTEGER NOT NULL,  -- Unix timestamp
    size INTEGER NOT NULL,
    last_synced INTEGER NOT NULL  -- Unix timestamp
);

-- Simple agent configuration cache (MVP)
CREATE TABLE agent_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Basic index for performance
CREATE INDEX idx_file_states_last_synced ON file_states(last_synced);
```

#### Production Schema (Post-MVP)

```sql
-- Scan sessions for resumability (Post-MVP)
CREATE TABLE scan_sessions (
    id TEXT PRIMARY KEY,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status TEXT NOT NULL, -- 'running', 'completed', 'failed', 'interrupted'
    scan_paths TEXT NOT NULL, -- JSON array of paths
    total_files INTEGER DEFAULT 0,
    processed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0
);

-- Enhanced file state for change detection (Post-MVP)
CREATE TABLE file_states (
    path TEXT PRIMARY KEY,
    mod_time TIMESTAMP NOT NULL,
    size INTEGER NOT NULL,
    hash TEXT, -- Optional for future enhancement
    last_scanned_at TIMESTAMP NOT NULL,
    sync_status TEXT NOT NULL, -- 'pending', 'synced', 'failed'
    retry_count INTEGER DEFAULT 0,
    last_error TEXT
);

-- Scan history (retained for 30 days) (Post-MVP)
CREATE TABLE scan_history (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'skipped'
    timestamp TIMESTAMP NOT NULL,
    error_message TEXT,
    FOREIGN KEY (session_id) REFERENCES scan_sessions(id)
);

-- Additional indexes for performance
CREATE INDEX idx_file_states_sync_status ON file_states(sync_status);
CREATE INDEX idx_file_states_last_scanned ON file_states(last_scanned_at);
CREATE INDEX idx_scan_history_session ON scan_history(session_id);
CREATE INDEX idx_scan_history_timestamp ON scan_history(timestamp);
```

### Backup and Recovery Strategy

#### MVP Approach (Simplified)

**Basic Recovery Strategy:**

- **Corruption Detection**: Simple integrity check on startup
- **Recovery**: If SQLite corrupts, delete database and perform full rescan
- **Acceptable for MVP**: Data loss is acceptable since it's just metadata cache
- **No automatic backups**: Keeps implementation simple

#### Production Approach (Post-MVP)

**SQLite Backup Mechanism:**

- **Automatic backups**: Every 24 hours and before major operations
- **Backup retention**: 7 days of backups
- **Backup location**: `{data_dir}/backups/scanner_state_{timestamp}.db`
- **Recovery**: Automatic corruption detection with fallback to latest backup
- **Disaster recovery**: If all backups fail, rebuild from scratch with full scan

```go
type BackupManager struct {
    dbPath     string
    backupDir  string
    maxBackups int
}

func (bm *BackupManager) CreateBackup() error
func (bm *BackupManager) RestoreFromBackup(backupPath string) error
func (bm *BackupManager) CleanupOldBackups() error
```

## Integration Strategy

### Server-Side Requirements

**New API Endpoints Required:**

#### MVP Endpoints (Minimal)

```typescript
// Basic agent registration (MVP)
POST /api/agents/register
{
  agentId: string,
  hostname: string,
  version: string
}

// Simple heartbeat (MVP)
POST /api/agents/heartbeat
{
  agentId: string,
  status: 'healthy' | 'error',
  lastScanTime: string,
  filesProcessed: number
}
```

#### Production Endpoints (Post-MVP)

```typescript
// Enhanced agent registration
POST /api/agents/register
{
  agentId: string,
  hostname: string,
  version: string,
  scanPaths: string[],
  capabilities: string[]
}

// Detailed heartbeat
POST /api/agents/heartbeat/{agentId}
{
  status: 'healthy' | 'degraded' | 'error',
  lastScanTime: string,
  filesProcessed: number,
  errorCount: number,
  memoryUsage: number
}

// Get agent configuration (Post-MVP)
GET /api/agents/{agentId}/config
Response: {
  scanPaths: string[],
  ignorePatterns: string[],
  scanInterval: string,
  batchSize: number
}

// Get commands for agent (Post-MVP)
GET /api/agents/{agentId}/commands
Response: {
  commands: [{
    id: string,
    type: 'scan' | 'stop' | 'restart',
    parameters: object,
    priority: 'low' | 'normal' | 'high'
  }]
}
```

2. **Enhanced File Ingestion:**

```typescript
// Add file size to existing endpoint
POST /api/files/ingest
{
  files: [{
    filename: string,
    fileType: string,
    path: string,
    size: number,        // NEW FIELD - requires migration
    lastIndexedAt?: string,
    tags?: string[]
  }]
}
```

**Database Schema Updates:**

#### MVP Schema Changes

```sql
-- Add file size column to existing files table (REQUIRED)
ALTER TABLE files ADD COLUMN file_size BIGINT;

-- Basic agent tracking table (MVP)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) UNIQUE NOT NULL,
  hostname VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

#### Production Schema Changes (Post-MVP)

```sql
-- Enhanced agent management tables
CREATE TABLE agent_scan_paths (
  agent_id UUID REFERENCES agents(id),
  path_glob TEXT NOT NULL,
  PRIMARY KEY (agent_id, path_glob)
);

CREATE TABLE agent_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  command_type VARCHAR(50) NOT NULL,
  parameters JSONB,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE
);
```

### Error Handling and Retry Strategy

#### MVP Approach (Simplified)

**Basic Retry Logic:**

- **Simple backoff**: 1s, 5s, 15s (3 attempts total)
- **Batch handling**: Entire batch fails or succeeds (no partial retry)
- **Error logging**: Log errors and continue processing
- **SQLite recovery**: Delete corrupted database and rescan

#### Production Approach (Post-MVP)

**Advanced API Retry Logic:**

- **Exponential backoff**: 1s, 2s, 4s, 8s, 16s, 32s, max 5 minutes
- **Max retries**: 6 attempts over ~1 hour total
- **Circuit breaker**: Stop after 50% failure rate over 10 requests
- **Cool-down period**: 2 minutes before resuming after circuit break

**Advanced Batch Error Handling:**

- **Partial failures**: Retry only failed files from batch
- **Validation errors**: Log error, mark file as failed, continue processing
- **Network errors**: Retry entire batch with exponential backoff
- **Server errors (5xx)**: Retry with backoff, circuit breaker applies

**Advanced SQLite Error Recovery:**

- **Corruption detection**: Automatic integrity checks on startup
- **Backup restoration**: Automatic fallback to latest valid backup
- **Rebuild mechanism**: Full rescan if all recovery attempts fail

## Implementation Plan

### Development Phases

#### Phase 1: Core Infrastructure (Weeks 1-2)

- Set up Nx workspace with @nx-go/nx-go plugin
- Implement basic SQLite schema and operations
- Create configuration management system
- Implement file system scanning logic
- Basic logging and error handling

#### Phase 2: API Integration (Weeks 3-4)

- Implement HTTP API client with retry logic
- Add agent registration and heartbeat
- Implement file ingestion with batching
- Add circuit breaker pattern
- Error handling and recovery mechanisms

#### Phase 3: State Management (Weeks 5-6)

- Implement change detection logic
- Add scan session management and resumption
- SQLite backup and recovery system
- Configuration sync with server
- Command polling for on-demand scans

#### Phase 4: Testing and Optimization (Weeks 7-8)

- Comprehensive unit and integration tests
- Performance testing and optimization
- Cross-platform compatibility testing
- Security testing and hardening
- Documentation and deployment guides

### Testing Strategy

**Unit Tests:**

- All core components with >90% coverage
- SQLite operations and schema migrations
- File system operations and change detection
- API client with mock server responses
- Configuration parsing and validation
- Error handling and retry logic

**Integration Tests:**

- End-to-end scanning workflows with real file systems
- API integration with test server
- Database corruption and recovery scenarios
- Network failure and retry scenarios
- Multi-platform compatibility tests

**Performance Tests:**

- Large file set scanning (100K+ files)
- Memory usage profiling and leak detection
- Concurrent scan path processing
- API throughput and latency testing
- SQLite performance under load

## Milestones & Tasks

### Milestone 1: MVP Core Infrastructure

**Duration:** 1-2 weeks
**Deliverables:** Basic project structure and core components

**Tasks:**

- [ ] Set up Nx workspace with @nx-go/nx-go plugin
- [ ] Create Go module structure in `apps/scanner`
- [ ] Implement simplified SQLite schema (file_states, agent_config)
- [ ] Create basic YAML configuration system
- [ ] Implement basic file system scanning with change detection
- [ ] Add simple text logging
- [ ] Basic unit tests for core components

**Deferred to Post-MVP:**

- Advanced structured JSON logging
- Backup and recovery mechanisms
- Complex configuration management

### Milestone 2: MVP API Integration

**Duration:** 1-2 weeks
**Deliverables:** Basic API integration with simple retry logic

**Tasks:**

- [ ] Add file_size column to existing files table
- [ ] Implement basic HTTP API client with API key authentication
- [ ] Add simple agent registration and heartbeat endpoints
- [ ] Implement file ingestion with batching
- [ ] Add basic retry logic (3 attempts)
- [ ] Create basic agents table in database
- [ ] Integration tests with real server

**Deferred to Post-MVP:**

- Advanced exponential backoff and circuit breaker
- Configuration sync from server
- Command polling for on-demand scans

### Milestone 3: MVP State Management

**Duration:** 1 week
**Deliverables:** Basic state management and file change detection

**Tasks:**

- [ ] Implement change detection with mod time + size
- [ ] Add file deletion detection and reporting
- [ ] Basic error handling and logging
- [ ] Performance testing with moderate file sets (10K files)
- [ ] End-to-end testing

**Deferred to Post-MVP:**

- Scan session management and resumption
- Atomic batch processing
- Individual file retry logic
- Advanced performance optimization

### Milestone 4: MVP Deployment Ready

**Duration:** 1 week
**Deliverables:** MVP-ready agent for initial deployment

**Tasks:**

- [ ] Cross-platform compatibility testing (Linux, Windows)
- [ ] Basic security practices (API key handling)
- [ ] Simple deployment scripts and documentation
- [ ] Basic operational documentation
- [ ] MVP testing in staging environment

**Post-MVP Milestones:**

### Milestone 5: Production Hardening (Post-MVP)

- Advanced security hardening
- Comprehensive monitoring and alerting
- Performance optimization
- Operational runbooks
- Advanced deployment automation

### Milestone 6: Advanced Features (Post-MVP)

- Scan session management and resumption
- Advanced retry and circuit breaker patterns
- Configuration sync from server
- Command polling and on-demand scans
- Backup and recovery mechanisms

## MVP vs Future Features

### MVP Scope (Milestones 1-4) - Simplified

**Core MVP Features:**

- ✅ File system scanning with basic metadata extraction (filename, path, size, mod time, MIME type)
- ✅ SQLite-based change detection (mod time + size only)
- ✅ Batch API integration with basic retry logic (3 attempts)
- ✅ Basic agent registration and heartbeat
- ✅ Static YAML configuration files
- ✅ File deletion detection
- ✅ Basic error handling and logging
- ✅ Cross-platform binary deployment (Linux, Windows)
- ✅ Simple deployment scripts

**MVP Constraints:**

- Single agent deployment (no multi-agent coordination)
- Basic change detection (no content hashing)
- Static configuration management (restart required for changes)
- Simple retry logic (no circuit breakers)
- Basic monitoring via logs and heartbeat only
- SQLite corruption = delete and rescan (no backup/recovery)

**Deferred from MVP:**

- ❌ Configuration sync from server
- ❌ On-demand scan triggering
- ❌ Scan resumption after interruption
- ❌ SQLite backup and recovery
- ❌ Advanced retry and circuit breaker patterns
- ❌ Comprehensive monitoring and observability

### Future Enhancements (Post-MVP)

**Phase 2 Features:**

- Content-based change detection (SHA-256 hashing)
- Real-time file system watching
- Plugin system for custom file processors
- Advanced duplicate detection
- Web UI for agent management
- Multi-agent coordination and load balancing

**Phase 3 Features:**

- Machine learning-based file categorization
- Cloud storage integration (S3, Azure Blob)
- Advanced analytics and reporting
- Kubernetes operator for agent management
- Advanced security features (encryption, signing)

**Performance Enhancements:**

- Parallel scan path processing
- Advanced caching strategies
- Database query optimization
- Memory usage optimization
- Network compression

## Risk Assessment & Mitigation

### Technical Risks

| Risk                                   | Impact | Probability | Mitigation                                                          |
| -------------------------------------- | ------ | ----------- | ------------------------------------------------------------------- |
| Go 1.17 compatibility issues           | High   | Low         | Extensive testing on target platforms, conservative library choices |
| SQLite performance with large datasets | Medium | Medium      | Proper indexing, WAL mode, connection pooling, performance testing  |
| Network reliability issues             | Medium | High        | Robust retry logic, circuit breakers, offline operation capability  |
| File system permission errors          | Low    | High        | Graceful error handling, detailed logging, skip and continue        |
| Memory usage with large file counts    | Medium | Medium      | Streaming processing, batch size limits, memory profiling           |
| SQLite corruption                      | High   | Low         | Automatic backups, integrity checks, recovery mechanisms            |
| API rate limiting                      | Medium | Medium      | Circuit breaker, adaptive batch sizing, server coordination         |

### Operational Risks

| Risk                           | Impact | Probability | Mitigation                                                  |
| ------------------------------ | ------ | ----------- | ----------------------------------------------------------- |
| Scheduler configuration errors | Medium | Medium      | Comprehensive documentation, validation tools               |
| API key management             | High   | Low         | Environment variables, secure storage, rotation procedures  |
| Deployment complexity          | Medium | Medium      | Automated deployment scripts, comprehensive documentation   |
| Monitoring gaps                | Medium | Medium      | Comprehensive logging, alerting setup, operational runbooks |
| Agent version management       | Medium | Medium      | Automated updates, version compatibility checks             |

### Security Risks

| Risk                         | Impact | Probability | Mitigation                                         |
| ---------------------------- | ------ | ----------- | -------------------------------------------------- |
| API key exposure             | High   | Low         | Environment variables only, no config file storage |
| File system access abuse     | Medium | Low         | Dedicated user account, read-only permissions      |
| Network traffic interception | Medium | Low         | HTTPS only, certificate validation                 |
| SQLite database access       | Low    | Low         | File permissions, no sensitive data storage        |

## Performance Targets

### Throughput Requirements

- **File Processing Rate**: 1,000+ files per minute
- **Memory Usage**: <100MB for typical workloads (<50K files)
- **Startup Time**: <5 seconds
- **API Response Time**: <2 seconds for batch requests
- **SQLite Operations**: <100ms for typical queries

### Scalability Targets

- **File Count**: Support up to 1M files per scan path
- **Concurrent Scans**: Support 5-10 scan paths simultaneously
- **Batch Size**: Configurable from 10 to 1,000 files per batch
- **Worker Threads**: Configurable from 1 to 50 workers
- **API Concurrency**: 3-5 concurrent requests to server

### Resource Limits

- **Memory Limit**: 100MB with monitoring and alerting
- **Disk Usage**: SQLite database <1GB, backups <10GB
- **Network Bandwidth**: Adaptive based on server response times
- **CPU Usage**: <50% average, <90% peak during scans

## Security Considerations

### Threat Model Summary

| **Threat**                                                   | **Impact** | **Mitigation**                                                   |
| ------------------------------------------------------------ | ---------- | ---------------------------------------------------------------- |
| **Agent Spoofing**: Attacker impersonates legitimate agent   | High       | HMAC request signing with shared secret                          |
| **API Key Compromise**: Stolen API key used maliciously      | High       | Environment variables only, key rotation, rate limiting          |
| **Path Traversal**: Agent scans unauthorized directories     | Medium     | Path sanitization, whitelist validation                          |
| **Data Exfiltration**: Sensitive file content leaked         | Medium     | Metadata-only transmission, no file content access               |
| **Local Database Tampering**: SQLite corruption/manipulation | Low        | File permissions, integrity checks, backups                      |
| **Network Interception**: API traffic intercepted            | Medium     | HTTPS only, certificate validation, optional certificate pinning |

### Authentication & Authorization

**API Key Authentication**: Environment variables only (`SCANNER_API_KEY`)

- **Key Rotation**: Restart acceptable for key updates
- **Certificate Validation**: Strict HTTPS certificate checking
- **Timeout Configuration**: Configurable timeouts for all HTTP operations

### File Access Security

**Best Practices:**

- **Dedicated User Account**: Run as `scanner` user with minimal privileges
- **Read-Only Access**: No write or execute permissions on scan paths
- **Principle of Least Privilege**: Only access to configured scan directories
- **Audit Logging**: Log all file access attempts and permission errors

### Data Protection

- **No Sensitive Content**: Only metadata transmitted, no file content
- **Path Sanitization**: Prevent path traversal attacks
- **Error Message Sanitization**: No sensitive info in logs or API responses
- **Local Database Security**: No sensitive data in SQLite, file permissions

### Network Security

- **HTTPS Only**: All API communication encrypted
- **Certificate Validation**: Strict certificate checking with custom CA support
- **Request Signing**: Optional HMAC signing for API requests
- **Rate Limiting**: Respect server rate limits and implement client-side throttling

## Deployment Strategies

### Linux Environments

```bash
# Systemd service configuration
[Unit]
Description=File Scanner Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/scanner --config /etc/scanner/config.yaml
Restart=always
RestartSec=10
User=scanner
Group=scanner
Environment=SCANNER_API_KEY=your_api_key_here

# Resource limits
MemoryLimit=150M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
```

```bash
# Cron job for scheduled scans
0 */6 * * * /usr/local/bin/scanner --config /etc/scanner/config.yaml
```

### Windows Environments

```powershell
# Task Scheduler configuration
$action = New-ScheduledTaskAction -Execute "C:\scanner\scanner.exe" -Argument "--config C:\scanner\config.yaml"
$trigger = New-ScheduledTaskTrigger -Daily -At "06:00" -RepetitionInterval (New-TimeSpan -Hours 6)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "FileScanner" -Action $action -Trigger $trigger -Settings $settings
```

### Kubernetes Environments

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: file-scanner
spec:
  schedule: '0 */6 * * *'
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: scanner
              image: file-scanner:latest
              command: ['/app/scanner']
              args: ['--config', '/config/config.yaml']
              env:
                - name: SCANNER_API_KEY
                  valueFrom:
                    secretKeyRef:
                      name: scanner-secret
                      key: api-key
              resources:
                requests:
                  memory: '64Mi'
                  cpu: '100m'
                limits:
                  memory: '150Mi'
                  cpu: '500m'
              volumeMounts:
                - name: config
                  mountPath: /config
                - name: scan-data
                  mountPath: /data
                - name: scanner-state
                  mountPath: /app/state
          restartPolicy: OnFailure
          volumes:
            - name: config
              configMap:
                name: scanner-config
            - name: scan-data
              persistentVolumeClaim:
                claimName: scan-data-pvc
            - name: scanner-state
              persistentVolumeClaim:
                claimName: scanner-state-pvc
```

## Configuration Reference

### Configuration Examples

#### MVP Configuration (Simplified)

```yaml
# config.yaml (MVP)
server:
  base_url: 'https://api.example.com'
  api_key: '${SCANNER_API_KEY}' # Environment variable
  timeout: '30s'

agent:
  id: '${HOSTNAME}-scanner'
  heartbeat_interval: '60s'

scanner:
  scan_paths:
    - '/data/documents'
    - '/data/images'
    - "\\\\server\\shared\\files" # Windows UNC path

  ignore_patterns:
    - '*.tmp'
    - '*.log'
    - '.git/*'
    - 'node_modules/*'
    - 'Thumbs.db'
    - '.DS_Store'

  batch_size: 100
  worker_count: 5

database:
  path: './scanner_state.db'

logging:
  level: 'info'
  file: './scanner.log'
```

#### Production Configuration (Post-MVP)

```yaml
# config.yaml (Production)
server:
  base_url: 'https://api.example.com'
  api_key: '${SCANNER_API_KEY}' # Environment variable
  timeout: '30s'
  retry_attempts: 6
  retry_delay: '1s'
  max_retry_delay: '5m'
  circuit_breaker:
    failure_threshold: 50 # percentage
    recovery_timeout: '2m'

agent:
  id: '${HOSTNAME}-scanner' # Auto-generated if not provided
  heartbeat_interval: '60s'
  command_poll_interval: '30s'
  config_sync_interval: '5m'

scanner:
  scan_paths:
    - '/data/documents'
    - '/data/images'
    - "\\\\server\\shared\\files" # Windows UNC path

  ignore_patterns:
    - '*.tmp'
    - '*.log'
    - '.git/*'
    - 'node_modules/*'
    - 'Thumbs.db'
    - '.DS_Store'
    - '*.swp'
    - '*.bak'

  batch_size: 100
  max_file_size: '100MB'
  worker_count: 10
  concurrent_api_calls: 3

  # File type detection
  mime_detection: true
  custom_mime_types:
    '.xyz': 'application/xyz-data'
    '.proprietary': 'application/proprietary-format'

database:
  path: './scanner_state.db'
  backup_enabled: true
  backup_interval: '24h'
  max_backups: 7
  backup_path: './backups'
  wal_mode: true # Enable WAL mode for better performance

logging:
  level: 'info' # debug, info, warn, error
  format: 'json' # json, text
  file: './scanner.log'
  max_size: '10MB'
  max_backups: 5
  max_age: '7d'
  compress: true

# Performance tuning
performance:
  read_buffer_size: '64KB'
  memory_limit: '100MB'
  gc_percent: 100 # GOGC setting
  max_open_files: 1000

# Health check endpoint (optional)
health:
  enabled: false
  port: 8080
  path: '/health'

# Security settings
security:
  file_permissions: '0600' # For created files
  run_as_user: 'scanner'
  audit_file_access: true
```

### Environment Variables

```bash
# Required
SCANNER_API_KEY=your_api_key_here

# Optional
SCANNER_CONFIG_PATH=/etc/scanner/config.yaml
SCANNER_LOG_LEVEL=info
SCANNER_AGENT_ID=custom-agent-id
SCANNER_DATA_DIR=/var/lib/scanner
```

## Monitoring & Observability

### Prometheus Metrics

**Scan Performance Metrics:**

```prometheus
# Scan duration in seconds
scanner_scan_duration_seconds{agent_id="server-01", scan_path="/data/docs"}

# Files processed per scan
scanner_files_processed_total{agent_id="server-01", action="created|updated|deleted|skipped"}

# Scan success rate
scanner_scan_success_rate{agent_id="server-01"}

# Processing rate during active scanning
scanner_files_per_second{agent_id="server-01"}
```

**API Performance Metrics:**

```prometheus
# API call success rate
scanner_api_requests_total{agent_id="server-01", endpoint="/files/ingest", status="success|failure"}

# API response time histogram
scanner_api_request_duration_seconds{agent_id="server-01", endpoint="/files/ingest"}

# Retry rate
scanner_api_retry_count_total{agent_id="server-01", endpoint="/files/ingest"}

# Circuit breaker state
scanner_circuit_breaker_state{agent_id="server-01", state="closed|open|half_open"}
```

**System Performance Metrics:**

```prometheus
# Memory usage in bytes
scanner_memory_usage_bytes{agent_id="server-01"}

# CPU usage percentage
scanner_cpu_usage_percent{agent_id="server-01"}

# SQLite database size
scanner_database_size_bytes{agent_id="server-01"}

# File I/O operations
scanner_file_io_operations_total{agent_id="server-01", operation="read|write"}
```

**Error Tracking Metrics:**

```prometheus
# Error count by type
scanner_errors_total{agent_id="server-01", error_type="permission|network|database|validation"}

# Failed files count
scanner_failed_files_total{agent_id="server-01", reason="permission_denied|network_error|validation_error"}
```

### Sample Grafana Alert Rules

```yaml
# High API failure rate
- alert: ScannerHighAPIFailureRate
  expr: rate(scanner_api_requests_total{status="failure"}[5m]) / rate(scanner_api_requests_total[5m]) > 0.25
  for: 30m
  labels:
    severity: warning
  annotations:
    summary: 'Scanner {{ $labels.agent_id }} has high API failure rate'
    description: 'API failure rate is {{ $value | humanizePercentage }} for agent {{ $labels.agent_id }}'

# Memory usage alert
- alert: ScannerHighMemoryUsage
  expr: scanner_memory_usage_bytes / (100 * 1024 * 1024) > 0.8
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: 'Scanner {{ $labels.agent_id }} memory usage is high'
    description: 'Memory usage is {{ $value | humanizeBytes }} (>80% of 100MB limit)'

# Scan failure alert
- alert: ScannerConsecutiveFailures
  expr: increase(scanner_scan_success_rate[1h]) == 0 and increase(scanner_scan_duration_seconds_count[1h]) >= 3
  for: 0m
  labels:
    severity: critical
  annotations:
    summary: 'Scanner {{ $labels.agent_id }} has 3+ consecutive scan failures'
```

### ELK Stack Integration

**Log Parsing Configuration (FluentD):**

```ruby
<filter scanner.**>
  @type parser
  key_name message
  <parse>
    @type json
    time_key timestamp
    time_format %Y-%m-%dT%H:%M:%S%z
  </parse>
</filter>

<match scanner.**>
  @type elasticsearch
  host elasticsearch.example.com
  port 9200
  index_name scanner-logs-%Y.%m.%d
  type_name _doc
</match>
```

**Elasticsearch Query Examples:**

```json
// Find all scan failures in last 24 hours
GET scanner-logs-*/_search
{
  "query": {
    "bool": {
      "must": [
        {"match": {"level": "error"}},
        {"match": {"component": "scanner"}},
        {"range": {"timestamp": {"gte": "now-24h"}}}
      ]
    }
  }
}

// Aggregate error types by agent
GET scanner-logs-*/_search
{
  "aggs": {
    "agents": {
      "terms": {"field": "agent_id"},
      "aggs": {
        "error_types": {
          "terms": {"field": "error_type"}
        }
      }
    }
  }
}
```

### Log Structure

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "component": "scanner",
  "message": "Scan completed successfully",
  "agent_id": "server-01-scanner",
  "scan_session_id": "scan-123",
  "metrics": {
    "duration_ms": 45000,
    "files_total": 1250,
    "files_new": 23,
    "files_updated": 45,
    "files_deleted": 2,
    "files_skipped": 1180,
    "api_calls": 13,
    "api_failures": 0,
    "retry_count": 2,
    "memory_usage_mb": 67
  },
  "scan_paths": ["/data/documents", "/data/images"]
}
```

### Health Check Endpoint

```json
GET /health
{
  "status": "healthy", // healthy, degraded, unhealthy
  "timestamp": "2024-01-15T10:30:00Z",
  "agent_id": "server-01-scanner",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "last_scan": {
    "started_at": "2024-01-15T10:00:00Z",
    "completed_at": "2024-01-15T10:15:00Z",
    "status": "success",
    "files_processed": 1250
  },
  "database": {
    "status": "healthy",
    "size_mb": 15.2,
    "last_backup": "2024-01-15T06:00:00Z"
  },
  "api": {
    "status": "healthy",
    "last_success": "2024-01-15T10:15:00Z",
    "circuit_breaker": "closed"
  }
}
```

### Alerting Rules

**Critical Alerts:**

- **Scan Failure**: Alert if scan fails 3 consecutive times
- **API Failure Rate**: Alert if API failure rate >25% over 30 minutes
- **Memory Usage**: Alert if memory usage >80% of limit
- **Database Corruption**: Alert on SQLite integrity check failure

**Warning Alerts:**

- **High Retry Rate**: Alert if retry rate >10% over 1 hour
- **Slow Scans**: Alert if scan duration >2x average
- **High Error Rate**: Alert if error rate >5% over 1 hour
- **Database Growth**: Alert if database size grows >50% in 24 hours

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Advanced Change Detection**

   - Content-based hashing (SHA-256) for 100% accuracy
   - Configurable hash verification percentage
   - Duplicate file detection across scan paths

2. **Real-time File Watching**

   - File system events for immediate change detection
   - Reduced scan frequency for static directories
   - Support for network file system events

3. **Enhanced Performance**

   - Parallel scan path processing
   - Advanced caching strategies
   - Database query optimization
   - Memory usage optimization

4. **Advanced Error Handling**
   - Intelligent retry strategies based on error types
   - Predictive failure detection
   - Automatic recovery mechanisms

### Phase 3 Features (Future)

1. **Management Interface**

   - Web UI for scanner configuration and monitoring
   - REST API for remote management
   - Dashboard for scan statistics and health
   - Real-time log streaming

2. **Enhanced Deployment**

   - Kubernetes operator for agent management
   - Helm charts for easy deployment
   - Ansible playbooks for automated setup
   - Docker Compose integration

3. **Advanced Features**

   - Plugin system for custom file processors
   - Rule-based file categorization
   - Integration with cloud storage providers
   - Machine learning-based file analysis

4. **Enterprise Features**
   - Multi-tenant support
   - Advanced security features (encryption, signing)
   - Compliance reporting and auditing
   - High availability and load balancing

## Conclusion

This High-Level Design provides a comprehensive roadmap for implementing a production-ready Go-based file scanner agent. The design prioritizes:

**MVP Focus:**

- **Performance**: Native Go performance with concurrent processing
- **Reliability**: Robust error handling, retry logic, and state management
- **Simplicity**: Clean architecture with minimal dependencies
- **Maintainability**: Clear separation of concerns and comprehensive testing

**Key Design Decisions:**

- **Change Detection**: Modification time + size for MVP (fast and reliable)
- **State Management**: SQLite with backup/recovery for resumable scans
- **API Integration**: HTTP with exponential backoff and circuit breaker
- **Configuration**: Server-managed with local fallback for offline operation
- **Security**: Dedicated user account with minimal privileges

**Future Extensibility:**

- **Plugin Architecture**: Ready for custom file processors
- **Advanced Change Detection**: Content hashing for high-accuracy scenarios
- **Real-time Capabilities**: File system watching for immediate updates
- **Enterprise Features**: Multi-tenant support and advanced security

The phased implementation approach ensures steady progress with regular deliverables, while the comprehensive task breakdown provides clear guidance for development teams. The integration with the Nx workspace using [@nx-go/nx-go](https://github.com/nx-go/nx-go) ensures consistency with existing development practices.

This solution addresses the core requirement of efficiently scanning and ingesting file metadata while maintaining the agent's focus on speed, reliability, and operational simplicity.

## MVP vs Production Design Summary

This HLD has been structured to support both MVP and production deployment strategies:

### MVP Design Choices (Weeks 1-4)

- **Simplified SQLite schema**: 2 tables instead of 4+ tables
- **Basic retry logic**: 3 attempts vs advanced exponential backoff
- **Static configuration**: YAML files vs server-side config sync
- **Simple error handling**: Log and continue vs comprehensive recovery
- **Minimal API endpoints**: 2 endpoints vs 4+ endpoints
- **Basic monitoring**: Text logs vs structured JSON + metrics
- **Performance targets**: 10K files vs 1M+ files

### Production Evolution (Post-MVP)

- **Advanced state management**: Scan sessions and resumption
- **Sophisticated error handling**: Circuit breakers and partial retries
- **Dynamic configuration**: Server-side config sync and hot reloading
- **Comprehensive monitoring**: Health endpoints, metrics, and alerting
- **Enhanced reliability**: Backup/recovery and corruption handling
- **Scalability features**: Advanced performance optimization

This approach ensures rapid MVP delivery while maintaining a clear path to production-grade capabilities.

```

```
