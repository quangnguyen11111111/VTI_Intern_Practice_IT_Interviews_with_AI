import { container } from 'tsyringe';

// Repositories
import { RoleRepository } from '../repositories/role.repository';
import { LevelRepository } from '../repositories/level.repository';
import { TechnologyRepository } from '../repositories/technology.repository';

// Services
import { RoleService } from '../services/role.service';
import { LevelService } from '../services/level.service';
import { TechnologyService } from '../services/technology.service';

// Register Repositories
container.register('IRoleRepository', { useClass: RoleRepository });
container.register('ILevelRepository', { useClass: LevelRepository });
container.register('ITechnologyRepository', { useClass: TechnologyRepository });

// Register Services
container.register('IRoleService', { useClass: RoleService });
container.register('ILevelService', { useClass: LevelService });
container.register('ITechnologyService', { useClass: TechnologyService });

export { container };
