import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { getTimeRemaining } from '../utils/timeUtils';

interface CountdownProps {
  deadline: Date;
}

const Countdown: React.FC<CountdownProps> = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState(getTimeRemaining(deadline));

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = getTimeRemaining(deadline);
      setTimeLeft(remaining);
      
      if (remaining.isExpired) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  if (timeLeft.isExpired) {
    return (
      <div className="flex flex-col gap-2 bg-red-100 text-red-800 px-6 py-4 rounded-lg md:w-72">
        <div className="flex items-center gap-2 text-lg font-bold">
          <Clock className="h-6 w-6 flex-shrink-0" />
          <span>Le délai de réponse est expiré</span>
        </div>
        <p className="text-sm text-red-600 px-6">
          Les desiderata ne sont plus modifiables après expiration du délai.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 bg-red-50 text-red-800 px-6 py-4 rounded-lg md:w-72">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6 flex-shrink-0" />
        <span className="font-medium">Temps restant</span>
      </div>
      <div className="text-3xl font-bold tabular-nums tracking-wider text-center">
        {timeLeft.days > 0 && (
          <span className="mr-2">
            {timeLeft.days}j
          </span>
        )}
        <span>
          {String(timeLeft.hours).padStart(2, '0')}:
          {String(timeLeft.minutes).padStart(2, '0')}:
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
      <p className="text-sm text-red-600 mt-1">
        Attention : Les desiderata ne seront plus modifiables après expiration du délai.
      </p>
    </div>
  );
};

export default Countdown;