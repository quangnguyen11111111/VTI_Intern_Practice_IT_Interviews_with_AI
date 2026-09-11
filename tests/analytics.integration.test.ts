import 'dotenv/config';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

import app from '../src/app';
import User from '../src/models/user.model';
import Role from '../src/models/role.model';
import Level from '../src/models/level.model';
import Technology from '../src/models/technology.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { generateAuthTokens } from '../src/utils/token';

let mongo: MongoMemoryServer;
let role: mongoose.Types.ObjectId;
let otherRole: mongoose.Types.ObjectId;
let level: mongoose.Types.ObjectId;
let otherLevel: mongoose.Types.ObjectId;
let technology: mongoose.Types.ObjectId;
let otherTechnology: mongoose.Types.ObjectId;

const dimensions = [
  'Technical Depth',
  'Problem Solving',
  'System Design & Best Practices',
  'Communication',
  'Practical Experience'
];

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await InterviewSessionModel.deleteMany({});
  await Technology.deleteMany({});
  await Level.deleteMany({});
  await Role.deleteMany({});
  await User.deleteMany({});

  const roles = await Role.create([
    {
      code: 'BE',
      name: 'Backend Developer',
      status: 'ACTIVE'
    },
    {
      code: 'FE',
      name: 'Frontend Developer',
      status: 'ACTIVE'
    }
  ]);

  const levels = await Level.create([
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

  const technologies = await Technology.create([
    {
      code: 'NODE',
      name: 'Node.js',
      roles: [roles[0]._id],
      status: 'ACTIVE'
    },
    {
      code: 'REACT',
      name: 'React',
      roles: [roles[1]._id],
      status: 'ACTIVE'
    }
  ]);

  role = roles[0]._id as mongoose.Types.ObjectId;
  otherRole = roles[1]._id as mongoose.Types.ObjectId;
  level = levels[0]._id as mongoose.Types.ObjectId;
  otherLevel = levels[1]._id as mongoose.Types.ObjectId;
  technology = technologies[0]._id as mongoose.Types.ObjectId;
  otherTechnology = technologies[1]._id as mongoose.Types.ObjectId;
});

const createUser = async (email: string) => {
  const user = await User.create({
    email,
    passwordHash: 'not-used-by-analytics-tests',
    fullName: 'Analytics Candidate',
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
    roleId: mongoose.Types.ObjectId;
    levelId: mongoose.Types.ObjectId;
    technologyIds: mongoose.Types.ObjectId[];
    status:
      | 'PENDING'
      | 'GENERATING'
      | 'IN_PROGRESS'
      | 'EVALUATING'
      | 'COMPLETED'
      | 'FAILED';
    score: number | null;
    createdAt: string;
    dimensionScores?: number[];
  }
) =>
  InterviewSessionModel.create({
    userId,
    status: data.status,
    setupData: {
      jobPosition: data.roleId.toString(),
      level: data.levelId.toString(),
      techStacks: data.technologyIds.map((id) =>
        id.toString()
      )
    },
    overallScore: data.score,
    dimensions:
      data.dimensionScores?.map((score, index) => ({
        name: dimensions[index],
        score,
        reasoning: 'test'
      })) ?? null,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.createdAt)
  });

