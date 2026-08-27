import { getNextBroadcast as defaultGetNextBroadcast, TWITCH_CHANNEL_URL } from "../api/twitch.js";
import { getRemainingTime } from "../utils/dates.js";

import type { BotClient } from "../types/index.js";

export interface BroadcastSegment {
    endDate: Date;
    id: string;
    startDate: Date;
    title: string;
}

export type GetNextBroadcast = () => Promise<BroadcastSegment | undefined>;

interface StreamReminderOptions {
    getNextBroadcast?: GetNextBroadcast;
    maxCheckDelayMs?: number;
    reminderMinutesBefore?: number;
}

const MINUTE_MS = 60 * 1000;
const DEFAULT_REMINDER_MINUTES_BEFORE = 30;
// Cap on how long we sleep in one go, even if the next broadcast is much
// further away -- keeps us from trusting a far-future schedule blindly in
// case it gets rescheduled or canceled in the meantime, without falling
// back to short, wasteful polling.
const DEFAULT_MAX_CHECK_DELAY_MS = 12 * 60 * MINUTE_MS;

// Pure decision: given the current next broadcast (if any), works out how
// long to sleep before checking again, and whether a reminder is due right
// now. No fixed polling interval -- we sleep until right around when a
// reminder would be due, re-verifying at most every maxCheckDelayMs.
export const getNextCheck = (
    segment: BroadcastSegment | undefined,
    {
        maxCheckDelayMs,
        reminderMinutesBefore,
    }: { maxCheckDelayMs: number; reminderMinutesBefore: number },
    now = Date.now(),
): { delayMs: number; shouldRemind: boolean } => {
    if (!segment) {
        return { delayMs: maxCheckDelayMs, shouldRemind: false };
    }

    const msUntilStart = segment.startDate.getTime() - now;
    const msUntilReminder = msUntilStart - reminderMinutesBefore * MINUTE_MS;

    if (msUntilReminder > 0) {
        // not there yet: sleep until the reminder is due, but never longer
        // than maxCheckDelayMs in one go
        return { delayMs: Math.min(msUntilReminder, maxCheckDelayMs), shouldRemind: false };
    }

    // at or past the reminder threshold
    const shouldRemind = msUntilStart > 0;
    const msUntilEnd = segment.endDate.getTime() - now;
    const delayMs = msUntilEnd > 0 ? msUntilEnd : maxCheckDelayMs;
    return { delayMs, shouldRemind };
};

export const createStreamReminder = (bot: BotClient, options: StreamReminderOptions = {}) => {
    const {
        getNextBroadcast = defaultGetNextBroadcast,
        maxCheckDelayMs = DEFAULT_MAX_CHECK_DELAY_MS,
        reminderMinutesBefore = DEFAULT_REMINDER_MINUTES_BEFORE,
    } = options;

    // the ID of the segment we already reminded about, so waking up again
    // for the same segment (e.g. to reschedule after it ends) doesn't
    // repost it
    let remindedSegmentId: string | undefined;

    // Runs one check and returns how long to wait before the next one.
    // Doesn't schedule anything itself, so it's safe to call directly (e.g.
    // in tests) without side effects beyond posting.
    const checkOnce = async (): Promise<number> => {
        let delayMs = maxCheckDelayMs;
        try {
            const segment = await getNextBroadcast();
            const next = getNextCheck(segment, { maxCheckDelayMs, reminderMinutesBefore });
            delayMs = next.delayMs;

            if (next.shouldRemind && segment && segment.id !== remindedSegmentId) {
                // mark before posting: the reminder text embeds a live
                // countdown, so a retried post after a lost response
                // wouldn't even be caught by bot.ts's text-based dedup --
                // recording the segment ID first avoids a duplicate reminder
                remindedSegmentId = segment.id;
                await bot.post({
                    text: `${segment.title} starts in ${getRemainingTime(segment.startDate)}! ${TWITCH_CHANNEL_URL}`,
                });
            }
        } catch (error) {
            console.error("Could not check for an upcoming stream reminder.", error);
        }
        return delayMs;
    };

    const start = () => {
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const runLoop = async () => {
            const delayMs = await checkOnce();
            // a check can still be in flight when stop() is called; without
            // this guard it would schedule a timer that stop() never gets a
            // chance to clear
            if (stopped) {
                return;
            }
            timer = setTimeout(() => void runLoop(), delayMs);
        };
        void runLoop();

        return () => {
            stopped = true;
            if (timer) {
                clearTimeout(timer);
            }
        };
    };

    return { checkOnce, start };
};
