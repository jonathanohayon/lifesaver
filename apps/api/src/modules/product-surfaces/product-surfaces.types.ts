export type ProductSurfaceKey = 'public_site' | 'customer_app' | 'internal_admin' | 'backend_api' | 'worker';

export interface ProductSurfaceDefinition {
  key: ProductSurfaceKey;
  name: string;
  localUrl: string;
  productionUrl: string;
  purpose: string;
  audience: string;
  allowedAccess: string[];
  explicitlyForbidden: string[];
  ownsSecrets: boolean;
  notes: string[];
}

export interface SecretOwnershipRule {
  secret: string;
  owner: string;
  storage: string;
  managedBy: string;
  browserVisibility: string;
}

export interface ProductSurfaceModel {
  version: string;
  mode: string;
  configuredUrls: {
    publicSiteUrl: string;
    appUrl: string;
    adminUrl: string;
    apiUrl: string;
  };
  surfaces: ProductSurfaceDefinition[];
  secretOwnership: SecretOwnershipRule[];
  v1SafetyRules: string[];
  nextImplementationNotes: string[];
}
