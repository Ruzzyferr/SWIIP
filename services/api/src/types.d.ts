/* eslint-disable @typescript-eslint/no-explicit-any -- ambient shims for packages without accurate typings */
declare module 'meilisearch' {
  export class MeiliSearch {
    constructor(config: { host: string; apiKey?: string });
    index(uid: string): Index;
    createIndex(uid: string, options?: { primaryKey?: string }): Promise<any>;
    getIndex(uid: string): Promise<Index>;
  }

  export interface SearchResponse<T = Record<string, any>> {
    hits: T[];
    offset: number;
    limit: number;
    estimatedTotalHits: number;
    totalHits?: number;
    totalPages?: number;
    hitsPerPage?: number;
    page?: number;
    processingTimeMs: number;
    query: string;
  }

  export interface Index {
    search<T = Record<string, any>>(query: string, options?: any): Promise<SearchResponse<T>>;
    addDocuments(documents: any[], options?: any): Promise<any>;
    updateDocuments(documents: any[], options?: any): Promise<any>;
    deleteDocument(id: string | number): Promise<any>;
    deleteAllDocuments(): Promise<any>;
    updateSettings(settings: any): Promise<any>;
    updateFilterableAttributes(attributes: string[]): Promise<any>;
    updateSearchableAttributes(attributes: string[]): Promise<any>;
    updateSortableAttributes(attributes: string[]): Promise<any>;
  }
}

declare module '@nestjs/platform-express' {
  export function FileInterceptor(fieldName: string, options?: any): any;
  export function FilesInterceptor(fieldName: string, maxCount?: number, options?: any): any;
}

declare module '@nestjs/websockets' {
  export class WsException extends Error {
    constructor(message: string | object);
  }
}

declare module 'express' {
  export interface Request {
    body?: any;
    params?: any;
    query?: any;
    headers?: any;
    user?: any;
    [key: string]: any;
  }
}
