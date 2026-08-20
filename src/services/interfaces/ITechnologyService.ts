export interface ITechnologyService {
  getAllTechnologies(query: any): Promise<{ technologies: any[]; pagination: any }>;
  getTechnologyById(id: string): Promise<any>;
  createTechnology(data: any): Promise<any>;
  updateTechnology(id: string, data: any): Promise<any>;
  deleteTechnology(id: string): Promise<any>;
}
