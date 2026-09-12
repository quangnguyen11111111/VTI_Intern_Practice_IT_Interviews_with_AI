export interface IRoleService {
  getAllRoles(query: any): Promise<{ roles: any[]; pagination: any }>;
  getRoleById(id: string): Promise<any>;
  createRole(data: any, actorId: string, requestId: string): Promise<any>;
  updateRole(id: string, data: any, actorId: string, requestId: string): Promise<any>;
  deleteRole(id: string, actorId: string, requestId: string): Promise<any>;
}
