import { authenticated, failure, json, ApiError } from '@/lib/server/http';
import { adminClient } from '@/lib/server/supabase';
export async function GET(){try{const {user}=await authenticated();const {data,error}=await adminClient().from('hangout_notifications').select('id,title,reason').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);if(error)throw new ApiError('Attendance notifications need the new database migration.',503);return json({notifications:data??[]});}catch(error){return failure(error);}}
