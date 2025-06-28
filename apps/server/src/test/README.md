# Component Test Infrastructure

This directory contains the component test infrastructure for testing services with their database dependencies.

## Overview

The test infrastructure provides:

- A test database setup using Docker
- Test utilities for creating test data
- A test setup that runs migrations and cleans up between tests
- Comprehensive tests for the FileIngestionService

## Files

- `setup.ts` - Test database setup and global test configuration
- `test-utils.ts` - Utilities for creating test data and database operations
- `test-module.ts` - NestJS test module configuration (for future use)
- `file-ingestion.service.test.ts` - Comprehensive tests for FileIngestionService
- `README.md` - This documentation

## Setup

### 1. Start the Test Database

```bash
# Start the test PostgreSQL database
docker-compose -f docker-compose/docker-compose-test.yaml up -d

# Wait for the database to be ready
docker-compose -f docker-compose/docker-compose-test.yaml logs -f postgres-test
```

### 2. Run Tests

```bash
# Run tests once
nx run server:test

# Run tests in watch mode
nx run server:test:watch

# Or run directly with vitest
cd apps/server
vitest run
```

## Test Database Configuration

The test database uses:

- **Host**: localhost
- **Port**: 5433 (different from main database)
- **Database**: file_search_test
- **User**: postgres
- **Password**: postgres

The database URL is: `postgresql://postgres:postgres@localhost:5433/file_search_test`

## How It Works

1. **Test Setup**: Before all tests, the setup file creates a connection to the test database and runs migrations
2. **Test Isolation**: Before each test, the database is cleared to ensure test isolation
3. **Service Testing**: Services are tested with the actual database, ensuring real integration testing
4. **Cleanup**: After all tests, the database connection is closed

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TestFileIngestionService } from './file-ingestion.service.test';
import { createTestFileMetadata } from './test-utils';

describe('YourService', () => {
  let service: TestFileIngestionService;

  beforeEach(async () => {
    service = new TestFileIngestionService();
  });

  it('should do something', async () => {
    // Your test here
  });
});
```

### Using Test Utilities

```typescript
// Create test file metadata
const fileMetadata = createTestFileMetadata({
  filename: 'test.txt',
  path: '/test/path.txt',
  tags: ['test', 'example'],
});

// Create files directly in database
const file = await createTestFile({
  filename: 'test.txt',
  fileType: 'text/plain',
  path: '/test/path.txt',
  tags: ['test'],
});

// Get files from database
const allFiles = await getAllFiles();
const fileWithTags = await getFileWithTags(fileId);
```

## Test Coverage

The FileIngestionService tests cover:

### ingestFiles method

- ✅ Single file ingestion with tags
- ✅ Multiple files ingestion
- ✅ Files without tags
- ✅ Empty file list
- ✅ Updating existing files (upsert functionality)
- ✅ Files with custom lastIndexedAt timestamp

### getFiles method

- ✅ Empty database
- ✅ Multiple files with tags
- ✅ Files without tags
- ✅ Proper ordering by createdAt
- ✅ Correct data structure

## Troubleshooting

### Database Connection Issues

- Ensure the test database is running: `docker-compose -f docker-compose/docker-compose-test.yaml ps`
- Check if port 5433 is available
- Verify the database is ready: `docker-compose -f docker-compose/docker-compose-test.yaml logs postgres-test`

### Migration Issues

- Ensure migrations are up to date: `nx run server:generate-migrations`
- Check if migrations run successfully in the test setup

### Test Timeouts

- Tests have a 30-second timeout for database operations
- If tests are slow, check database performance or increase timeout in vitest.config.ts
