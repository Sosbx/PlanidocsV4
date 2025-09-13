import React, { useState, useEffect } from 'react';
import { useFeatureFlags } from '../context/featureFlags/FeatureFlagsContext';
import { useAssociation } from '../context/association/AssociationContext';
import { useSuperAdmin } from '../context/superAdmin/SuperAdminContext';
import { FeatureFlag, FeatureKey, FeatureFlagUpdate, FeatureStatus, FEATURE_TEMPLATES, FEATURES } from '../types/featureFlags';
import { ASSOCIATIONS, ASSOCIATION_NAMES } from '../constants/associations';
import { LoadingSpinner } from '../components/common';
import { CheckCircle, XCircle, Beaker, Settings, Users, AlertCircle, Eye, Info, Clock, User, Plus, Lock, RefreshCw } from 'lucide-react';
import { featureFlagsService } from '../lib/firebase/featureFlags';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';

const SuperAdminPage: React.FC = () => {
  const { featureFlags, loading, updateFeatureFlag, hasUnauthorizedChanges, getFeatureDiagnostics } = useFeatureFlags();
  const { currentAssociation, setCurrentAssociation } = useAssociation();
  const { isSuperAdminMode, toggleSuperAdminMode, canAccessSuperAdmin } = useSuperAdmin();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [updating, setUpdating] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState<string | null>(null);
  const [missingFeatures, setMissingFeatures] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingFeature, setCreatingFeature] = useState(false);

  if (!canAccessSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600">Accès refusé</h1>
          <p className="mt-2 text-gray-600">Cette page est réservée au super administrateur.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const loadMissingFeatures = async () => {
      const missing = await featureFlagsService.getMissingFeatures();
      setMissingFeatures(missing);
    };
    loadMissingFeatures();
  }, [featureFlags]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const handleStatusChange = async (featureId: string, associationId: 'RD' | 'RG', newStatus: FeatureStatus) => {
    setUpdating(`${featureId}-${associationId}`);
    try {
      await updateFeatureFlag({
        featureId,
        association: associationId,
        status: newStatus
      });
    } catch (error) {
      console.error('Error updating feature flag:', error);
      alert('Erreur lors de la mise à jour');
    } finally {
      setUpdating(null);
    }
  };


  const getStatusIcon = (status: FeatureStatus) => {
    switch (status) {
      case 'enabled':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'dev':
        return <Beaker className="w-5 h-5 text-orange-600" />;
      case 'disabled':
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusColor = (status: FeatureStatus) => {
    switch (status) {
      case 'enabled':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'dev':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'disabled':
        return 'bg-red-100 text-red-800 border-red-300';
    }
  };

  const createFeature = async (featureKey: string) => {
    setCreatingFeature(true);
    try {
      await featureFlagsService.createFeatureFlag(featureKey as FeatureKey, user?.email || 'unknown');
      alert(`Feature ${featureKey} créée avec succès!`);
      setShowCreateModal(false);
      window.location.reload();
    } catch (error) {
      alert(`Erreur lors de la création: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setCreatingFeature(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Settings className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Super Admin - Gestion des accès</h1>
            </div>
            <div className="flex items-center space-x-4">
              {missingFeatures.length > 0 && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  title="Créer un nouveau feature flag"
                >
                  <Plus className="w-4 h-4" />
                  <span>Créer Feature</span>
                </button>
              )}
              
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                Association active: {currentAssociation}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {/* Mode Super Admin / Incognito */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {isSuperAdminMode ? <Lock className="w-5 h-5 text-purple-600" /> : <Eye className="w-5 h-5 text-purple-600" />}
                  <span className="font-semibold">Mode</span>
                </div>
              </div>
              <button
                onClick={toggleSuperAdminMode}
                className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isSuperAdminMode
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-orange-600 text-white hover:bg-orange-700'
                }`}
              >
                {isSuperAdminMode ? (
                  <>
                    <Lock className="w-4 h-4 inline mr-2" />
                    Mode Super Admin
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 inline mr-2" />
                    Mode Incognito
                  </>
                )}
              </button>
              <p className="text-xs text-gray-600 mt-2">
                {isSuperAdminMode 
                  ? "Accès à toutes les fonctionnalités" 
                  : "Navigation comme un utilisateur normal"}
              </p>
            </div>
            
            {/* Sélection d'association (Mode Incognito uniquement) */}
            <div className={`bg-blue-50 p-4 rounded-lg ${!isSuperAdminMode ? '' : 'opacity-50'}` }>
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="font-semibold">Association (Mode Incognito)</span>
              </div>
              <div className="flex space-x-2">
                {Object.entries(ASSOCIATIONS).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => !isSuperAdminMode && setCurrentAssociation(value as 'RD' | 'RG')}
                    disabled={isSuperAdminMode}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentAssociation === value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-600 hover:bg-blue-100'
                    } ${isSuperAdminMode ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Association active: {ASSOCIATION_NAMES[currentAssociation] || currentAssociation}
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Settings className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Navigation</span>
              </div>
              {!isSuperAdminMode && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Aller au Dashboard
                </button>
              )}
              <p className="text-xs text-gray-600 mt-2">
                Connecté en tant que: arkane.hilal@h24scm.com
              </p>
            </div>
          </div>
        </div>

        {/* Alerte changements non autorisés */}
        {hasUnauthorizedChanges && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <div>
                <p className="text-sm text-orange-800 font-medium">
                  Des modifications ont été détectées depuis un autre appareil ou navigateur.
                </p>
                <p className="text-sm text-orange-700 mt-1">
                  Rafraîchissez la page pour voir les derniers changements.
                </p>
              </div>
            </div>
          </div>
        )}


        {/* Feature Flags Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Configuration des fonctionnalités</h2>
            <p className="text-sm text-gray-600 mt-1">Gérez l'accès aux fonctionnalités par association</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fonctionnalité
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RD - Rive Droite
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RG - Rive Gauche
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rôles requis
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Diagnostics
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {featureFlags
                  .sort((a, b) => {
                    // Définir l'ordre souhaité
                    const order = [
                      'desiderata',
                      'planning', 
                      'shiftExchange',
                      'directExchange',
                      'directExchangeModal',
                      'adminDesiderata',
                      'adminShiftExchange',
                      'generatedPlanning',
                      'userManagement',
                      'replacements',
                      'history'
                    ];
                    return order.indexOf(a.id) - order.indexOf(b.id);
                  })
                  .map((feature) => (
                  <tr key={feature.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {feature.name}
                        </div>
                        <div className="text-sm text-gray-500">{feature.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-600">{feature.route}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {['enabled', 'dev', 'disabled'].map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(feature.id, 'RD', status as FeatureStatus)}
                            disabled={updating === `${feature.id}-RD`}
                            className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                              feature.status.RD === status
                                ? getStatusColor(status as FeatureStatus)
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            } ${updating === `${feature.id}-RD` ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            {updating === `${feature.id}-RD` && feature.status.RD === status ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <div className="flex items-center space-x-1">
                                {getStatusIcon(status as FeatureStatus)}
                                <span>{status === 'dev' ? 'Dev' : status === 'enabled' ? 'Activé' : 'Désactivé'}</span>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {['enabled', 'dev', 'disabled'].map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(feature.id, 'RG', status as FeatureStatus)}
                            disabled={updating === `${feature.id}-RG`}
                            className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                              feature.status.RG === status
                                ? getStatusColor(status as FeatureStatus)
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            } ${updating === `${feature.id}-RG` ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            {updating === `${feature.id}-RG` && feature.status.RG === status ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <div className="flex items-center space-x-1">
                                {getStatusIcon(status as FeatureStatus)}
                                <span>{status === 'dev' ? 'Dev' : status === 'enabled' ? 'Activé' : 'Désactivé'}</span>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {feature.requiredRoles?.map((role) => (
                          <span key={role} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">
                            {role}
                          </span>
                        )) || <span className="text-sm text-gray-500">Tous</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => setShowDiagnostics(showDiagnostics === feature.id ? null : feature.id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Voir les diagnostics"
                      >
                        <Info className="w-4 h-4 text-gray-600" />
                      </button>
                    </td>
                  </tr>
                ))}
                {featureFlags.map((feature) => 
                  showDiagnostics === feature.id && (
                    <tr key={`${feature.id}-diagnostics`}>
                      <td colSpan={6} className="px-6 py-4 bg-gray-50">
                        <DiagnosticsPanel feature={feature} getFeatureDiagnostics={getFeatureDiagnostics} />
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Légende des statuts</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <span className="font-medium">Activé</span>
                <p className="text-sm text-gray-600">La fonctionnalité est accessible normalement</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Beaker className="w-6 h-6 text-orange-600" />
              <div>
                <span className="font-medium">En développement</span>
                <p className="text-sm text-gray-600">Visible avec badge "(Dev)", accès limité</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <XCircle className="w-6 h-6 text-red-600" />
              <div>
                <span className="font-medium">Désactivé</span>
                <p className="text-sm text-gray-600">Complètement invisible et inaccessible</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal pour créer une nouvelle feature */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Créer un nouveau Feature Flag</h3>
              
              {missingFeatures.length === 0 ? (
                <p className="text-gray-600 mb-4">Toutes les features sont déjà créées.</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Sélectionnez une feature à créer. Elle sera créée avec les valeurs du template.
                  </p>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {missingFeatures.map((featureKey) => {
                      const template = FEATURE_TEMPLATES[featureKey as keyof typeof FEATURE_TEMPLATES];
                      return (
                        <button
                          key={featureKey}
                          onClick={() => createFeature(featureKey)}
                          disabled={creatingFeature}
                          className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          <div className="font-medium">{template?.name || featureKey}</div>
                          <div className="text-sm text-gray-600">{template?.description || 'Pas de description'}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DiagnosticsPanel: React.FC<{
  feature: FeatureFlag;
  getFeatureDiagnostics: (featureKey: string) => {
    updatedBy: string;
    lastUpdated: Date;
  } | null;
}> = ({ feature, getFeatureDiagnostics }) => {
  const diagnostics = getFeatureDiagnostics(feature.id);
  
  if (!diagnostics) return null;
  
  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
        <Info className="w-4 h-4" />
        Informations de diagnostic pour {feature.name}
      </h4>
      
      <div className="bg-white p-3 rounded-lg border border-gray-200">
        <h5 className="text-xs font-medium text-gray-600 mb-2">Dernière modification</h5>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <User className="w-3 h-3 text-gray-500" />
            <span className="text-gray-700">{diagnostics.updatedBy}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-gray-700">
              {new Date(diagnostics.lastUpdated).toLocaleString('fr-FR')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPage;