import { injectable } from 'tsyringe';
import Level, { ILevel } from '../models/level.model';
import { BaseRepository } from './base.repository';
import { ILevelRepository } from './interfaces/ILevelRepository';

@injectable()
export class LevelRepository extends BaseRepository<ILevel> implements ILevelRepository {
  constructor() {
    super(Level);
  }
}
