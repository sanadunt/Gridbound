import type { ClassId } from './content';
import { JOBS } from './jobs';

export const BASIC_JOBS: readonly ClassId[] = Object.freeze(['warrior','rogue','archer','healer','wizard']);
export type RogueRecruit = { classId: ClassId; job?: string };
export type RogueBuild = { recruits: RogueRecruit[]; points: number; clearedRooms: number[] };
const basic = (value: unknown): value is ClassId => BASIC_JOBS.includes(value as ClassId);
const selection = (value: unknown): value is ClassId[] => Array.isArray(value) && value.length === 3 && Array.from(value).every(basic);

export function createRogueBuild(jobs: unknown = ['warrior','healer','archer']): RogueBuild {
  if (!selection(jobs)) throw new Error('Roguelike requires exactly 3 basic jobs');
  return { recruits: jobs.map(classId => ({ classId })), points: 0, clearedRooms: [] };
}
export function validRogueBuild(raw: unknown): raw is RogueBuild {
  if (!raw || typeof raw !== 'object') return false;
  const b = raw as RogueBuild;
  if (!Array.isArray(b.recruits) || b.recruits.length !== 3 || !Number.isInteger(b.points) || b.points < 0 || !Array.isArray(b.clearedRooms)) return false;
  if (b.clearedRooms.length > 100 || new Set(b.clearedRooms).size !== b.clearedRooms.length || !Array.from(b.clearedRooms).every(n => Number.isInteger(n) && n >= 1 && n <= 100)) return false;
  let spent = 0;
  for (const r of b.recruits) {
    if (!r || !basic(r.classId)) return false;
    if (r.job !== undefined) {
      const job = Object.values(JOBS).find(j => j.id === r.job && j.base === r.classId);
      if (!job) return false;
      spent += job.tier - 1;
    }
  }
  return spent + b.points === b.clearedRooms.length;
}
export function normalizeRogueBuild(raw: unknown): RogueBuild {
  if (!validRogueBuild(raw)) return createRogueBuild();
  return { recruits: raw.recruits.map(r => ({classId:r.classId,...(r.job ? {job:r.job} : {})})), points:raw.points, clearedRooms:[...raw.clearedRooms] };
}
export function setRogueJobs(build: RogueBuild, jobs: unknown): boolean {
  if (!validRogueBuild(build) || build.clearedRooms.length || !selection(jobs)) return false;
  build.recruits = jobs.map(classId => ({classId}));
  return true;
}
export function rewardRogueRoom(build: RogueBuild, floor: number): boolean {
  if (!validRogueBuild(build) || !Number.isInteger(floor) || floor < 1 || floor > 100 || build.clearedRooms.includes(floor)) return false;
  build.clearedRooms.push(floor); build.points++;
  return true;
}
export function rogueUpgrades(build: RogueBuild, id: number) {
  const r = Number.isInteger(id) ? build.recruits[id] : undefined;
  return r ? Object.values(JOBS).filter(j => j.base === r.classId && (r.job ? j.parent === r.job : j.tier === 2)) : [];
}
export function promoteRogue(build: RogueBuild, id: number, jobId: string): boolean {
  if (!validRogueBuild(build) || build.points < 1 || !rogueUpgrades(build,id).some(j => j.id === jobId)) return false;
  build.recruits[id].job = jobId; build.points--;
  return true;
}
