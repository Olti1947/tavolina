import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

export type { paths, components } from './schema';

/**
 * Typed client for the Tavolina API. Types come from `schema.d.ts`, which is generated from
 * `openapi.json`; run `make api-client` after changing the API instead of editing them.
 */
export function createApiClient(baseUrl: string, getToken?: () => string | undefined) {
  const client = createClient<paths>({ baseUrl });
  if (getToken) {
    const auth: Middleware = {
      onRequest({ request }) {
        const token = getToken();
        if (token) request.headers.set('Authorization', `Bearer ${token}`);
        return request;
      },
    };
    client.use(auth);
  }
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
