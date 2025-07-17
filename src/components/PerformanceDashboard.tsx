import React, { useState, useEffect } from 'react';
import { createParisDate } from '@/utils/timezoneUtils';
import { performanceProfiler, ComponentPerformanceMetrics } from '../utils/performanceProfiler';
import { logger } from '../utils/logger';

/**
 * Dashboard de performance pour monitorer les composants React en temps réel
 * Disponible uniquement en mode développement
 */
export const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<ComponentPerformanceMetrics[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'averageTime' | 'renderCount' | 'unnecessaryRenders'>('averageTime');

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const interval = setInterval(() => {
      setMetrics(performanceProfiler.getAllMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleExportMetrics = () => {
    const data = performanceProfiler.exportMetrics();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-metrics-${createParisDate().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('📊 PerformanceDashboard: Metrics exported');
  };

  const handleReset = () => {
    performanceProfiler.reset();
    setMetrics([]);
    console.log('📊 PerformanceDashboard: Metrics reset');
  };

  const sortedMetrics = [...metrics].sort((a, b) => {
    switch (sortBy) {
      case 'averageTime':
        return b.averageTime - a.averageTime;
      case 'renderCount':
        return b.renderCount - a.renderCount;
      case 'unnecessaryRenders':
        return b.unnecessaryRenders - a.unnecessaryRenders;
      default:
        return 0;
    }
  });

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      {/* Bouton flottant pour ouvrir le dashboard */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-colors duration-200"
        title="Performance Dashboard"
      >
        📊
      </button>

      {/* Dashboard modal */}
      {isVisible && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">Performance Dashboard</h2>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1 border rounded text-sm"
                >
                  <option value="averageTime">Trier par temps moyen</option>
                  <option value="renderCount">Trier par nombre de rendus</option>
                  <option value="unnecessaryRenders">Trier par rendus inutiles</option>
                </select>
                <button
                  onClick={handleExportMetrics}
                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                >
                  Exporter
                </button>
                <button
                  onClick={handleReset}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  Reset
                </button>
                <button
                  onClick={() => setIsVisible(false)}
                  className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                >
                  Fermer
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="px-6 py-4 bg-blue-50 border-b">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{metrics.length}</div>
                  <div className="text-sm text-gray-600">Composants</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {metrics.reduce((sum, m) => sum + m.renderCount, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Rendus totaux</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {metrics.reduce((sum, m) => sum + m.unnecessaryRenders, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Rendus inutiles</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {metrics.length > 0 
                      ? Math.max(...metrics.map(m => m.averageTime)).toFixed(1)
                      : '0'}ms
                  </div>
                  <div className="text-sm text-gray-600">Temps max moyen</div>
                </div>
              </div>
            </div>

            {/* Metrics table */}
            <div className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Composant</th>
                    <th className="px-4 py-2 text-center">Rendus</th>
                    <th className="px-4 py-2 text-center">Temps moyen</th>
                    <th className="px-4 py-2 text-center">Temps max</th>
                    <th className="px-4 py-2 text-center">Rendus inutiles</th>
                    <th className="px-4 py-2 text-center">Dernier rendu</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMetrics.map((metric) => (
                    <tr 
                      key={metric.componentName} 
                      className={`border-b hover:bg-gray-50 ${
                        metric.unnecessaryRenders > 0 ? 'bg-red-50' : 
                        metric.averageTime > 16 ? 'bg-orange-50' : ''
                      }`}
                    >
                      <td className="px-4 py-2 font-medium">
                        {metric.componentName}
                        {metric.unnecessaryRenders > 0 && (
                          <span className="ml-2 text-red-500 text-xs">⚠️</span>
                        )}
                        {metric.averageTime > 16 && (
                          <span className="ml-2 text-orange-500 text-xs">🐌</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">{metric.renderCount}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={metric.averageTime > 16 ? 'text-red-600 font-bold' : ''}>
                          {metric.averageTime.toFixed(2)}ms
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">{metric.maxTime.toFixed(2)}ms</td>
                      <td className="px-4 py-2 text-center">
                        <span className={metric.unnecessaryRenders > 0 ? 'text-red-600 font-bold' : ''}>
                          {metric.unnecessaryRenders}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">{metric.lastRenderTime.toFixed(2)}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-600">
              <div className="flex gap-4">
                <span>⚠️ = Rendus inutiles détectés</span>
                <span>🐌 = Rendu lent (&gt; 16ms)</span>
                <span className="bg-red-50 px-2 py-1">Rouge = Problèmes de performance</span>
                <span className="bg-orange-50 px-2 py-1">Orange = Rendu lent</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};