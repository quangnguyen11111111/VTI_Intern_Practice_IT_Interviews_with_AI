import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi
} from 'vitest';

import mongoose from 'mongoose';
import {
  MongoMemoryReplSet
} from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET =
    'test_jwt_access_secret_key_at_least_32_characters_long_12345';
  process.env.JWT_REFRESH_SECRET =
    'test_jwt_refresh_secret_key_at_least_32_characters_long_67890';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
});

import app from '../src/app';

import User from '../src/models/user.model';

import AuditLog from '../src/models/audit-log.model';

import {
  SystemPromptModel
} from '../src/models/system-prompt.model';

import {
  InterviewSessionModel
} from '../src/models/InterviewSession';

import {
  generateAuthTokens
} from '../src/utils/token';

let mongoReplSet: MongoMemoryReplSet;

beforeAll(async () => {
  mongoReplSet =
    await MongoMemoryReplSet.create({
      replSet: { count: 1 }
    });

  await mongoose.connect(
    mongoReplSet.getUri()
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoReplSet.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await AuditLog.deleteMany({});
  await SystemPromptModel.deleteMany({});
  await InterviewSessionModel.deleteMany({});
});

const createUser = async (
  role:
    | 'CANDIDATE'
    | 'INTERVIEWER'
    | 'ADMIN'
) => {
  const passwordHash =
    await bcrypt.hash(
      'TestPassword123',
      10
    );

  return User.create({
    email:
      `${role.toLowerCase()}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}@example.com`,
    passwordHash,
    fullName: `${role} User`,
    role,
    status: 'ACTIVE',
    authVersion: 0,
    credentialVersion: 0
  });
};

const getToken = (
  user: {
    _id: mongoose.Types.ObjectId;
    role:
      | 'CANDIDATE'
      | 'INTERVIEWER'
      | 'ADMIN';
  }
) => {
  return generateAuthTokens(
    user._id.toString(),
    user.role
  ).accessToken;
};

describe(
  'ADM-04: System Prompt Versioning',
  () => {
    it(
      '1. Candidate không thể tạo system prompt',
      async () => {
        const candidate =
          await createUser(
            'CANDIDATE'
          );

        const token =
          getToken(candidate);

        const res =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              promptKey: 'interview',
              type: 'GENERATION',
              language: 'EN',
              content:
                'Test generation prompt'
            });

        expect(
          res.status
        ).toBe(403);

        expect(
          res.body.code
        ).toBe('AUTH_FORBIDDEN');
      }
    );

    it(
      '2. Admin tạo draft version 1 thành công',
      async () => {
        const admin =
          await createUser('ADMIN');

        const token =
          getToken(admin);

        const res =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN',
              content:
                'Generate five interview questions.'
            });

        expect(
          res.status
        ).toBe(201);

        expect(
          res.body.success
        ).toBe(true);

        expect(
          res.body.data.version
        ).toBe(1);

        expect(
          res.body.data.status
        ).toBe('DRAFT');

        expect(
          res.body.data.promptKey
        ).toBe('interview');

        const audit =
          await AuditLog.findOne({
            action:
              'CREATE_PROMPT_DRAFT'
          });

        expect(
          audit
        ).not.toBeNull();

        expect(
          audit?.targetType
        ).toBe('SYSTEM_PROMPT');

        expect(
          audit?.version
        ).toBe(1);

        expect(
          audit?.outcome
        ).toBe('SUCCESS');

        expect(
          audit?.actor.toString()
        ).toBe(
          admin._id.toString()
        );
      }
    );

    it(
      '3. Admin publish draft thành công',
      async () => {
        const admin =
          await createUser('ADMIN');

        const token =
          getToken(admin);

        const createRes =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN',
              content:
                'Version one generation prompt.'
            });

        const promptId =
          createRes.body.data._id;

        const publishRes =
          await request(app)
            .post(
              `/api/v1/admin/prompts/${promptId}/publish`
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            );

        expect(
          publishRes.status
        ).toBe(200);

        expect(
          publishRes.body.data.status
        ).toBe('PUBLISHED');

        expect(
          publishRes.body.data.publishedAt
        ).toBeDefined();

        const audit =
          await AuditLog.findOne({
            action:
              'PUBLISH_PROMPT'
          });

        expect(
          audit
        ).not.toBeNull();

        expect(
          audit?.version
        ).toBe(1);

        expect(
          audit?.outcome
        ).toBe('SUCCESS');
      }
    );

    it(
      '4. Publish cùng một version lần hai là idempotent',
      async () => {
        const admin =
          await createUser('ADMIN');

        const token =
          getToken(admin);

        const createRes =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN',
              content:
                'Idempotent prompt.'
            });

        const promptId =
          createRes.body.data._id;

        const first =
          await request(app)
            .post(
              `/api/v1/admin/prompts/${promptId}/publish`
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            );

        const second =
          await request(app)
            .post(
              `/api/v1/admin/prompts/${promptId}/publish`
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            );

        expect(
          first.status
        ).toBe(200);

        expect(
          second.status
        ).toBe(200);

        expect(
          second.body.data._id
        ).toBe(promptId);

        const published =
          await SystemPromptModel.find({
            promptKey:
              'interview',
            type:
              'GENERATION',
            language:
              'EN',
            status:
              'PUBLISHED'
          });

        expect(
          published
        ).toHaveLength(1);
      }
    );

    it(
      '5. Publish version mới archive version cũ',
      async () => {
        const admin =
          await createUser('ADMIN');

        const token =
          getToken(admin);

        const v1Res =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN',
              content:
                'Version 1.'
            });

        await request(app)
          .post(
            `/api/v1/admin/prompts/${v1Res.body.data._id}/publish`
          )
          .set(
            'Authorization',
            `Bearer ${token}`
          );

        const v2Res =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN',
              content:
                'Version 2.'
            });

        expect(
          v2Res.body.data.version
        ).toBe(2);

        await request(app)
          .post(
            `/api/v1/admin/prompts/${v2Res.body.data._id}/publish`
          )
          .set(
            'Authorization',
            `Bearer ${token}`
          );

        const versions =
          await SystemPromptModel.find({
            promptKey:
              'interview',
            type:
              'GENERATION',
            language:
              'EN'
          }).sort({
            version: 1
          });

        expect(
          versions
        ).toHaveLength(2);

        expect(
          versions[0].status
        ).toBe('ARCHIVED');

        expect(
          versions[1].status
        ).toBe('PUBLISHED');

        expect(
          versions[0].content
        ).toBe('Version 1.');

        expect(
          versions[1].content
        ).toBe('Version 2.');
      }
    );

    it(
      '6. Archived version không thể publish lại',
      async () => {
        const admin =
          await createUser('ADMIN');

        const token =
          getToken(admin);

        const v1Res =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN',
              content:
                'Version 1.'
            });

        await request(app)
          .post(
            `/api/v1/admin/prompts/${v1Res.body.data._id}/publish`
          )
          .set(
            'Authorization',
            `Bearer ${token}`
          );

        const v2Res =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN',
              content:
                'Version 2.'
            });

        await request(app)
          .post(
            `/api/v1/admin/prompts/${v2Res.body.data._id}/publish`
          )
          .set(
            'Authorization',
            `Bearer ${token}`
          );

        const res =
          await request(app)
            .post(
              `/api/v1/admin/prompts/${v1Res.body.data._id}/publish`
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            );

        expect(
          res.status
        ).toBe(400);

        expect(
          res.body.message
        ).toBe(
          'SYSTEM_PROMPT_CANNOT_BE_PUBLISHED'
        );
      }
    );

    it(
      '7. Rollback tạo version mới với content của version trước',
      async () => {
        const admin =
          await createUser('ADMIN');

        const token =
          getToken(admin);

        const v1Res =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN',
              content:
                'Original prompt.'
            });

        await request(app)
          .post(
            `/api/v1/admin/prompts/${v1Res.body.data._id}/publish`
          )
          .set(
            'Authorization',
            `Bearer ${token}`
          );

        const v2Res =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN',
              content:
                'Changed prompt.'
            });

        await request(app)
          .post(
            `/api/v1/admin/prompts/${v2Res.body.data._id}/publish`
          )
          .set(
            'Authorization',
            `Bearer ${token}`
          );

        const rollbackRes =
          await request(app)
            .post(
              `/api/v1/admin/prompts/${v2Res.body.data._id}/rollback`
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            );

        expect(
          rollbackRes.status
        ).toBe(200);

        expect(
          rollbackRes.body.data.version
        ).toBe(3);

        expect(
          rollbackRes.body.data.status
        ).toBe('PUBLISHED');

        expect(
          rollbackRes.body.data.content
        ).toBe(
          'Original prompt.'
        );

        const versions =
          await SystemPromptModel.find({
            promptKey:
              'interview',
            type:
              'GENERATION',
            language:
              'EN'
          }).sort({
            version: 1
          });

        expect(
          versions
        ).toHaveLength(3);

        expect(
          versions[0].status
        ).toBe('ARCHIVED');

        expect(
          versions[1].status
        ).toBe('ARCHIVED');

        expect(
          versions[2].status
        ).toBe('PUBLISHED');

        expect(
          versions[0].content
        ).toBe(
          'Original prompt.'
        );

        expect(
          versions[2].content
        ).toBe(
          'Original prompt.'
        );

        const audit =
          await AuditLog.findOne({
            action:
              'ROLLBACK_PROMPT'
          });

        expect(
          audit
        ).not.toBeNull();

        expect(
          audit?.version
        ).toBe(3);

        expect(
          audit?.outcome
        ).toBe('SUCCESS');
      }
    );

    it(
      '8. Candidate không thể đọc system prompt',
      async () => {
        const candidate =
          await createUser(
            'CANDIDATE'
          );

        const token =
          getToken(candidate);

        const res =
          await request(app)
            .get(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .query({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN'
            });

        expect(
          res.status
        ).toBe(403);

        expect(
          res.body.code
        ).toBe(
          'AUTH_FORBIDDEN'
        );
      }
    );

    it(
      '9. Request không có token bị từ chối',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/admin/prompts'
            );

        expect(
          res.status
        ).toBe(401);

        expect(
          res.body.code
        ).toBe(
          'AUTH_UNAUTHORIZED'
        );
      }
    );

    it(
      '10. AI generation lưu đúng prompt version đã sử dụng',
      async () => {
        const admin =
          await createUser('ADMIN');

        const adminToken =
          getToken(admin);

        // Tạo generation prompt v1
        const promptRes =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN',
              content:
                'Test generation system prompt v1'
            });

        expect(
          promptRes.status
        ).toBe(201);

        const promptId =
          promptRes.body.data._id;

        // Publish prompt
        const publishRes =
          await request(app)
            .post(
              `/api/v1/admin/prompts/${promptId}/publish`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          publishRes.status
        ).toBe(200);

        // Tạo interview session
        const sessionRes =
          await request(app)
            .post(
              '/api/v1/interviews'
            )
            .send({
              jobPosition:
                'Software Engineer',
              level:
                'Junior',
              techStacks:
                ['JavaScript']
            });

        expect(
          sessionRes.status
        ).toBe(201);

        const sessionId =
          sessionRes.body.data.id;

        // Generate questions
        const generateRes =
          await request(app)
            .post(
              `/api/v1/interviews/${sessionId}/generate`
            );

        expect(
          generateRes.status
        ).toBe(200);

        expect(
          generateRes.body.success
        ).toBe(true);

        // Kiểm tra session trong DB
        const session =
          await InterviewSessionModel
            .findById(sessionId)
            .lean();

        expect(
          session
        ).not.toBeNull();

        expect(
          session
            ?.promptVersions
            ?.generation
            ?.promptId
        ).toBe(promptId);

        expect(
          session
            ?.promptVersions
            ?.generation
            ?.version
        ).toBe(1);

        expect(
          session
            ?.promptVersions
            ?.generation
            ?.language
        ).toBe('EN');
      }
    );

    it(
      '11. AI evaluation lưu đúng prompt version đã sử dụng',
      async () => {
        const admin =
          await createUser('ADMIN');

        const adminToken =
          getToken(admin);

        // Tạo + publish GENERATION prompt
        const generationRes =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN',
              content:
                'Generation system prompt v1'
            });

        expect(
          generationRes.status
        ).toBe(201);

        const generationPromptId =
          generationRes.body.data._id;

        const generationPublishRes =
          await request(app)
            .post(
              `/api/v1/admin/prompts/${generationPromptId}/publish`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          generationPublishRes.status
        ).toBe(200);

        // Tạo + publish EVALUATION prompt
        const evaluationRes =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'EVALUATION',
              language:
                'EN',
              content:
                'Evaluation system prompt v1'
            });

        expect(
          evaluationRes.status
        ).toBe(201);

        const evaluationPromptId =
          evaluationRes.body.data._id;

        const evaluationPublishRes =
          await request(app)
            .post(
              `/api/v1/admin/prompts/${evaluationPromptId}/publish`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          evaluationPublishRes.status
        ).toBe(200);

        // Tạo interview
        const sessionRes =
          await request(app)
            .post(
              '/api/v1/interviews'
            )
            .send({
              jobPosition:
                'Software Engineer',
              level:
                'Junior',
              techStacks:
                ['JavaScript']
            });

        expect(
          sessionRes.status
        ).toBe(201);

        const sessionId =
          sessionRes.body.data.id;

        // Generate questions
        const generateRes =
          await request(app)
            .post(
              `/api/v1/interviews/${sessionId}/generate`
            );

        expect(
          generateRes.status
        ).toBe(200);

        const questions =
          generateRes.body.data
            .questions;

        expect(
          questions
        ).toBeDefined();

        expect(
          questions
        ).toHaveLength(5);

        // Submit answers
        const answers =
          questions.map(
            (question: any) => ({
              questionId:
                question.id,
              candidateAnswer:
                'This is a test answer.'
            })
          );

        const submitRes =
          await request(app)
            .post(
              `/api/v1/interviews/${sessionId}/submit`
            )
            .send({
              answers
            });

        expect(
          submitRes.status
        ).toBe(200);

        // Kiểm tra evaluation prompt version
        const session =
          await InterviewSessionModel
            .findById(sessionId)
            .lean();

        expect(
          session
        ).not.toBeNull();

        expect(
          session
            ?.promptVersions
            ?.evaluation
            ?.promptId
        ).toBe(
          evaluationPromptId
        );

        expect(
          session
            ?.promptVersions
            ?.evaluation
            ?.version
        ).toBe(1);

        expect(
          session
            ?.promptVersions
            ?.evaluation
            ?.language
        ).toBe('EN');
      }
    );

    it(
      '12. AI learning path lưu đúng prompt version đã sử dụng',
      async () => {
        const admin =
          await createUser('ADMIN');

        const adminToken =
          getToken(admin);

        // --------------------------------------------------
        // 1. Tạo + publish GENERATION prompt
        // --------------------------------------------------
        const generationRes =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'GENERATION',
              language:
                'EN',
              content:
                'Generation system prompt v1'
            });

        expect(
          generationRes.status
        ).toBe(201);

        const generationPromptId =
          generationRes.body.data._id;

        const generationPublishRes =
          await request(app)
            .post(
              `/api/v1/admin/prompts/${generationPromptId}/publish`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          generationPublishRes.status
        ).toBe(200);

        // --------------------------------------------------
        // 2. Tạo + publish EVALUATION prompt
        // --------------------------------------------------
        const evaluationRes =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'EVALUATION',
              language:
                'EN',
              content:
                'Evaluation system prompt v1'
            });

        expect(
          evaluationRes.status
        ).toBe(201);

        const evaluationPromptId =
          evaluationRes.body.data._id;

        const evaluationPublishRes =
          await request(app)
            .post(
              `/api/v1/admin/prompts/${evaluationPromptId}/publish`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          evaluationPublishRes.status
        ).toBe(200);

        // --------------------------------------------------
        // 3. Tạo + publish LEARNING_PATH prompt
        // --------------------------------------------------
        const learningPathRes =
          await request(app)
            .post(
              '/api/v1/admin/prompts'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              promptKey:
                'interview',
              type:
                'LEARNING_PATH',
              language:
                'EN',
              content:
                'Learning path system prompt v1'
            });

        expect(
          learningPathRes.status
        ).toBe(201);

        const learningPathPromptId =
          learningPathRes.body.data._id;

        const learningPathPublishRes =
          await request(app)
            .post(
              `/api/v1/admin/prompts/${learningPathPromptId}/publish`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          learningPathPublishRes.status
        ).toBe(200);

        // --------------------------------------------------
        // 4. Tạo interview session
        // --------------------------------------------------
        const sessionRes =
          await request(app)
            .post(
              '/api/v1/interviews'
            )
            .send({
              jobPosition:
                'Software Engineer',
              level:
                'Junior',
              techStacks:
                ['JavaScript']
            });

        expect(
          sessionRes.status
        ).toBe(201);

        const sessionId =
          sessionRes.body.data.id;

        // --------------------------------------------------
        // 5. Generate questions
        // --------------------------------------------------
        const generateRes =
          await request(app)
            .post(
              `/api/v1/interviews/${sessionId}/generate`
            );

        expect(
          generateRes.status
        ).toBe(200);

        const questions =
          generateRes.body.data
            .questions;

        expect(
          questions
        ).toBeDefined();

        expect(
          questions
        ).toHaveLength(5);

        // --------------------------------------------------
        // 6. Submit answers
        // --------------------------------------------------
        const answers =
          questions.map(
            (question: any) => ({
              questionId:
                question.id,
              candidateAnswer:
                'This is a test answer.'
            })
          );

        const submitRes =
          await request(app)
            .post(
              `/api/v1/interviews/${sessionId}/submit`
            )
            .send({
              answers
            });

        expect(
          submitRes.status
        ).toBe(200);

        // --------------------------------------------------
        // 7. Kiểm tra learning-path prompt version
        // --------------------------------------------------
        const session =
          await InterviewSessionModel
            .findById(sessionId)
            .lean();

        expect(
          session
        ).not.toBeNull();

        expect(
          session
            ?.promptVersions
            ?.learningPath
            ?.promptId
        ).toBe(
          learningPathPromptId
        );

        expect(
          session
            ?.promptVersions
            ?.learningPath
            ?.version
        ).toBe(1);

        expect(
          session
            ?.promptVersions
            ?.learningPath
            ?.language
        ).toBe('EN');
      }
    );
  }
);