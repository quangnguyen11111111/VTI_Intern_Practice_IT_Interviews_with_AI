import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET =
    'test_jwt_access_secret_key_at_least_32_characters_long_12345';
  process.env.JWT_REFRESH_SECRET =
    'test_jwt_refresh_secret_key_at_leAST_32_characters_long_67890';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
});

import app from '../src/app';
import User from '../src/models/user.model';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import Technology from '../src/models/technology.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { generateAuthTokens } from '../src/utils/token';

let mongo: MongoMemoryServer;

type InterviewFixtures = {
  backendRole: mongoose.Types.ObjectId;
  frontendRole: mongoose.Types.ObjectId;
  juniorLevel: mongoose.Types.ObjectId;
  seniorLevel: mongoose.Types.ObjectId;
  nodeTechnology: mongoose.Types.ObjectId;
  mongoTechnology: mongoose.Types.ObjectId;
  reactTechnology: mongoose.Types.ObjectId;
};

let fixtures: InterviewFixtures;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await InterviewQuestionModel.deleteMany({});
  await InterviewSessionModel.deleteMany({});
  await Technology.deleteMany({});
  await Level.deleteMany({});
  await Role.deleteMany({});
  await User.deleteMany({});

  const [backendRole, frontendRole] = await Role.create([
    {
      code: 'BACKEND_DEV',
      name: 'Backend Developer',
      status: 'ACTIVE'
    },
    {
      code: 'FRONTEND_DEV',
      name: 'Frontend Developer',
      status: 'ACTIVE'
    }
  ]);

  const [juniorLevel, seniorLevel] = await Level.create([
    {
      code: 'JUNIOR',
      name: 'Junior',
      status: 'ACTIVE'
    },
    {
      code: 'SENIOR',
      name: 'Senior',
      status: 'ACTIVE'
    }
  ]);

  const [nodeTechnology, mongoTechnology, reactTechnology] =
    await Technology.create([
      {
        code: 'NODEJS',
        name: 'Node.js',
        roles: [backendRole._id as mongoose.Types.ObjectId],
        status: 'ACTIVE'
      },
      {
        code: 'MONGODB',
        name: 'MongoDB',
        roles: [backendRole._id as mongoose.Types.ObjectId],
        status: 'ACTIVE'
      },
      {
        code: 'REACT',
        name: 'React',
        roles: [frontendRole._id as mongoose.Types.ObjectId],
        status: 'ACTIVE'
      }
    ]);

  fixtures = {
    backendRole: backendRole._id as mongoose.Types.ObjectId,
    frontendRole: frontendRole._id as mongoose.Types.ObjectId,
    juniorLevel: juniorLevel._id as mongoose.Types.ObjectId,
    seniorLevel: seniorLevel._id as mongoose.Types.ObjectId,
    nodeTechnology: nodeTechnology._id as mongoose.Types.ObjectId,
    mongoTechnology: mongoTechnology._id as mongoose.Types.ObjectId,
    reactTechnology: reactTechnology._id as mongoose.Types.ObjectId
  };
});

const createUser = async (email: string) => {
  const user = await User.create({
    email,
    passwordHash: 'not-used-by-history-tests',
    fullName: 'History Candidate',
    role: 'CANDIDATE',
    status: 'ACTIVE'
  });

  const { accessToken } = generateAuthTokens(
    user._id.toString(),
    user.role
  );

  return {
    user,
    authorization: `Bearer ${accessToken}`
  };
};

const createSession = async (
  userId: string,
  data: {
    role: mongoose.Types.ObjectId;
    level: mongoose.Types.ObjectId;
    technologies: mongoose.Types.ObjectId[];
    status:
      | 'PENDING'
      | 'GENERATING'
      | 'IN_PROGRESS'
      | 'EVALUATING'
      | 'COMPLETED'
      | 'FAILED';
    score: number | null;
    createdAt: string;
    updatedAt?: string;
  }
) => {
  return InterviewSessionModel.create({
    userId,
    status: data.status,
    setupData: {
      jobPosition: data.role.toString(),
      level: data.level.toString(),
      techStacks: data.technologies.map((technology) =>
        technology.toString()
      )
    },
    overallScore: data.score,
    dimensions: [
      {
        name: 'Communication',
        score: 9,
        reasoning: 'must not be returned'
      }
    ],
    learningPath: [
      {
        topic: { en: 'Node.js', vi: 'Node.js' },
        priority: 'High',
        suggestion: {
          en: 'must not be returned',
          vi: 'không được trả về'
        }
      }
    ],
    promptVersions: {
      evaluation: {
        promptId: 'secret-prompt',
        version: 1,
        language: 'EN'
      }
    },
    metadata: {
      promptTokens: 10,
      candidatesTokens: 20,
      totalTokens: 30
    },
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt ?? data.createdAt)
  });
};

