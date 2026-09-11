import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'audit_access_secret_key_at_least_32_characters';
  process.env.JWT_REFRESH_SECRET = 'audit_refresh_secret_key_at_least_32_characters';
  process.env.PASSWORD_RESET_SECRET = 'audit_password_reset_secret_at_least_32_characters';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
});

import app from '../src/app';
import User, { IUser } from '../src/models/user.model';
import Role from '../src/models/role.model';
import AuditLog from '../src/models/audit-log.model';
import RefreshToken from '../src/models/refresh-token.model';
import { generateAuthTokens } from '../src/utils/token';

describe('AIP-53 taxonomy RBAC and durable security audit', () => {
  let replSet: MongoMemoryReplSet;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([User.syncIndexes(), Role.syncIndexes(), AuditLog.syncIndexes()]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await Promise.all([User.deleteMany({}), Role.deleteMany({}), AuditLog.deleteMany({}), RefreshToken.deleteMany({})]);
  });

  const createUser = (role: IUser['role'], suffix: string, status: IUser['status'] = 'ACTIVE') =>
    User.create({
      email: `${suffix}@example.invalid`,
      passwordHash: 'not-used-by-token-authentication',
      fullName: `${role} User`, role, status, authVersion: 0, credentialVersion: 0,
    });

  const authorization = (user: IUser) =>
    `Bearer ${generateAuthTokens(user._id.toString(), user.role, undefined, undefined, user.credentialVersion).accessToken}`;

  it('requires authentication for reads and allows Candidate, Interviewer, and Admin to read taxonomy', async () => {
    await Role.create({ code: 'BACKEND', name: 'Backend' });
    await request(app).get('/api/v1/roles').expect(401);

    for (const [role, suffix] of [['CANDIDATE', 'candidate'], ['INTERVIEWER', 'interviewer'], ['ADMIN', 'admin']] as const) {
      const user = await createUser(role, suffix);
      const response = await request(app).get('/api/v1/roles').set('Authorization', authorization(user)).expect(200);
      expect(response.body.data.roles).toHaveLength(1);
    }
  });

  it('denies Candidate taxonomy and Admin mutations', async () => {
    const candidate = await createUser('CANDIDATE', 'candidate-denied');
    const token = authorization(candidate);
    await request(app).post('/api/v1/roles').set('Authorization', token)
      .send({ code: 'DEVOPS', name: 'DevOps' }).expect(403);
    await request(app).get('/api/v1/admin/users').set('Authorization', token).expect(403);
    expect(await Role.countDocuments({ code: 'DEVOPS' })).toBe(0);
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it('writes the actor, target, outcome, requestId, and timestamp for taxonomy and lock/unlock mutations', async () => {
    const admin = await createUser('ADMIN', 'audit-admin');
    const target = await createUser('CANDIDATE', 'audit-target');
    const token = authorization(admin);
    const createRequestId = 'b9da0ff5-8264-4b3b-ab39-7d6ff047c432';
    await request(app).post('/api/v1/roles')
      .set('Authorization', token).set('X-Request-Id', createRequestId)
      .send({ code: 'CLOUD', name: 'Cloud' }).expect(201);

    const taxonomyAudit = await AuditLog.findOne({ requestId: createRequestId }).lean();
    const createdRole = await Role.findOne({ code: 'CLOUD' }).lean();
    expect(taxonomyAudit).toMatchObject({
      resourceType: 'ROLE', action: 'CREATE_ROLE', outcome: 'SUCCESS', requestId: createRequestId,
    });
    expect(taxonomyAudit?.actor.toString()).toBe(admin._id.toString());
    expect(taxonomyAudit?.target?.toString()).toBe(createdRole?._id.toString());
    expect(taxonomyAudit?.timestamp).toBeInstanceOf(Date);

    const replay = await request(app).post('/api/v1/roles')
      .set('Authorization', token).set('X-Request-Id', createRequestId)
      .send({ code: 'CLOUD_REPLAY', name: 'Cloud Replay' }).expect(409);
    expect(replay.body.code).toBe('AUDIT_REPLAY');
    expect(await Role.countDocuments({ code: 'CLOUD_REPLAY' })).toBe(0);
    expect(await AuditLog.countDocuments({ requestId: createRequestId })).toBe(1);

    const lockRequestId = '07de287b-5381-4bb5-8038-a2d8fb5ca373';
    await request(app).patch(`/api/v1/admin/users/${target._id}/lock`)
      .set('Authorization', token).set('X-Request-Id', lockRequestId).expect(200);
    const lockAudit = await AuditLog.findOne({ requestId: lockRequestId }).lean();
    expect(lockAudit).toMatchObject({
      resourceType: 'USER',
      action: 'LOCK_USER', outcome: 'SUCCESS', requestId: lockRequestId,
    });
    expect(lockAudit?.actor.toString()).toBe(admin._id.toString());
    expect(lockAudit?.target?.toString()).toBe(target._id.toString());
    expect(lockAudit).not.toHaveProperty('email');
    expect(lockAudit).not.toHaveProperty('token');

    const unlockRequestId = 'c92b1c4c-9dd2-4a5b-a966-f7c13d083ce4';
    await request(app).patch(`/api/v1/admin/users/${target._id}/unlock`)
      .set('Authorization', token).set('X-Request-Id', unlockRequestId).expect(200);
    expect(await AuditLog.findOne({ requestId: unlockRequestId }).lean()).toMatchObject({
      action: 'UNLOCK_USER', outcome: 'SUCCESS', requestId: unlockRequestId,
    });
    expect((await User.findById(target._id))?.status).toBe('ACTIVE');
  });

  it('rolls back the taxonomy mutation when its success audit write fails', async () => {
    const admin = await createUser('ADMIN', 'audit-failure-admin');
    const requestId = '0cbe04f0-4ac1-41da-a2b1-ddc2bfb29131';
    vi.spyOn(AuditLog.prototype, 'save').mockRejectedValueOnce(new Error('AUDIT_STORAGE_DOWN'));

    await request(app).post('/api/v1/roles')
      .set('Authorization', authorization(admin)).set('X-Request-Id', requestId)
      .send({ code: 'ROLLBACK', name: 'Rollback' }).expect(500);

    expect(await Role.findOne({ code: 'ROLLBACK' })).toBeNull();
    expect(await AuditLog.findOne({ requestId }).lean()).toMatchObject({
      action: 'CREATE_ROLE', outcome: 'FAILURE', reason: 'MUTATION_FAILED', requestId,
    });
  });
});
