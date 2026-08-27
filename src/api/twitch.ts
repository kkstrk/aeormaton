import { AppTokenAuthProvider } from "@twurple/auth";
import { ApiClient } from "@twurple/api";

import { requiredEnv } from "../utils/useEnv.js";

export const TWITCH_BROADCASTER_ID = "229729353";
export const TWITCH_CHANNEL_URL = "https://www.twitch.tv/criticalrole";

const authProvider = new AppTokenAuthProvider(
    requiredEnv("TWITCH_CLIENT_ID"),
    requiredEnv("TWITCH_CLIENT_SECRET"),
);
const api = new ApiClient({ authProvider });

export const getNextBroadcast = async () => {
    const response = await api.schedule.getSchedule(TWITCH_BROADCASTER_ID);
    const segment = response.data.segments.find(({ cancelEndDate }) => !cancelEndDate);
    return segment;
};