describe('HIS-01 interview history API', () => {
  it('requires authentication', async () => {
    const response = await request(app)
      .get('/api/v1/interviews/history');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('isolates history by authenticated ownership and rejects userId override', async () => {
    const owner = await createUser('owner-history@example.com');
    const other = await createUser('other-history@example.com');

    const ownerSession = await createSession(owner.user._id.toString(), {
      role: fixtures.backendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 8.5,
      createdAt: '2026-08-10T10:00:00.000Z'
    });

    await createSession(other.user._id.toString(), {
      role: fixtures.frontendRole._id,
      level: fixtures.seniorLevel._id,
      technologies: [fixtures.reactTechnology._id],
      status: 'COMPLETED',
      score: 9.5,
      createdAt: '2026-08-11T10:00:00.000Z'
    });

    const response = await request(app)
      .get(`/api/v1/interviews/history?userId=${other.user._id}`)
      .set('Authorization', owner.authorization);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');

    const cleanResponse = await request(app)
      .get('/api/v1/interviews/history')
      .set('Authorization', owner.authorization);

    expect(cleanResponse.status).toBe(200);
    expect(cleanResponse.body.data.items).toHaveLength(1);
    expect(cleanResponse.body.data.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1
    });
    expect(cleanResponse.body.data.items[0]).toMatchObject({
      sessionId: ownerSession._id.toString(),
      role: fixtures.backendRole._id.toString(),
      level: fixtures.juniorLevel._id.toString(),
      technologies: [fixtures.nodeTechnology._id.toString()]
    });
  });

  it('filters by role, level, technology and status using production identifiers', async () => {
    const { user, authorization } = await createUser(
      'filter-history@example.com'
    );
    const userId = user._id.toString();

    await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [
        fixtures.nodeTechnology._id,
        fixtures.mongoTechnology._id
      ],
      status: 'COMPLETED',
      score: 8,
      createdAt: '2026-08-10T10:00:00.000Z'
    });

    await createSession(userId, {
      role: fixtures.frontendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [fixtures.reactTechnology._id],
      status: 'FAILED',
      score: null,
      createdAt: '2026-08-11T10:00:00.000Z'
    });

    await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.seniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 9,
      createdAt: '2026-08-12T10:00:00.000Z'
    });

    const response = await request(app)
      .get('/api/v1/interviews/history')
      .query({
        role: fixtures.backendRole._id.toString(),
        level: fixtures.juniorLevel._id.toString(),
        technology: fixtures.mongoTechnology._id.toString(),
        status: 'COMPLETED'
      })
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.body.data.pagination.total).toBe(1);
    expect(response.body.data.items[0]).toMatchObject({
      role: fixtures.backendRole._id.toString(),
      level: fixtures.juniorLevel._id.toString(),
      technologies: [
        fixtures.nodeTechnology._id.toString(),
        fixtures.mongoTechnology._id.toString()
      ],
      score: 8,
      status: 'COMPLETED'
    });
  });

  it('supports each individual filter and combined filters', async () => {
    const { user, authorization } = await createUser(
      'individual-filter-history@example.com'
    );
    const userId = user._id.toString();

    const backendJunior = await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [
        fixtures.nodeTechnology._id,
        fixtures.mongoTechnology._id
      ],
      status: 'COMPLETED',
      score: 8,
      createdAt: '2026-08-10T10:00:00.000Z'
    });

    await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.seniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'FAILED',
      score: null,
      createdAt: '2026-08-11T10:00:00.000Z'
    });

    await createSession(userId, {
      role: fixtures.frontendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [fixtures.reactTechnology._id],
      status: 'COMPLETED',
      score: 9,
      createdAt: '2026-08-12T10:00:00.000Z'
    });

    const cases = [
      ['role', fixtures.backendRole._id.toString()],
      ['level', fixtures.juniorLevel._id.toString()],
      ['technology', fixtures.mongoTechnology._id.toString()],
      ['status', 'FAILED']
    ] as const;

    for (const [field, value] of cases) {
      const response = await request(app)
        .get('/api/v1/interviews/history')
        .query({ [field]: value })
        .set('Authorization', authorization);

      expect(response.status, field).toBe(200);
      expect(response.body.data.pagination.total, field).toBe(
        field === 'role' ? 2 : field === 'level' ? 2 : 1
      );
    }

    const combined = await request(app)
      .get('/api/v1/interviews/history')
      .query({
        role: fixtures.backendRole._id.toString(),
        level: fixtures.juniorLevel._id.toString(),
        technology: fixtures.mongoTechnology._id.toString(),
        status: 'COMPLETED'
      })
      .set('Authorization', authorization);

    expect(combined.status).toBe(200);
    expect(combined.body.data.items).toHaveLength(1);
    expect(combined.body.data.items[0].sessionId).toBe(
      backendJunior._id.toString()
    );
  });

  it('supports deterministic newest-first and oldest-first sorting', async () => {
    const { user, authorization } = await createUser(
      'sort-history@example.com'
    );
    const userId = user._id.toString();

    const first = await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 8,
      createdAt: '2026-08-10T10:00:00.000Z'
    });

    const second = await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 8.1,
      createdAt: '2026-08-12T10:00:00.000Z'
    });

    const third = await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 8.2,
      createdAt: '2026-08-11T10:00:00.000Z'
    });

    const newest = await request(app)
      .get('/api/v1/interviews/history')
      .set('Authorization', authorization);

    expect(newest.status).toBe(200);
    expect(
      newest.body.data.items.map((item: any) => item.sessionId)
    ).toEqual([
      second._id.toString(),
      third._id.toString(),
      first._id.toString()
    ]);

    const oldest = await request(app)
      .get('/api/v1/interviews/history?sort=oldest')
      .set('Authorization', authorization);

    expect(oldest.status).toBe(200);
    expect(
      oldest.body.data.items.map((item: any) => item.sessionId)
    ).toEqual([
      first._id.toString(),
      third._id.toString(),
      second._id.toString()
    ]);
  });

  it('uses _id as a deterministic tie-breaker when createdAt is equal', async () => {
    const { user, authorization } = await createUser(
      'tie-history@example.com'
    );
    const userId = user._id.toString();
    const createdAt = '2026-08-10T10:00:00.000Z';

    const sessions = await Promise.all([
      createSession(userId, {
        role: fixtures.backendRole._id,
        level: fixtures.juniorLevel._id,
        technologies: [fixtures.nodeTechnology._id],
        status: 'COMPLETED',
        score: 8,
        createdAt
      }),
      createSession(userId, {
        role: fixtures.backendRole._id,
        level: fixtures.juniorLevel._id,
        technologies: [fixtures.nodeTechnology._id],
        status: 'COMPLETED',
        score: 8.1,
        createdAt
      }),
      createSession(userId, {
        role: fixtures.backendRole._id,
        level: fixtures.juniorLevel._id,
        technologies: [fixtures.nodeTechnology._id],
        status: 'COMPLETED',
        score: 8.2,
        createdAt
      })
    ]);

    const newest = await request(app)
      .get('/api/v1/interviews/history?limit=3')
      .set('Authorization', authorization);

    const expectedNewest = [...sessions]
      .sort((a, b) =>
        b._id.toString().localeCompare(a._id.toString())
      )
      .map((session) => session._id.toString());

    expect(newest.status).toBe(200);
    expect(
      newest.body.data.items.map((item: any) => item.sessionId)
    ).toEqual(expectedNewest);
  });

  it('supports date-only [from, to) boundaries in UTC', async () => {
    const { user, authorization } = await createUser(
      'date-history@example.com'
    );
    const userId = user._id.toString();

    await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 8,
      createdAt: '2026-08-01T00:00:00.000Z'
    });

    const middle = await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 8.1,
      createdAt: '2026-08-15T12:00:00.000Z'
    });

    const endBoundary = await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 8.2,
      createdAt: '2026-09-01T00:00:00.000Z'
    });

    const response = await request(app)
      .get('/api/v1/interviews/history')
      .query({
        from: '2026-08-01',
        to: '2026-09-01'
      })
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.body.data.pagination.total).toBe(2);
    expect(
      response.body.data.items.map((item: any) => item.sessionId)
    ).toContain(middle._id.toString());
    expect(
      response.body.data.items.map((item: any) => item.sessionId)
    ).not.toContain(endBoundary._id.toString());
  });

  it('supports from-only, to-only and rejects an invalid date range', async () => {
    const { user, authorization } = await createUser(
      'date-boundary-history@example.com'
    );
    const userId = user._id.toString();

    await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 8,
      createdAt: '2026-08-01T00:00:00.000Z'
    });

    await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 8.1,
      createdAt: '2026-08-15T00:00:00.000Z'
    });

    await createSession(userId, {
      role: fixtures.backendRole._id,
      level: fixtures.juniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 8.2,
      createdAt: '2026-09-01T00:00:00.000Z'
    });

    const fromOnly = await request(app)
      .get('/api/v1/interviews/history?from=2026-08-15')
      .set('Authorization', authorization);

    expect(fromOnly.status).toBe(200);
    expect(fromOnly.body.data.pagination.total).toBe(2);

    const toOnly = await request(app)
      .get('/api/v1/interviews/history?to=2026-08-15')
      .set('Authorization', authorization);

    expect(toOnly.status).toBe(200);
    expect(toOnly.body.data.pagination.total).toBe(1);

    const invalidRange = await request(app)
      .get(
        '/api/v1/interviews/history?from=2026-08-15&to=2026-08-15'
      )
      .set('Authorization', authorization);

    expect(invalidRange.status).toBe(400);
    expect(invalidRange.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects timezone-less ISO date-time values', async () => {
    const { authorization } = await createUser(
      'timezone-history@example.com'
    );

    const response = await request(app)
      .get(
        '/api/v1/interviews/history?from=2026-08-01T00:00:00'
      )
      .set('Authorization', authorization);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('enforces pagination boundaries and total correctness', async () => {
    const { user, authorization } = await createUser(
      'pagination-history@example.com'
    );
    const userId = user._id.toString();

    for (let index = 0; index < 3; index += 1) {
      await createSession(userId, {
        role: fixtures.backendRole._id,
        level: fixtures.juniorLevel._id,
        technologies: [fixtures.nodeTechnology._id],
        status: 'COMPLETED',
        score: index,
        createdAt: `2026-08-0${index + 1}T10:00:00.000Z`
      });
    }

    const pageOne = await request(app)
      .get('/api/v1/interviews/history?page=1&limit=2')
      .set('Authorization', authorization);

    const pageTwo = await request(app)
      .get('/api/v1/interviews/history?page=2&limit=2')
      .set('Authorization', authorization);

    const beyond = await request(app)
      .get('/api/v1/interviews/history?page=3&limit=2')
      .set('Authorization', authorization);

    expect(pageOne.status).toBe(200);
    expect(pageTwo.status).toBe(200);
    expect(beyond.status).toBe(200);

    expect(pageOne.body.data.items).toHaveLength(2);
    expect(pageTwo.body.data.items).toHaveLength(1);
    expect(beyond.body.data.items).toHaveLength(0);

    expect(pageOne.body.data.pagination).toEqual({
      total: 3,
      page: 1,
      limit: 2,
      totalPages: 2
    });

    expect(pageTwo.body.data.pagination.total).toBe(3);
    expect(beyond.body.data.pagination.total).toBe(3);
  });

  it('enforces limit boundaries and rejects invalid pagination/query fields', async () => {
    const { authorization } = await createUser(
      'validation-history@example.com'
    );

    for (const query of [
      'page=0',
      'page=-1',
      'page=1.5',
      'limit=0',
      'limit=101',
      'limit=2.5',
      'userId=someone-else',
      'sort=invalid'
    ]) {
      const response = await request(app)
        .get(`/api/v1/interviews/history?${query}`)
        .set('Authorization', authorization);

      expect(response.status, query).toBe(400);
      expect(response.body.code, query).toBe('VALIDATION_ERROR');
    }

    const minLimit = await request(app)
      .get('/api/v1/interviews/history?limit=1')
      .set('Authorization', authorization);

    expect(minLimit.status).toBe(200);

    const maxLimit = await request(app)
      .get('/api/v1/interviews/history?limit=100')
      .set('Authorization', authorization);

    expect(maxLimit.status).toBe(200);
  });

  it('does not query questions, answers or feedback for history', async () => {
    const { user, authorization } = await createUser(
      'no-n-plus-one-history@example.com'
    );

    await createSession(user._id.toString(), {
      role: fixtures.backendRole._id,
      level: fixtures.seniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 9.1,
      createdAt: '2026-08-10T10:00:00.000Z'
    });

    const questionFindSpy = vi.spyOn(
      InterviewQuestionModel,
      'find'
    );

    const response = await request(app)
      .get('/api/v1/interviews/history')
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(questionFindSpy).not.toHaveBeenCalled();

    questionFindSpy.mockRestore();
  });

  it('does not expose answer, feedback or evaluation detail', async () => {
    const { user, authorization } = await createUser(
      'privacy-history@example.com'
    );

    await createSession(user._id.toString(), {
      role: fixtures.backendRole._id,
      level: fixtures.seniorLevel._id,
      technologies: [fixtures.nodeTechnology._id],
      status: 'COMPLETED',
      score: 9.1,
      createdAt: '2026-08-10T10:00:00.000Z'
    });

    const response = await request(app)
      .get('/api/v1/interviews/history')
      .set('Authorization', authorization);

    expect(response.status).toBe(200);

    const item = response.body.data.items[0];

    expect(item).not.toHaveProperty('questions');
    expect(item).not.toHaveProperty('answers');
    expect(item).not.toHaveProperty('feedback');
    expect(item).not.toHaveProperty('dimensions');
    expect(item).not.toHaveProperty('learningPath');
    expect(item).not.toHaveProperty('promptVersions');
    expect(item).not.toHaveProperty('jdText');
    expect(item).not.toHaveProperty('metadata');
  });
});