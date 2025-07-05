import * as schema from './schema';

// Simple in-memory store to replace the database
const inMemoryStore: {
  files: any[];
  tags: any[];
  scanPaths: any[];
  scanPathIgnores: any[];
} = {
  files: [],
  tags: [],
  scanPaths: [],
  scanPathIgnores: [],
};

// Mock implementation of database operations
const mockDb = {
  // Mock queries for the files table
  select: () => ({
    from: (table: any) => {
      if (table === schema.files) {
        return {
          leftJoin: () => ({
            orderBy: () => inMemoryStore.files,
          }),
        };
      }
      return [];
    },
  }),
  insert: (table: any) => ({
    values: (values: any) => ({
      onConflictDoUpdate: () => ({
        returning: () => {
          if (table === schema.files) {
            const records = Array.isArray(values) ? values : [values];
            records.forEach((record) => {
              const id = crypto.randomUUID();
              inMemoryStore.files.push({
                ...record,
                id,
              });
            });
            return inMemoryStore.files;
          }
          return [];
        },
      }),
      returning: () => {
        if (table === schema.tags) {
          const records = Array.isArray(values) ? values : [values];
          records.forEach((record) => {
            const id = crypto.randomUUID();
            inMemoryStore.tags.push({
              ...record,
              id,
            });
          });
        }
        return [];
      },
    }),
  }),
  delete: (table: any) => ({
    where: () => {
      if (table === schema.tags) {
        inMemoryStore.tags = [];
      }
      return [];
    },
  }),
  transaction: async (callback: any) => {
    return callback(mockDb);
  },
};

export const mockDrizzle = mockDb as any;

export const mockDatabaseProviders = [
  {
    provide: 'DATABASE',
    useValue: mockDb,
  },
];
