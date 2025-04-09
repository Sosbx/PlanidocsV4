import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import Badge from './Badge';
import { useAuth } from '../../features/auth';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'exchange' | 'give' | 'interested' | 'accepted' | 'rejected' | 'completed' | 'system';
  read: boolean;
  createdAt: string;
  relatedId?: string; // ID de l'échange ou de la garde concernée
  link?: string; // Lien optionnel pour rediriger l'utilisateur
}

interface NotificationBellProps {
  notifications: Notification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  className?: string;
}

/**
 * Composant d'icône de notification avec compteur et menu déroulant
 */
const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Filtrer les notifications non lues
  const unreadNotifications = notifications.filter(notification => !notification.read);
  const unreadCount = unreadNotifications.length;

  // Trier les notifications par date (les plus récentes en premier)
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 10); // Limiter à 10 notifications

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Formater la date relative (il y a X minutes/heures/jours)
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    if (diffSec < 60) {
      return 'À l\'instant';
    } else if (diffMin < 60) {
      return `Il y a ${diffMin} min`;
    } else if (diffHour < 24) {
      return `Il y a ${diffHour} h`;
    } else {
      return `Il y a ${diffDay} j`;
    }
  };

  // Obtenir la couleur de fond en fonction du type de notification
  const getNotificationBgColor = (type: Notification['type'], read: boolean) => {
    const baseClass = read ? 'hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100';
    
    switch (type) {
      case 'exchange':
        return `${baseClass} border-l-4 border-indigo-400`;
      case 'give':
        return `${baseClass} border-l-4 border-emerald-400`;
      case 'interested':
        return `${baseClass} border-l-4 border-blue-400`;
      case 'accepted':
        return `${baseClass} border-l-4 border-green-400`;
      case 'rejected':
        return `${baseClass} border-l-4 border-red-400`;
      case 'completed':
        return `${baseClass} border-l-4 border-purple-400`;
      case 'system':
      default:
        return `${baseClass} border-l-4 border-gray-400`;
    }
  };

  // Obtenir l'icône en fonction du type de notification
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'exchange':
        return <div className="w-2 h-2 rounded-full bg-indigo-500"></div>;
      case 'give':
        return <div className="w-2 h-2 rounded-full bg-emerald-500"></div>;
      case 'interested':
        return <div className="w-2 h-2 rounded-full bg-blue-500"></div>;
      case 'accepted':
        return <div className="w-2 h-2 rounded-full bg-green-500"></div>;
      case 'rejected':
        return <div className="w-2 h-2 rounded-full bg-red-500"></div>;
      case 'completed':
        return <div className="w-2 h-2 rounded-full bg-purple-500"></div>;
      case 'system':
      default:
        return <div className="w-2 h-2 rounded-full bg-gray-500"></div>;
    }
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full text-blue-50 hover:bg-blue-500/50 hover:text-white transition-all duration-200 relative"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1">
            <Badge 
              type="interested" 
              count={unreadCount} 
              size="sm" 
              className="ring-2 ring-blue-600"
            />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-50">
          <div className="py-2 px-3 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-700">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {sortedNotifications.length === 0 ? (
              <div className="py-4 px-3 text-center text-sm text-gray-500">
                Aucune notification
              </div>
            ) : (
              <div>
                {sortedNotifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`py-2 px-3 border-b last:border-b-0 cursor-pointer transition-colors ${getNotificationBgColor(
                      notification.type,
                      notification.read
                    )}`}
                    onClick={() => {
                      if (!notification.read) {
                        onMarkAsRead(notification.id);
                      }
                      setIsOpen(false);
                      // Si un lien est fourni, rediriger l'utilisateur
                      if (notification.link) {
                        window.location.href = notification.link;
                      }
                    }}
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0 mt-1 mr-2">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="py-2 px-3 bg-gray-50 border-t text-center">
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-gray-600 hover:text-gray-800"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
