import { Timestamp } from 'firebase/firestore';

export const formatLocalDateTime = (utcString: string): string => {
    const date = new Date(utcString);
    return date.toLocaleString();
};

export const getUTCMidnight = (localDateString: string): string => {
    const [year, month, day] = localDateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    return date.toISOString();
};

export const getUTCDateTime = (localDateString: string, timeString: string): string => {
    const [year, month, day] = localDateString.split('-').map(Number);
    const [hours, minutes] = timeString.split(':').map(Number);

    const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

    return localDate.toISOString();
};

const isNoonTime = (isoString: string): boolean => {
    return isoString.includes('T12:00:00');
};

export const formatExpenseDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    const isNoon = isNoonTime(isoString);

    const year = date.getFullYear();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();

    if (isNoon) {
        return `${month} ${day}, ${year}`;
    } else {
        const hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

        return `${month} ${day}, ${year} at ${displayHours}:${minutes} ${ampm}`;
    }
};

export const extractTimeFromISO = (isoString: string): string => {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

export const isDateInFuture = (dateString: string): boolean => {
    const [year, month, day] = dateString.split('-').map(Number);

    const inputDate = new Date(year, month - 1, day, 0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return inputDate > today;
};

export function formatDistanceToNow(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
        return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
        return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
    }

    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`;
}

export const getToday = (): Date => {
    return new Date();
};

export const getYesterday = (): Date => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
};

export const getThisMorning = (): Date => {
    const date = new Date();
    date.setHours(9, 0, 0, 0);
    return date;
};

export const getLastNight = (): Date => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(20, 0, 0, 0);
    return date;
};
