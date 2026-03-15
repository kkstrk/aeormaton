import { AppTokenAuthProvider } from "@twurple/auth";
import { ApiClient } from "@twurple/api";

import { requiredEnv, useEnv } from "../utils/useEnv.js";

useEnv();

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
