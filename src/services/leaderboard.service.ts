import mongoose from 'mongoose';
import { InterviewSessionModel } from '../models/InterviewSession';
import User from '../models/user.model';
import Role from '../models/role.model';
import Level from '../models/level.model';
import { AppError } from '../utils/AppError';

const periodBounds = (period:'weekly'|'monthly', now=new Date()) => {
  const start = new Date(now);
  const end = new Date(now);
  if (period === 'weekly') {
    const day=(start.getUTCDay()+6)%7;
    start.setUTCDate(start.getUTCDate()-day);
  } else {
    start.setUTCDate(1);
  }
  start.setUTCHours(0,0,0,0);
  return {start,end};
};

export class LeaderboardService {
  async get(period:'weekly'|'monthly', role?:string, level?:string, page=1, limit=20) {
    if(!['weekly','monthly'].includes(period)) throw new AppError('Invalid period',400,'LEADERBOARD_PERIOD_INVALID');
    if(!Number.isInteger(page)||page<1||!Number.isInteger(limit)||limit<1||limit>100) throw new AppError('Invalid pagination',400,'PAGINATION_INVALID');
    const {start,end}=periodBounds(period);
    const match:any={status:'COMPLETED',overallScore:{$gte:0,$lte:100},createdAt:{$gte:start,$lt:end}};
    if(role){if(!mongoose.isValidObjectId(role))throw new AppError('Invalid role',400,'LEADERBOARD_ROLE_INVALID');match['setupData.jobPosition']=role;}
    if(level){if(!mongoose.isValidObjectId(level))throw new AppError('Invalid level',400,'LEADERBOARD_LEVEL_INVALID');match['setupData.level']=level;}

    const skip=(page-1)*limit;
    const [result] = await InterviewSessionModel.aggregate([
      {$match:match},
      {$addFields:{userObjectId:{$convert:{input:'$userId',to:'objectId',onError:null,onNull:null}},roleObjectId:{$convert:{input:'$setupData.jobPosition',to:'objectId',onError:null,onNull:null}},levelObjectId:{$convert:{input:'$setupData.level',to:'objectId',onError:null,onNull:null}}}},
      {$lookup:{from:User.collection.name,localField:'userObjectId',foreignField:'_id',as:'user'}},
      {$match:{'user.leaderboardOptIn':true}},
      {$sort:{overallScore:-1,createdAt:1,userId:1,_id:1}},
      {$group:{_id:'$userObjectId',score:{$first:'$overallScore'},createdAt:{$first:'$createdAt'},roleId:{$first:'$roleObjectId'},levelId:{$first:'$levelObjectId'},displayName:{$first:{$arrayElemAt:['$user.fullName',0]}}}},
      {$sort:{score:-1,createdAt:1,_id:1}},
      {$lookup:{from:Role.collection.name,localField:'roleId',foreignField:'_id',as:'role'}},
      {$lookup:{from:Level.collection.name,localField:'levelId',foreignField:'_id',as:'level'}},
      {$project:{_id:0,score:1,createdAt:1,displayName:1,role:{$ifNull:[{$arrayElemAt:['$role.name',0]},null]},level:{$ifNull:[{$arrayElemAt:['$level.name',0]},null]}}},
      {$facet:{items:[{$skip:skip},{$limit:limit}],total:[{$count:'count'}]}},
    ]);

    const total=result?.total?.[0]?.count??0;
    const items=(result?.items??[]).map((x:any,i:number)=>({
      rank:skip+i+1,
      displayName:x.displayName,
      score:x.score,
      role:x.role??null,
      level:x.level??null,
      period,
    }));
    return {items,pagination:{total,page,limit,totalPages:Math.ceil(total/limit)}};
  }

  async getPrivacy(userId:string){
    const u=await User.findById(userId).select({leaderboardOptIn:1}).lean();
    if(!u)throw new AppError('User not found',404,'USER_NOT_FOUND');
    return {leaderboardOptIn:u.leaderboardOptIn??false};
  }

  async setPrivacy(userId:string,optIn:boolean,requestId:string,audit:any){
    const u=await User.findOneAndUpdate({_id:userId,status:'ACTIVE'},{$set:{leaderboardOptIn:optIn}},{returnDocument:'after'}).lean();
    if(!u)throw new AppError('User not found',404,'USER_NOT_FOUND');
    await audit.createAuditLog({actorId:userId,targetId:userId,targetType:'USER',resourceType:'LEADERBOARD',action:'LEADERBOARD_PRIVACY_CHANGED',outcome:'SUCCESS',requestId});
    return {leaderboardOptIn:u.leaderboardOptIn};
  }
}
