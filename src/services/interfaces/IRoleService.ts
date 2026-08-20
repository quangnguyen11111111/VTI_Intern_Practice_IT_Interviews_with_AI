export interface IRoleService {
  getAllRoles(query: any): Promise<{ roles: any[]; pagination: any }>;
  getRoleById(id: string): Promise<any>;
  createRole(data: any): Promise<any>;
  updateRole(id: string, data: any): Promise<any>;
  deleteRole(id: string): Promise<any>;
}
