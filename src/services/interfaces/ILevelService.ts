export interface ILevelService {
  getAllLevels(query: any): Promise<{ levels: any[]; pagination: any }>;
  getLevelById(id: string): Promise<any>;
  createLevel(data: any): Promise<any>;
  updateLevel(id: string, data: any): Promise<any>;
  deleteLevel(id: string): Promise<any>;
}
