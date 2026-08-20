import { injectable } from 'tsyringe';
import Technology, { ITechnology } from '../models/technology.model';
import { BaseRepository } from './base.repository';
import { ITechnologyRepository } from './interfaces/ITechnologyRepository';

@injectable()
export class TechnologyRepository extends BaseRepository<ITechnology> implements ITechnologyRepository {
  constructor() {
    super(Technology);
  }
}
