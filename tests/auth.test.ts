import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/config', () => ({ authConfigured: () => true, appOrigin: () => 'http://localhost:3000', calendarConfigured: () => true }));
vi.mock('@/lib/server/supabase', () => ({ sessionClient: vi.fn(), adminClient: vi.fn() }));
import { POST } from '../app/api/auth/route';
import { GET } from '../app/api/auth/callback/route';
import { sessionClient } from '../lib/server/supabase';
const resend=vi.fn(), signUp = vi.fn(), exchangeCodeForSession = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sessionClient).mockResolvedValue({ auth: { signUp, resend, exchangeCodeForSession } } as unknown as Awaited<ReturnType<typeof sessionClient>>);
});
it('requests email confirmation with the app callback and keeps an unconfirmed signup signed out', async () => {
  signUp.mockResolvedValue({ data: { session: null }, error: null });
  const response = await POST(new Request('http://localhost:3000/api/auth', { method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'signup', email: 'jamie@example.com', name: 'Jamie', password: 'test-password-only' }) }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ signedIn: false, message: expect.stringContaining('Check your email') });
  expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { data: { name: 'Jamie' }, emailRedirectTo: 'http://localhost:3000/api/auth/callback' } }));
});
it('reports an already registered email when Supabase masks duplicate signups', async () => {
  signUp.mockResolvedValue({ data: { session: null, user: { identities: [] } }, error: null });
  const response = await POST(new Request('http://localhost:3000/api/auth', { method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'signup', email: 'jamie@example.com', name: 'Jamie', password: 'test-password-only' }) }));
  expect(response.status).toBe(409);
  expect((await response.json()).error).toContain('already uses this email');
});
it('exchanges a confirmation code and returns to the account with invitation resumption', async () => {
  exchangeCodeForSession.mockResolvedValue({ error: null });
  const response = await GET(new Request('http://localhost:3000/api/auth/callback?code=test-code'));
  expect(exchangeCodeForSession).toHaveBeenCalledWith('test-code');
  expect(response.headers.get('location')).toBe('http://localhost:3000/account?resume=1');
});
it('returns an expired or invalid confirmation to a safe error screen', async () => {
  exchangeCodeForSession.mockResolvedValue({ error: new Error('expired') });
  const response = await GET(new Request('http://localhost:3000/api/auth/callback?code=expired-code'));
  expect(response.headers.get('location')).toBe('http://localhost:3000/account?error=auth&reason=callback');
});

it('resends confirmation through Supabase with the same callback',async()=>{
 resend.mockResolvedValue({error:null});const response=await POST(new Request('http://localhost:3000/api/auth',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({action:'resend',email:'jamie@example.com'})}));
 expect(response.status).toBe(200);expect(resend).toHaveBeenCalledWith({type:'signup',email:'jamie@example.com',options:{emailRedirectTo:'http://localhost:3000/api/auth/callback'}});
});
it('explains restricted email delivery without claiming the email was sent',async()=>{
 resend.mockResolvedValue({error:{code:'email_address_not_authorized',status:400}});const response=await POST(new Request('http://localhost:3000/api/auth',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({action:'resend',email:'jamie@example.com'})}));
 expect(response.status).toBe(503);expect((await response.json()).error).toContain('custom SMTP');
});

it.each([
 ['user_already_exists','Google Sign In'],
 ['weak_password','stronger password'],
 ['email_provider_disabled','Email signup is disabled'],
 ['unexpected_failure','database error'],
 ['unknown','Error code: unknown (HTTP 400)']
])('explains signup failure %s without exposing provider details',async(code,message)=>{
 const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
 signUp.mockResolvedValue({data:{session:null},error:{code,status:400,message:'private provider details'}});
 const response=await POST(new Request('http://localhost:3000/api/auth',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({action:'signup',email:'jamie@example.com',name:'Jamie',password:'test-password-only'})}));
 const result=await response.json();expect(result.error).toContain(message);expect(result.error).not.toContain('private provider details');
 expect(warning).toHaveBeenCalledWith('Signup rejected',{code,status:400});warning.mockRestore();
});

it('identifies signup connection failures without exposing raw error details',async()=>{
 const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
 signUp.mockResolvedValue({data:{session:null},error:{name:'AuthRetryableFetchError',status:0,message:'private network details'}});
 const response=await POST(new Request('http://localhost:3000/api/auth',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({action:'signup',email:'jamie@example.com',name:'Jamie',password:'test-password-only'})}));
 expect(response.status).toBe(503);const result=await response.json();expect(result.error).toContain('auth_connection_failed');expect(result.error).not.toContain('private network details');warning.mockRestore();
});

it.each([
 ['Error sending confirmation email','email_delivery_failed'],
 ['Database error saving new user','account_database_failed']
])('classifies legacy HTTP 500: %s',async(message,diagnostic)=>{
 const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
 signUp.mockResolvedValue({data:{session:null},error:{status:500,message}});
 const response=await POST(new Request('http://localhost:3000/api/auth',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({action:'signup',email:'jamie@example.com',name:'Jamie',password:'test-password-only'})}));
 expect(response.status).toBe(503);expect((await response.json()).error).toContain(diagnostic);warning.mockRestore();
});

it('does not mistake a retryable Supabase HTTP 500 response for a connection failure',async()=>{
 const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
 signUp.mockResolvedValue({data:{session:null},error:{name:'AuthRetryableFetchError',status:500,message:'{}'}});
 const response=await POST(new Request('http://localhost:3000/api/auth',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({action:'signup',email:'jamie@example.com',name:'Jamie',password:'test-password-only'})}));
 expect(response.status).toBe(503);const result=await response.json();expect(result.error).toContain('auth_server_error');expect(result.error).not.toContain('could not reach');warning.mockRestore();
});

it.each([
 ['bad_code_verifier','browser'],
 ['flow_state_not_found','browser'],
 ['flow_state_expired','expired']
])('provides a safe recovery reason for callback error %s',async(code,reason)=>{
 const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
 exchangeCodeForSession.mockResolvedValue({error:{code,status:400,message:'private provider payload'}});
 const response=await GET(new Request('http://localhost:3000/api/auth/callback?code=secret-code&next=https://unrelated.example'));
 expect(response.headers.get('location')).toBe('http://localhost:3000/account?error=auth&reason='+reason);expect(JSON.stringify(warning.mock.calls)).not.toContain('secret-code');warning.mockRestore();
});
it('handles an expired email redirect without trying to exchange a missing code',async()=>{
 const response=await GET(new Request('http://localhost:3000/api/auth/callback?error=access_denied&error_code=otp_expired'));
 expect(exchangeCodeForSession).not.toHaveBeenCalled();expect(response.headers.get('location')).toBe('http://localhost:3000/account?error=auth&reason=expired');
});
