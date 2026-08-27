import { setTimeout } from "node:timers/promises";

export const retry = async <T>(
    fn: () => Promise<T>,
    { attempts = 3, delayMs = 1000 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < attempts) {
                await setTimeout(delayMs * attempt);
            }
        }
    }
    throw lastError;
};
