import { config } from 'dotenv';

export const useEnv = () => {
    if (process.env.NODE_ENV !== 'production') {
        config();
    }
};
