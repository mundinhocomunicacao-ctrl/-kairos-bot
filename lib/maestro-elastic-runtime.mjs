import {MAESTRO_ELASTIC_NANOAGENT_POOL} from '../data/maestro-elastic-nanoagent-pool.js';
import {MAESTRO_QUEUE_REGISTRY} from '../data/maestro-queue-registry.js';
import {NANOAGENT_REGISTRY} from '../data/nanoagent-registry.js';
import {OS_CLOSURE_QUEUE_REGISTRY} from '../data/os-closure-queue-registry.js';

const canonicalQueueIds=new Set(MAESTRO_QUEUE_REGISTRY.queues.map(queue=>queue.id));
const closureQueueParents=new Map(OS_CLOSURE_QUEUE_REGISTRY.queues.map(queue=>[queue.id,queue.parentQueue]));
const queueIds=new Set([...canonicalQueueIds,...closureQueueParents.keys()]);
const clean=value=>String(value??'').trim();

export function buildElasticMission({missionId,queueId,inputEventId,tasks=[]}={}){
  const mission=clean(missionId),queue=clean(queueId),event=clean(inputEventId);
  if(!mission||!queue||!event)throw new Error('ELASTIC_MISSION_IDENTITY_REQUIRED');
  if(!queueIds.has(queue))throw new Error('ELASTIC_MISSION_UNKNOWN_QUEUE');
  if(!Array.isArray(tasks)||tasks.length===0)throw new Error('ELASTIC_MISSION_TASKS_REQUIRED');
  if(tasks.length>MAESTRO_ELASTIC_NANOAGENT_POOL.maxConcurrentWorkers)throw new Error('ELASTIC_MISSION_CONCURRENCY_LIMIT');
  const parentQueueId=closureQueueParents.get(queue)||queue;
  if(!canonicalQueueIds.has(parentQueueId))throw new Error('ELASTIC_MISSION_PARENT_QUEUE_UNKNOWN');
  const ids=tasks.map((task,index)=>clean(task?.taskId)||`TASK-${index+1}`);
  if(new Set(ids).size!==ids.length)throw new Error('ELASTIC_MISSION_DUPLICATE_TASK');
  return Object.freeze({missionId:mission,queueId:queue,parentQueueId,inputEventId:event,tasks:Object.freeze(tasks.map((task,index)=>Object.freeze({...task,taskId:ids[index]})))});
}

export async function executeElasticMission({mission,executor}={}){
  if(!mission||typeof executor!=='function')throw new Error('ELASTIC_MISSION_EXECUTOR_REQUIRED');
  const selected=NANOAGENT_REGISTRY.slice(0,mission.tasks.length);
  let active=0,peakConcurrency=0;
  const startedAt=new Date().toISOString();
  const receipts=await Promise.all(mission.tasks.map(async(task,index)=>{
    const agent=selected[index];
    active+=1;peakConcurrency=Math.max(peakConcurrency,active);
    try{
      const result=await executor(Object.freeze({missionId:mission.missionId,queueId:mission.queueId,parentQueueId:mission.parentQueueId||mission.queueId,inputEventId:mission.inputEventId,task,agent}));
      return Object.freeze({receiptId:`RCPT-${mission.missionId}-${task.taskId}`,missionId:mission.missionId,queueId:mission.queueId,parentQueueId:mission.parentQueueId||mission.queueId,inputEventId:mission.inputEventId,taskId:task.taskId,agentId:agent.id,status:'DONE',evidence:result?.evidence??null,result:result?.result??result??null});
    }finally{active-=1;}
  }));
  return Object.freeze({missionId:mission.missionId,queueId:mission.queueId,parentQueueId:mission.parentQueueId||mission.queueId,inputEventId:mission.inputEventId,startedAt,finishedAt:new Date().toISOString(),workerCount:receipts.length,peakConcurrency,receipts:Object.freeze(receipts)});
}
