if (process.env.NODE_ENV !== "production") {
    try {
        process.loadEnvFile();
    } catch (error) {
        console.log("Could not load .env file.", error);
    }
}

export const requiredEnv = (name: string): string => {
    const value = process.env[name];
    if (value) {
        return value;
    }
    throw new Error(`Missing required environment variable: ${name}`);
};