describe('ANA-01 interview analytics API', () => {
  it('requires authentication', async () => {
    const response = await request(app).get(
      '/api/v1/interviews/analytics'
    );

    expect(response.status).toBe(401);
    expect(response.body.code).toBe(
      'AUTH_UNAUTHORIZED'
    );
  });

  it('isolates ownership and ignores client userId', async () => {
    const owner = await createUser(
      'analytics-owner@example.com'
    );

    const other = await createUser(
      'analytics-other@example.com'
    );

    await createSession(
      owner.user._id.toString(),
      {
        roleId: role,
        levelId: level,
        technologyIds: [technology],
        status: 'COMPLETED',
        score: 8,
        createdAt:
          '2026-09-01T10:00:00.000Z',
        dimensionScores: [8, 7, 9, 8, 8]
      }
    );

    await createSession(
      other.user._id.toString(),
      {
        roleId: role,
        levelId: level,
        technologyIds: [technology],
        status: 'COMPLETED',
        score: 10,
        createdAt:
          '2026-09-01T11:00:00.000Z',
        dimensionScores: [10, 10, 10, 10, 10]
      }
    );

    const response = await request(app)
      .get(
        `/api/v1/interviews/analytics?userId=${other.user._id}`
      )
      .set(
        'Authorization',
        owner.authorization
      );

    expect(response.status).toBe(200);

    expect(
      response.body.data.summary.totalCompleted
    ).toBe(1);

    expect(
      response.body.data.summary
        .averageOverallScore
    ).toBe(8);
  });

  it('aggregates only completed scored sessions by UTC day and averages multiple sessions in a day', async () => {
    const owner = await createUser(
      'analytics-completed@example.com'
    );

    await createSession(
      owner.user._id.toString(),
      {
        roleId: role,
        levelId: level,
        technologyIds: [technology],
        status: 'COMPLETED',
        score: 8,
        createdAt:
          '2026-09-01T01:00:00.000Z',
        dimensionScores: [8, 6, 8, 10, 8]
      }
    );

    await createSession(
      owner.user._id.toString(),
      {
        roleId: role,
        levelId: level,
        technologyIds: [technology],
        status: 'COMPLETED',
        score: 6,
        createdAt:
          '2026-09-01T12:00:00.000Z',
        dimensionScores: [6, 8, 6, 8, 6]
      }
    );

    const excludedStatuses: Array<
      | 'FAILED'
      | 'PENDING'
      | 'GENERATING'
      | 'IN_PROGRESS'
      | 'EVALUATING'
    > = [
      'FAILED',
      'PENDING',
      'GENERATING',
      'IN_PROGRESS',
      'EVALUATING'
    ];

    for (
      const [index, status] of
        excludedStatuses.entries()
    ) {
      await createSession(
        owner.user._id.toString(),
        {
          roleId: role,
          levelId: level,
          technologyIds: [technology],
          status,
          score: 9,
          createdAt: `2026-09-01T1${
            3 + index
          }:00:00.000Z`,
          dimensionScores: [
            9,
            9,
            9,
            9,
            9
          ]
        }
      );
    }

    await createSession(
      owner.user._id.toString(),
      {
        roleId: role,
        levelId: level,
        technologyIds: [technology],
        status: 'COMPLETED',
        score: null,
        createdAt:
          '2026-09-01T15:00:00.000Z',
        dimensionScores: [
          5,
          5,
          5,
          5,
          5
        ]
      }
    );

    await createSession(
      owner.user._id.toString(),
      {
        roleId: role,
        levelId: level,
        technologyIds: [technology],
        status: 'COMPLETED',
        score: 10,
        createdAt:
          '2026-09-02T01:00:00.000Z',
        dimensionScores: [
          10,
          10,
          10,
          10,
          10
        ]
      }
    );

    const response = await request(app)
      .get(
        '/api/v1/interviews/analytics'
      )
      .set(
        'Authorization',
        owner.authorization
      );

    expect(response.status).toBe(200);

    expect(
      response.body.data.summary.totalCompleted
    ).toBe(3);

    expect(
      response.body.data.summary
        .averageOverallScore
    ).toBe(8);

    expect(
      response.body.data.summary.dimensions
    ).toEqual([
      {
        name: 'Technical Depth',
        score: 8
      },
      {
        name: 'Problem Solving',
        score: 8
      },
      {
        name:
          'System Design & Best Practices',
        score: 8
      },
      {
        name: 'Communication',
        score: 9.33
      },
      {
        name: 'Practical Experience',
        score: 8
      }
    ]);

    expect(
      response.body.data.series
    ).toEqual([
      {
        date: '2026-09-01',
        overallScore: 7,
        dimensions: [
          {
            name: 'Technical Depth',
            score: 7
          },
          {
            name: 'Problem Solving',
            score: 7
          },
          {
            name:
              'System Design & Best Practices',
            score: 7
          },
          {
            name: 'Communication',
            score: 9
          },
          {
            name: 'Practical Experience',
            score: 7
          }
        ]
      },
      {
        date: '2026-09-02',
        overallScore: 10,
        dimensions: dimensions.map(
          (name) => ({
            name,
            score: 10
          })
        )
      }
    ]);
  });

  it('applies role, level, technology and [from,to) date filters', async () => {
    const owner = await createUser(
      'analytics-filters@example.com'
    );

    await createSession(
      owner.user._id.toString(),
      {
        roleId: role,
        levelId: level,
        technologyIds: [technology],
        status: 'COMPLETED',
        score: 8,
        createdAt:
          '2026-09-02T00:00:00.000Z',
        dimensionScores: [
          8,
          8,
          8,
          8,
          8
        ]
      }
    );

    await createSession(
      owner.user._id.toString(),
      {
        roleId: otherRole,
        levelId: otherLevel,
        technologyIds: [otherTechnology],
        status: 'COMPLETED',
        score: 5,
        createdAt:
          '2026-09-03T00:00:00.000Z',
        dimensionScores: [
          5,
          5,
          5,
          5,
          5
        ]
      }
    );

    const response = await request(app)
      .get(
        `/api/v1/interviews/analytics?role=${role}&level=${level}&technology=${technology}&from=2026-09-02&to=2026-09-03`
      )
      .set(
        'Authorization',
        owner.authorization
      );

    expect(response.status).toBe(200);

    expect(
      response.body.data.summary.totalCompleted
    ).toBe(1);

    expect(
      response.body.data.series[0].date
    ).toBe('2026-09-02');
  });

  it('returns null for a missing dimension instead of fabricating a score', async () => {
    const owner = await createUser(
      'analytics-missing-dimension@example.com'
    );

    await createSession(
      owner.user._id.toString(),
      {
        roleId: role,
        levelId: level,
        technologyIds: [technology],
        status: 'COMPLETED',
        score: 8,
        createdAt:
          '2026-09-04T00:00:00.000Z',
        dimensionScores: [8, 7]
      }
    );

    const response = await request(app)
      .get(
        '/api/v1/interviews/analytics'
      )
      .set(
        'Authorization',
        owner.authorization
      );

    expect(response.status).toBe(200);

    expect(
      response.body.data.summary.dimensions
    ).toEqual([
      {
        name: dimensions[0],
        score: 8
      },
      {
        name: dimensions[1],
        score: 7
      },
      {
        name: dimensions[2],
        score: null
      },
      {
        name: dimensions[3],
        score: null
      },
      {
        name: dimensions[4],
        score: null
      }
    ]);

    expect(
      response.body.data.series[0]
        .dimensions[2].score
    ).toBeNull();
  });

  it('returns an empty analytics result without pagination', async () => {
    const owner = await createUser(
      'analytics-empty@example.com'
    );

    const response = await request(app)
      .get(
        '/api/v1/interviews/analytics?from=2026-10-01&to=2026-10-02'
      )
      .set(
        'Authorization',
        owner.authorization
      );

    expect(response.status).toBe(200);

    expect(response.body.data).toEqual({
      summary: {
        totalCompleted: 0,
        averageOverallScore: null,
        dimensions: dimensions.map(
          (name) => ({
            name,
            score: null
          })
        )
      },
      series: []
    });
  });
});