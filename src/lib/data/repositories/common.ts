/** Server-only contracts. Services authenticate and authorize before calling repositories.
 * Adapters must scope owner reads/writes; never accept identity from request payloads.
 * Missing single rows return null; failures reject (never silently return mock data).
 */
export type PageRequest = { limit: number; offset: number };
export type Page<T> = { items: T[]; total: number };
export type CreateRecord<T extends { id: string; createdAt: string }> = Omit<T, "id" | "createdAt" | "updatedAt">;
export type UpdateRecord<T extends { id: string; createdAt: string }> = Partial<CreateRecord<T>>;
