import {Request,Response} from 'express'; 
import {container} from 'tsyringe'; 
import {LeaderboardService} from '../services/leaderboard.service'; 
import {IAuditService} from '../services/interfaces/IAuditService'; 
import {AppError} from '../utils/AppError'; 

const svc=new LeaderboardService(); 
const audit=container.resolve<IAuditService>('IAuditService'); 
export const leaderboardController={list:async(req:Request,res:Response)=>{const page=Math.max(1,Number(req.query.page||1));const limit=Math.min(100,Math.max(1,Number(req.query.limit||20)));if(!Number.isInteger(page)||!Number.isInteger(limit))throw new AppError('Invalid pagination',400,'PAGINATION_INVALID');res.json({success:true,data:await svc.get(String(req.query.period||'weekly') as any,req.query.role as string|undefined,req.query.level as string|undefined,page,limit)});},privacyGet:async(req:Request,res:Response)=>res.json({success:true,data:await svc.getPrivacy(req.user!._id.toString())}),privacySet:async(req:Request,res:Response)=>res.json({success:true,data:await svc.setPrivacy(req.user!._id.toString(),req.body.leaderboardOptIn,req.requestId!,audit)})};
