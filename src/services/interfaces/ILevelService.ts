export interface ILevelService {
  getAllLevels(query: any): Promise<{ levels: any[]; pagination: any }>;
  getLevelById(id: string): Promise<any>;
  createLevel(data: any, actorId: string, requestId: string): Promise<any>;
  updateLevel(id: string, data: any, actorId: string, requestId: string): Promise<any>;
  deleteLevel(id: string, actorId: string, requestId: string): Promise<any>;
}
