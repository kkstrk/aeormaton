import { AppTokenAuthProvider } from "@twurple/auth";
import { ApiClient } from "@twurple/api";

import { requiredEnv } from "../utils/useEnv.js";

const authProvider = new AppTokenAuthProvider(
    requiredEnv("TWITCH_CLIENT_ID"),
    requiredEnv("TWITCH_CLIENT_SECRET"),
);
const api = new ApiClient({ authProvider });

export const getNextBroadcast = async () => {
    const response = await api.schedule.getSchedule("229729353");
    const segment = response.data.segments.find(({ cancelEndDate }) => !cancelEndDate);
    return segment;
};
