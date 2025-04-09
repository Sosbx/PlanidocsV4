import { format, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { isHoliday, isBridgeDay } from './holidayUtils';

export const getDaysArray = (start: Date, end: Date): Date[] => {
  const arr = [];
  const dt = new Date(start);
  while (dt <= end) {
    arr.push(new Date(dt));
    dt.setDate(dt.getDate() + 1);
  }
  return arr;
};

export const getMonthsInRange = (start: Date, end: Date) => {
  return eachMonthOfInterval({ start, end });
};

export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

export const isGrayedOut = (date: Date): boolean => {
  return isWeekend(date) || isHoliday(date) || isBridgeDay(date);
};