import { AppTokenAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';

import { useEnv } from '../utils/useEnv';

useEnv();

const authProvider = new AppTokenAuthProvider(
    process.env.TWITCH_CLIENT_ID,
    process.env.TWITCH_CLIENT_SECRET,
);
const api = new ApiClient({ authProvider });

export const getNextBroadcast = async () => {
    const response = await api.schedule.getSchedule('229729353');
    const segment = response.data.segments.find(({ cancelEndDate }) => !cancelEndDate);
    return segment;
};
