import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User, { IUser } from '../../src/models/user.model';
import RefreshToken from '../../src/models/refresh-token.model';
import Role, { IRole } from '../../src/models/role.model';
import Level, { ILevel } from '../../src/models/level.model';
import Technology, { ITechnology } from '../../src/models/technology.model';
import { InterviewSessionModel, IInterviewSessionDocument } from '../../src/models/InterviewSession';
import {
  generateAuthTokens,
  getRefreshTokenExpiry,
  hashToken,
  verifyRefreshToken,
} from '../../src/utils/token';
import { InterviewStatus } from '../../src/domain/interview/IInterviewState';

let fixtureSequence = 0;

const nextFixtureKey = (prefix: string): string => {
  fixtureSequence += 1;
  return `${prefix}-${process.pid}-${fixtureSequence}`;
};

export interface UserFixture {
  user: IUser;
  password: string;
  accessToken: string;
  refreshToken: string;
}

export const createUserFixture = async (overrides: Partial<{
  email: string;
  password: string;
  fullName: string;
  role: 'CANDIDATE' | 'INTERVIEWER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
}> = {}): Promise<UserFixture> => {
  const key = nextFixtureKey('user');
  const password = overrides.password ?? 'Aip55StrongPassword123';
  const user = await User.create({
    email: overrides.email ?? `${key}@example.test`,
    passwordHash: await bcrypt.hash(password, 10),
    fullName: overrides.fullName ?? `AIP-55 ${key}`,
    role: overrides.role ?? 'CANDIDATE',
    status: overrides.status ?? 'ACTIVE',
    authVersion: 0,
    credentialVersion: 0,
  });
  const tokens = generateAuthTokens(user._id.toString(), user.role, undefined, undefined, 0);

  return {
    user,
    password,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};

export const persistRefreshSession = async (fixture: UserFixture) => {
  const payload = fixture.refreshToken;
  const identity = verifyRefreshToken(payload);

  return RefreshToken.create({
    userId: fixture.user._id,
    sessionId: identity.sessionId,
    jti: identity.jti,
    tokenHash: hashToken(payload),
    isRevoked: false,
    expiresAt: getRefreshTokenExpiry(payload),
  });
};

export interface TaxonomyFixture {
  role: IRole;
  inactiveRole: IRole;
  otherRole: IRole;
  level: ILevel;
  inactiveLevel: ILevel;
  technology: ITechnology;
  inactiveTechnology: ITechnology;
  otherRoleTechnology: ITechnology;
}

export const createTaxonomyFixture = async (): Promise<TaxonomyFixture> => {
  const key = nextFixtureKey('taxonomy').replace(/-/g, '_').toUpperCase();
  const [role, inactiveRole, otherRole, level, inactiveLevel] = await Promise.all([
    Role.create({ code: `${key}_ROLE`, name: `${key} Role`, status: 'ACTIVE' }),
    Role.create({ code: `${key}_INACTIVE_ROLE`, name: `${key} Inactive Role`, status: 'INACTIVE' }),
    Role.create({ code: `${key}_OTHER_ROLE`, name: `${key} Other Role`, status: 'ACTIVE' }),
    Level.create({ code: `${key}_LEVEL`, name: `${key} Level`, status: 'ACTIVE' }),
    Level.create({ code: `${key}_INACTIVE_LEVEL`, name: `${key} Inactive Level`, status: 'INACTIVE' }),
  ]);

  const [technology, inactiveTechnology, otherRoleTechnology] = await Promise.all([
    Technology.create({
      code: `${key}_TECH`,
      name: `${key} Technology`,
      status: 'ACTIVE',
      roles: [role._id],
    }),
    Technology.create({
      code: `${key}_INACTIVE_TECH`,
      name: `${key} Inactive Technology`,
      status: 'INACTIVE',
      roles: [role._id],
    }),
    Technology.create({
      code: `${key}_OTHER_TECH`,
      name: `${key} Other Technology`,
      status: 'ACTIVE',
      roles: [otherRole._id],
    }),
  ]);

  return {
    role,
    inactiveRole,
    otherRole,
    level,
    inactiveLevel,
    technology,
    inactiveTechnology,
    otherRoleTechnology,
  };
};

export const createInterviewSessionFixture = async (options: {
  ownerId?: mongoose.Types.ObjectId | string;
  status?: InterviewStatus;
  version?: number;
  setupData?: Record<string, unknown>;
} = {}): Promise<IInterviewSessionDocument> => {
  return InterviewSessionModel.create({
    userId: (options.ownerId ?? new mongoose.Types.ObjectId()).toString(),
    status: options.status ?? 'PENDING',
    version: options.version ?? 0,
    setupData: options.setupData ?? {},
  });
};
