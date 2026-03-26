import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';
export const REQUIRED_ROLES_KEY = 'required_roles';

export const RequirePermissions = (...permissions: bigint[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

export const RequireRoles = (...roles: string[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);
