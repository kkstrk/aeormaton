import { config } from "dotenv";

export const useEnv = () => {
    if (process.env.NODE_ENV !== "production") {
        config();
    }
};

export const requiredEnv = (name: string): string => {
    const value = process.env[name];
    if (value) {
        return value;
    }
    throw new Error(`Missing required environment variable: ${name}`);
};
