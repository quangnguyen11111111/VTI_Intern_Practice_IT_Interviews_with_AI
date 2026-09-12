export interface ITechnologyService {
  getAllTechnologies(query: any): Promise<{ technologies: any[]; pagination: any }>;
  getTechnologyById(id: string): Promise<any>;
  createTechnology(data: any, actorId: string, requestId: string): Promise<any>;
  updateTechnology(id: string, data: any, actorId: string, requestId: string): Promise<any>;
  deleteTechnology(id: string, actorId: string, requestId: string): Promise<any>;
}
