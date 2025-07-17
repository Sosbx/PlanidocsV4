import React, { useState, useEffect, useMemo } from 'react';
import { Save, RotateCcw, Info, Sliders, Sun, Sunset, Moon, Users, Target, Award } from 'lucide-react';
import type { 
  ScoringConfig, 
  EquityConfig, 
  ShiftTypeScore,
  ScoringPreset 
} from '../../types/scoring';
import { DEFAULT_EQUITY_CONFIG, EQUITY_PRESETS } from '../../types/scoring';
import { getShiftPeriod, getShiftTypeLabel } from '../../../../constants/shiftTypes';

interface ScoreConfigPanelProps {
  config: ScoringConfig;
  shiftTypes: string[];
  allShiftTypes?: {
    M: Record<string, { count: number; sites: string[]; timeSlots: string[] }>;
    AM: Record<string, { count: number; sites: string[]; timeSlots: string[] }>;
    S: Record<string, { count: number; sites: string[]; timeSlots: string[] }>;
  };
  onSave: (config: ScoringConfig) => Promise<void>;
  loading?: boolean;
}

const ScoreConfigPanel: React.FC<ScoreConfigPanelProps> = ({
  config: initialConfig,
  shiftTypes,
  allShiftTypes,
  onSave,
  loading = false
}) => {
  // S'assurer que la configuration a la structure equity
  const ensureEquityConfig = (cfg: ScoringConfig): ScoringConfig => {
    if (!cfg.equity) {
      return {
        ...cfg,
        equity: DEFAULT_EQUITY_CONFIG
      };
    }
    return cfg;
  };

  const [config, setConfig] = useState<ScoringConfig>(() => ensureEquityConfig(initialConfig));
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'equity' | 'scores'>('equity');

  // Mettre à jour la configuration quand initialConfig change
  useEffect(() => {
    setConfig(ensureEquityConfig(initialConfig));
  }, [initialConfig]);

  // Mettre à jour la configuration d'équité
  const updateEquityConfig = (updates: Partial<EquityConfig>) => {
    setConfig(prev => ({
      ...prev,
      equity: {
        ...prev.equity,
        ...updates
      }
    }));
    setIsDirty(true);
  };

  // Mettre à jour un score de garde
  const updateShiftScore = (shiftType: string, value: number) => {
    setConfig(prev => ({
      ...prev,
      shiftScores: {
        ...prev.shiftScores,
        [shiftType]: {
          shiftType,
          score: value,
          updatedAt: new Date()
        }
      }
    }));
    setIsDirty(true);
  };

  // Appliquer un preset
  const applyPreset = (preset: ScoringPreset) => {
    setConfig(prev => ({
      ...prev,
      equity: preset.equity
    }));
    setIsDirty(true);
  };

  // Sauvegarder la configuration
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(config);
      setIsDirty(false);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    } finally {
      setSaving(false);
    }
  };

  // Réinitialiser aux valeurs par défaut
  const resetToDefaults = () => {
    setConfig(prev => ({
      ...prev,
      equity: DEFAULT_EQUITY_CONFIG
    }));
    setIsDirty(true);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Configuration du système de scoring</h2>
        <div className="flex gap-2">
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4 mr-2 inline" />
            Réinitialiser
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
              isDirty && !saving
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
            disabled={!isDirty || saving}
          >
            <Save className="h-4 w-4 mr-2 inline" />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveSection('equity')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeSection === 'equity'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4 mr-2 inline" />
            Configuration de l'équité
          </button>
          <button
            onClick={() => setActiveSection('scores')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeSection === 'scores'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Award className="h-4 w-4 mr-2 inline" />
            Valeur des gardes
          </button>
        </nav>
      </div>

      {activeSection === 'equity' ? (
        <div>
          {/* Presets */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Modes de distribution prédéfinis</h3>
            <div className="grid grid-cols-3 gap-2">
              {EQUITY_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className="p-3 text-left border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <div className="font-medium text-sm">{preset.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Configuration d'équité */}
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">Principe d'équité</p>
                  <p>Le système garantit que tous les médecins qui se positionnent sur des gardes 
                  reçoivent équitablement des attributions en fonction de leurs demandes. 
                  L'objectif est que chacun atteigne le même taux de satisfaction.</p>
                </div>
              </div>
            </div>

            {/* Taux de satisfaction cible */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Taux de satisfaction cible
                  </label>
                  <p className="text-xs text-gray-500">
                    Pourcentage de demandes que chaque médecin devrait recevoir
                  </p>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round(config.equity.targetSatisfactionRate * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={config.equity.targetSatisfactionRate * 100}
                  onChange={(e) => updateEquityConfig({
                    targetSatisfactionRate: parseInt(e.target.value) / 100
                  })}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="10"
                  max="100"
                  step="5"
                  value={Math.round(config.equity.targetSatisfactionRate * 100)}
                  onChange={(e) => updateEquityConfig({
                    targetSatisfactionRate: parseInt(e.target.value) / 100
                  })}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md"
                />
              </div>
            </div>

            {/* Bonus petits demandeurs */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Bonus pour les petits demandeurs
                  </label>
                  <p className="text-xs text-gray-500">
                    Points bonus accordés à ceux qui demandent peu de gardes
                  </p>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {config.equity.smallDemandBonus} pts
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={config.equity.smallDemandBonus}
                  onChange={(e) => updateEquityConfig({
                    smallDemandBonus: parseInt(e.target.value)
                  })}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="10"
                  value={config.equity.smallDemandBonus}
                  onChange={(e) => updateEquityConfig({
                    smallDemandBonus: parseInt(e.target.value) || 0
                  })}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md"
                />
              </div>
            </div>

            {/* Mode de distribution */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Mode de distribution
              </label>
              <div className="space-y-2">
                <label className="flex items-start space-x-3">
                  <input
                    type="radio"
                    name="distributionMode"
                    value="equity"
                    checked={config.equity.distributionMode === 'equity'}
                    onChange={(e) => updateEquityConfig({
                      distributionMode: e.target.value as any
                    })}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">Équité pure</div>
                    <div className="text-xs text-gray-500">
                      Priorité absolue au déficit de satisfaction
                    </div>
                  </div>
                </label>
                <label className="flex items-start space-x-3">
                  <input
                    type="radio"
                    name="distributionMode"
                    value="priority"
                    checked={config.equity.distributionMode === 'priority'}
                    onChange={(e) => updateEquityConfig({
                      distributionMode: e.target.value as any
                    })}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">Priorité aux petits demandeurs</div>
                    <div className="text-xs text-gray-500">
                      Favorise ceux qui demandent peu de gardes
                    </div>
                  </div>
                </label>
                <label className="flex items-start space-x-3">
                  <input
                    type="radio"
                    name="distributionMode"
                    value="mixed"
                    checked={config.equity.distributionMode === 'mixed'}
                    onChange={(e) => updateEquityConfig({
                      distributionMode: e.target.value as any
                    })}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">Mode mixte</div>
                    <div className="text-xs text-gray-500">
                      Équilibre entre équité et priorité aux petits demandeurs
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* Tableau des scores de rentabilité */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Scores de rentabilité par type de garde</h3>
            <p className="text-xs text-gray-500 mb-4">
              Définissez un score de 0 (peu rentable) à 100 (très rentable) pour chaque type de garde.
            </p>
          </div>
          
          {/* Organisation en 3 colonnes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne Matin */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sun className="h-5 w-5 text-amber-500" />
                <h4 className="text-sm font-semibold text-gray-700">Matin</h4>
              </div>
              <div className="space-y-2">
                {(allShiftTypes ? Object.keys(allShiftTypes.M) : shiftTypes.filter(st => getShiftPeriod(st) === 'M'))
                  .sort((a, b) => a.localeCompare(b, 'fr'))
                  .map(shiftType => {
                    const score = config.shiftScores[shiftType]?.score || 50;
                    const metadata = allShiftTypes?.M[shiftType];
                    
                    return (
                      <div key={shiftType} className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <label className="text-sm font-medium text-gray-700 block">
                              {shiftType}
                            </label>
                            {metadata && (
                              <span className="text-xs text-gray-500">
                                {metadata.count} occurrences
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${
                              score >= 80 ? 'text-green-600' :
                              score >= 50 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {score}
                            </span>
                            <div className={`w-2 h-2 rounded-full ${
                              score >= 80 ? 'bg-green-500' :
                              score >= 50 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={score}
                            onChange={(e) => updateShiftScore(
                              shiftType,
                              parseInt(e.target.value) || 0
                            )}
                            className="flex-1 h-1"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="5"
                            value={score}
                            onChange={(e) => updateShiftScore(
                              shiftType,
                              parseInt(e.target.value) || 0
                            )}
                            className="w-12 px-1 py-0.5 text-xs text-center border border-gray-300 rounded"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            
            {/* Colonne Après-midi */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sunset className="h-5 w-5 text-blue-500" />
                <h4 className="text-sm font-semibold text-gray-700">Après-midi</h4>
              </div>
              <div className="space-y-2">
                {(allShiftTypes ? Object.keys(allShiftTypes.AM) : shiftTypes.filter(st => getShiftPeriod(st) === 'AM'))
                  .sort((a, b) => a.localeCompare(b, 'fr'))
                  .map(shiftType => {
                    const score = config.shiftScores[shiftType]?.score || 50;
                    const metadata = allShiftTypes?.AM[shiftType];
                    
                    return (
                      <div key={shiftType} className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <label className="text-sm font-medium text-gray-700 block">
                              {shiftType}
                            </label>
                            {metadata && (
                              <span className="text-xs text-gray-500">
                                {metadata.count} occurrences
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${
                              score >= 80 ? 'text-green-600' :
                              score >= 50 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {score}
                            </span>
                            <div className={`w-2 h-2 rounded-full ${
                              score >= 80 ? 'bg-green-500' :
                              score >= 50 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={score}
                            onChange={(e) => updateShiftScore(
                              shiftType,
                              parseInt(e.target.value) || 0
                            )}
                            className="flex-1 h-1"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="5"
                            value={score}
                            onChange={(e) => updateShiftScore(
                              shiftType,
                              parseInt(e.target.value) || 0
                            )}
                            className="w-12 px-1 py-0.5 text-xs text-center border border-gray-300 rounded"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            
            {/* Colonne Soir */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Moon className="h-5 w-5 text-purple-500" />
                <h4 className="text-sm font-semibold text-gray-700">Soir</h4>
              </div>
              <div className="space-y-2">
                {(allShiftTypes ? Object.keys(allShiftTypes.S) : shiftTypes.filter(st => getShiftPeriod(st) === 'S'))
                  .sort((a, b) => a.localeCompare(b, 'fr'))
                  .map(shiftType => {
                    const score = config.shiftScores[shiftType]?.score || 50;
                    const metadata = allShiftTypes?.S[shiftType];
                    
                    return (
                      <div key={shiftType} className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <label className="text-sm font-medium text-gray-700 block">
                              {shiftType}
                            </label>
                            {metadata && (
                              <span className="text-xs text-gray-500">
                                {metadata.count} occurrences
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${
                              score >= 80 ? 'text-green-600' :
                              score >= 50 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {score}
                            </span>
                            <div className={`w-2 h-2 rounded-full ${
                              score >= 80 ? 'bg-green-500' :
                              score >= 50 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={score}
                            onChange={(e) => updateShiftScore(
                              shiftType,
                              parseInt(e.target.value) || 0
                            )}
                            className="flex-1 h-1"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="5"
                            value={score}
                            onChange={(e) => updateShiftScore(
                              shiftType,
                              parseInt(e.target.value) || 0
                            )}
                            className="w-12 px-1 py-0.5 text-xs text-center border border-gray-300 rounded"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
          
          {/* Types de gardes sans période identifiée */}
          {(() => {
            const unknownShifts = allShiftTypes 
              ? [] 
              : shiftTypes.filter(st => !getShiftPeriod(st));
            
            return unknownShifts.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Autres types de gardes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {unknownShifts.map(shiftType => {
                    const score = config.shiftScores[shiftType]?.score || 50;
                    
                    return (
                      <div key={shiftType} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">
                            {shiftType}
                          </label>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${
                              score >= 80 ? 'text-green-600' :
                              score >= 50 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {score}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={score}
                            onChange={(e) => updateShiftScore(
                              shiftType,
                              parseInt(e.target.value) || 0
                            )}
                            className="flex-1 h-1"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="5"
                            value={score}
                            onChange={(e) => updateShiftScore(
                              shiftType,
                              parseInt(e.target.value) || 0
                            )}
                            className="w-12 px-1 py-0.5 text-xs text-center border border-gray-300 rounded"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">Comment utiliser les scores ?</p>
                <p>Les scores de rentabilité permettent de valoriser différemment les types de gardes. 
                Un score élevé indique une garde plus "précieuse" qui sera prise en compte dans le calcul 
                d'équité pour une répartition juste de la charge de travail.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreConfigPanel;