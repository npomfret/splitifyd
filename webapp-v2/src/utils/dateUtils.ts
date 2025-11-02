import { ISOString, toISOString } from '@splitifyd/shared';

export const formatLocalDateTime = (utcString: string): string => {
    const date = new Date(utcString);
    return date.toLocaleString();
};

const getUserTimeZone = (): string | undefined => {
    if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
        return undefined;
    }

    try {
        const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
        return timeZone;
    } catch {
        return undefined;
    }
};

const pad = (value: number): string => value.toString().padStart(2, '0');

export const formatDateTimeInUserTimeZone = (date: Date): string => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '';
    }

    const detectedTimeZone = getUserTimeZone();
    const timeZone = detectedTimeZone || 'UTC';

    try {
        const dateFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });

        const timeFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });

        const dateParts = dateFormatter.formatToParts(date);
        const timeParts = timeFormatter.formatToParts(date);

        const year = dateParts.find((part) => part.type === 'year')?.value;
        const month = dateParts.find((part) => part.type === 'month')?.value;
        const day = dateParts.find((part) => part.type === 'day')?.value;

        const hour = timeParts.find((part) => part.type === 'hour')?.value;
        const minute = timeParts.find((part) => part.type === 'minute')?.value;
        const second = timeParts.find((part) => part.type === 'second')?.value;

        const dateComponent = year && month && day ? `${year}-${month}-${day}` : undefined;
        const timeComponent = hour && minute && second ? `${hour}:${minute}:${second}` : undefined;

        if (dateComponent && timeComponent) {
            return `${dateComponent} ${timeComponent}`;
        }

        // Fallback to manual ISO-like construction if formatToParts fails
        const yearManual = date.getUTCFullYear();
        const monthManual = pad(date.getUTCMonth() + 1);
        const dayManual = pad(date.getUTCDate());
        const hourManual = pad(date.getUTCHours());
        const minuteManual = pad(date.getUTCMinutes());
        const secondManual = pad(date.getUTCSeconds());

        return `${yearManual}-${monthManual}-${dayManual} ${hourManual}:${minuteManual}:${secondManual}`;
    } catch {
        return date.toISOString();
    }
};

export const getUTCMidnight = (localDateString: string): ISOString => {
    const [year, month, day] = localDateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    return toISOString(date.toISOString());
};

export const getUTCDateTime = (localDateString: string, timeString: string): ISOString => {
    const [year, month, day] = localDateString.split('-').map(Number);
    const [hours, minutes] = timeString.split(':').map(Number);

    const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

    return toISOString(localDate.toISOString());
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
