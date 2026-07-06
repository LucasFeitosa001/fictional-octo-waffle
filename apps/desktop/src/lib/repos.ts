// Repositórios do desktop: persistência em localStorage via adapter do @silvia/core.
import { createRepositories, createWebStorageAdapter } from '@silvia/core';

export const storage = createWebStorageAdapter(window.localStorage);
export const repos = createRepositories(storage);
