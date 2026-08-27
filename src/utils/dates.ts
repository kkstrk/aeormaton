export const isToday = (date: Date) => {
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
};

export const getRemainingTime = (date: Date) => {
    const total = date.getTime() - Date.now();

    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));

    return `${days} days, ${hours} hours and ${minutes} minutes`;
};

export const getDifference = (date: Date) =>
    Math.ceil((date.getTime() - Date.now()) / 1000 / 60 / 60);
