import { useId } from 'react';
import type { Activity } from '@/lib/types';

const palettes: Record<string, { sky: string; ground: string; accent: string }> = {
  games: { sky: '#d9c9ed', ground: '#b5a1d1', accent: '#785a9f' },
  walk: { sky: '#d5eadd', ground: '#a8c499', accent: '#4f8066' },
  picnic: { sky: '#f7dfb0', ground: '#c2d4a3', accent: '#bf755e' },
  coffee: { sky: '#f2cdbb', ground: '#dba18b', accent: '#ad6755' },
  creative: { sky: '#cce4ef', ground: '#a7cad9', accent: '#5d88a3' },
  movie: { sky: '#c9c1e5', ground: '#9185b8', accent: '#594777' },
  sports: { sky: '#d0e6f1', ground: '#a8c999', accent: '#4e7f62' },
  relax: { sky: '#f0daba', ground: '#d6bf96', accent: '#8c7651' },
};

function Plant({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d="M0 20V-90M0-35L-34-65M0-15L33-52" fill="none" stroke="#446b50" strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="-24" cy="-75" rx="14" ry="29" transform="rotate(-43 -24 -75)" fill="#729675" />
    <ellipse cx="24" cy="-56" rx="13" ry="26" transform="rotate(42 24 -56)" fill="#8da97b" />
    <ellipse cx="4" cy="-99" rx="14" ry="25" transform="rotate(12 4 -99)" fill="#527f60" />
    <path d="M-31 9H31L24 63H-23Z" fill="#d99778" /><path d="M-35 7H35V19H-35Z" fill="#eab499" />
  </g>;
}
function Mug({ x, y, color = '#fff5e4', rotate = 0 }: { x: number; y: number; color?: string; rotate?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
    <ellipse cy="48" rx="65" ry="14" fill="#6b493a" opacity=".12" />
    <path d="M38-12C82-26 82 44 42 28" fill="none" stroke={color} strokeWidth="14" />
    <path d="M-47-23H47L40 38Q0 67-40 38Z" fill={color} />
    <ellipse cy="-23" rx="47" ry="16" fill="#fffbef" /><ellipse cy="-23" rx="38" ry="10" fill="#976e52" />
    <path d="M-9-27Q-1-39 11-30Q19-22 2-15Q-16-22-9-27" fill="#ead3af" />
    <path d="M-14-55C-28-69 3-79-6-94M15-54C2-65 33-78 20-89" stroke="#fffaf1" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".8" />
  </g>;
}
function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M0 0V-150" stroke="#716c47" strokeWidth="13" strokeLinecap="round" /><ellipse cy="-132" rx="58" ry="83" fill="#82a47b" /><ellipse cx="-18" cy="-157" rx="34" ry="51" fill="#96b38a" /><path d="M0-44V-126M0-67L-23-91M0-93L21-116" stroke="#607f55" strokeWidth="4" fill="none" strokeLinecap="round" /></g>;
}

/** Original vector scenes, bundled with the app: no external image requests. */
export default function ActivityScene({ activity, compact = false }: { activity: Pick<Activity, 'id' | 'name' | 'category'>; compact?: boolean }) {
  const id = useId().replace(/:/g, '');
  const p = palettes[activity.id] ?? palettes.relax;
  return <div className={`activity-scene scene-${activity.id} ${compact ? 'scene-compact' : ''}`}>
    <svg viewBox="0 0 800 360" role="img" aria-label={`Illustration of ${activity.name.toLowerCase()}`} preserveAspectRatio="xMidYMid slice">
      <defs><pattern id={`${id}-dots`} width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r=".8" fill="#fff" opacity=".28" /></pattern><filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="7" stdDeviation="6" floodColor={p.accent} floodOpacity=".15" /></filter></defs>
      <rect width="800" height="360" fill={p.sky} /><circle cx="690" cy="55" r="145" fill="#fffaf0" opacity=".24" /><circle cx="80" cy="360" r="160" fill="#fffaf0" opacity=".2" /><rect width="800" height="360" fill={`url(#${id}-dots)`} />
      {activity.id === 'games' && <>
        <ellipse cx="400" cy="307" rx="282" ry="33" fill={p.ground} />
        <g transform="translate(405 204) rotate(-9)" filter={`url(#${id}-shadow)`}><rect x="-150" y="-100" width="300" height="198" rx="14" fill="#f8edd6" /><rect x="-127" y="-78" width="254" height="154" rx="5" fill="#d9ba8c" />{Array.from({ length: 6 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + c) % 2 === 0 && <rect key={`${r}-${c}`} x={-126 + c * 31.5} y={-77 + r * 25.5} width="31.5" height="25.5" fill="#9fae91" />))}<circle cx="-80" cy="-38" r="17" fill="#84619f" /><circle cx="48" cy="14" r="17" fill="#84619f" /><circle cx="78" cy="-38" r="17" fill="#d7806b" /><circle cx="-16" cy="39" r="17" fill="#d7806b" /></g>
        <g transform="translate(182 213) rotate(-19)"><rect x="-37" y="-59" width="75" height="111" rx="9" fill="#a07aba" stroke="#f5ebfc" strokeWidth="7" /><path d="M0-28L20 0 0 28-20 0Z" fill="#e7d5f4" /></g>
        <g transform="translate(591 235) rotate(13)"><rect width="58" height="58" rx="12" fill="#fffaf0" />{[[15,15],[42,15],[29,29],[15,42],[42,42]].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="#83619c" />)}</g>
        <path d="M612 78v26m-13-13h26M152 101v18m-9-9h18" stroke="#8868a7" strokeWidth="4" strokeLinecap="round" />
      </>}
      {activity.id === 'walk' && <>
        <circle cx="563" cy="78" r="43" fill="#f8dda1" /><path d="M0 255Q180 115 392 234T800 216V360H0Z" fill="#a3c19c" /><path d="M0 300Q185 203 420 277T800 260V360H0Z" fill="#83a885" /><path d="M457 216Q328 274 470 360H660Q396 267 491 217Z" fill="#efdeb8" />
        <Tree x={219} y={297} scale={1.05} /><Tree x={634} y={280} scale={.82} /><Tree x={103} y={274} scale={.55} />
        <g transform="translate(413 261)"><circle cy="-41" r="11" fill="#ba8868" /><path d="M-12-26H10L18 12H-19Z" fill="#a28bbc" /><path d="M-8 12L-16  40" fill="none" /><path d="M-8 12L-18 40M8 12L20 38" stroke="#536850" strokeWidth="9" strokeLinecap="round" /></g>
        <g transform="translate(470 278)"><circle cy="-41" r="10" fill="#805b45" /><path d="M-12-26H10L15 9H-15Z" fill="#edbb7d" /><path d="M-6 9L-12 34M6 9L15 32" stroke="#6a6556" strokeWidth="8" strokeLinecap="round" /></g>
        <path d="M331 83q9-10 18 0q9-10 18 0" stroke="#719b88" strokeWidth="3" fill="none" />
      </>}
      {activity.id === 'picnic' && <>
        <path d="M0 225Q195 158 430 217T800 190V360H0Z" fill={p.ground} /><Tree x={115} y={285} scale={.85} /><circle cx="641" cy="79" r="44" fill="#f8c978" />
        <g transform="translate(405 266) rotate(-6)"><path d="M-172-58H144L213 75H-211Z" fill="#f6eee0" /><path d="M-148-39H157M-175 6H181M-198 52H205M-113-58L-134 75M-30-58L-33 75M54-58L73 75M125-58L177 75" stroke="#cf887d" strokeWidth="14" opacity=".7" /></g>
        <g transform="translate(384 214)"><path d="M-51-11Q-49-104 45-12" fill="none" stroke="#956a42" strokeWidth="10" /><path d="M-72-16H72L59 55H-59Z" fill="#b88a51" /><path d="M-57 3H58M-52 20H53M-47 37H48" stroke="#d8b479" strokeWidth="6" /><path d="M-34-15V55M0-15V55M34-15V55" stroke="#a57747" strokeWidth="5" /><path d="M-69-19L-33-12-13 23 13-13 67-18" fill="#fff1d8" /></g>
        <ellipse cx="543" cy="270" rx="43" ry="18" fill="#fff9eb" /><path d="M514 264L558 265 538 240Z" fill="#d97d69" /><path d="M514 267H558" stroke="#719065" strokeWidth="5" /><circle cx="250" cy="268" r="17" fill="#d18e67" /><path d="M250 250l8-11" stroke="#65815a" strokeWidth="4" />
      </>}
      {activity.id === 'coffee' && <>
        <rect x="171" y="37" width="198" height="179" rx="70" fill="#f7e5d2" /><path d="M271 38v178M172 126h197" stroke="#dfb293" strokeWidth="7" /><path d="M188 187Q236 128 267 162T351 161V211H188Z" fill="#b5bd91" />
        <ellipse cx="424" cy="294" rx="260" ry="45" fill={p.ground} /><ellipse cx="416" cy="278" rx="249" ry="52" fill="#dcb793" />
        <Mug x={352} y={227} color="#f9efdf" rotate={-8} /><Mug x={519} y={244} color="#9aaf98" rotate={9} /><Plant x={640} y={162} scale={.85} />
        <ellipse cx="227" cy="283" rx="38" ry="12" fill="#fff0d8" /><ellipse cx="227" cy="278" rx="26" ry="13" fill="#bd8a51" /><path d="M212 273l5 8m8-14 3 11m10-6 3 9" stroke="#91683f" strokeWidth="3" strokeLinecap="round" />
      </>}
      {activity.id === 'creative' && <>
        <ellipse cx="410" cy="309" rx="286" ry=" 30" fill={p.ground} />
        <g transform="translate(394 202) rotate(-8)" filter={`url(#${id}-shadow)`}><rect x="-142" y="-116" width="285" height="229" rx="7" fill="#fff9e8" /><circle cx="68" cy="-54" r="29" fill="#e8b968" /><path d="M-119 53Q-52-57 8 29T121 5V86H-119Z" fill="#a2bd95" /><path d="M-119  80Q-14 10 121 57V 90H-119Z" fill="#6d9b8b" /></g>
        <g transform="translate(185 247)"><path d="M-27-20L-5-84M-4-19L19-93M18-19L37-75" stroke="#c39265" strokeWidth="9" strokeLinecap="round" /><path d="M-6-84l8-20M20-93l6-19M37-75l9-20" stroke="#6d769c" strokeWidth="11" strokeLinecap="round" /><path d="M-40-24H40L 30 42H-30Z" fill="#c68c76" /></g>
        <g transform="translate(585 248) rotate(12)"><ellipse rx="64" ry=" 40" fill="#f6deb7" /><ellipse cx="-29" cy="-3" rx="13" ry="10" fill={p.ground} /><circle cx="-5" cy="-22" r="10" fill="#a081b7" /><circle cx="24" cy="-15" r="10" fill="#d78c78" /><circle cx="42" cy="7" r="10" fill="#779d89" /><circle cx="15" cy="21" r="10" fill="#dfb665" /></g>
        <path d="M537  90L614 172" stroke="#d0a377" strokeWidth="9" strokeLinecap="round" /><path d="M614 172l17 19" stroke="#7991a6" strokeWidth="12" strokeLinecap="round" />
      </>}
      {activity.id === 'movie' && <>
        <circle cx="641" cy="81" r="38" fill="#f7e3ba" /><circle cx="658" cy="67" r="34" fill={p.sky} /><path d="M184 61v14m-7-7h14M590 145v13m-6-6h12M727 128v10m-5-5h10" stroke="#f9eed9" strokeWidth="3" strokeLinecap="round" />
        <rect x="231" y="61" width="335" height="193" rx="12" fill="#605376" /><rect x="244" y="74" width="309" height="166" rx="5" fill="#e2d5ed" /><path d="M244 202L319 124 380 179 441 116 553 201V240H244Z" fill="#b5a8c6" /><circle cx="491" cy="112" r="19" fill="#f6d59b" /><path d="M382 123L382 187 432 155Z" fill="#fff8e9" /><path d="M399 254v20m-52 1h104" stroke="#675875" strokeWidth="9" strokeLinecap="round" />
        <path d="M178 285Q178 263 202 263H594Q620 263 620 287V340H178Z" fill="#9e84b6" /><rect x="158" y="286" width="59" height="63" rx="17" fill="#b59aca" /><rect x="582" y="286" width="59" height="63" rx="17" fill="#b59aca" />
        <g transform="translate(625 241)"><path d="M-30-25H30L22 42H-22Z" fill="#fbecd4" /><path d="M-16-25L-12 42M4-25L3 42M23-25L17 42" stroke="#d49087" strokeWidth="9" />{[[-20,-27],[0,-33],[20,-27],[-12,-43],[12,-44]].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="13" fill="#fff3cf" />)}</g>
      </>}
      {activity.id === 'sports' && <>
        <circle cx="181" cy="78" r=" 40" fill="#f9e0a4" /><path d="M0 233Q179 159 376 213T800 204V360H0Z" fill="#afcda0" /><path d="M0 277Q327 213 800 260V360H0Z" fill="#8fb685" /><path d="M192 342L261 237H550L646 342M252 274H581" stroke="#ecf3d9" strokeWidth="4" fill="none" opacity=".8" />
        <g transform="translate(473 134)"><path d="M-109 114V0H109V114" stroke="#f7f7e9" strokeWidth="9" fill="none" /><path d="M-106 23H106M-106 48H106M-106 73H106M-106 97H106M-79 0V114M-53 0V114M-27 0V114M0 0V114M27 0V114M53 0V114M79 0V114" stroke="#edf5df" strokeWidth="2" fill="none" opacity=".7" /></g>
        <ellipse cx="338" cy="315" rx=" 60" ry="13" fill="#6b9767" /><circle cx="337" cy="264" r="49" fill="#faf2db" /><path d="M321 246L346 241 363 261 351 284 327 282 314 264Z" fill="#75899b" /><path d="M296 241L310 223 321 230 318 245ZM370 231L382 247 374 257 361 245ZM322 308L309 292 321 285 336 300ZM370 293L365 280 378 271 386 280Z" fill="#75899b" /><Tree x={686} y={267} scale={.64} />
      </>}
      {(!palettes[activity.id] || activity.id === 'relax') && <>
        <rect x="186" y="51" width="150" height="168" rx="65" fill="#fbefcf" /><path d="M261 51v168M186 139h150" stroke="#d1b996" strokeWidth="6" /><Plant x={628} y={177} scale={1.1} />
        <ellipse cx="409" cy="320" rx="224" ry="25" fill={p.ground} /><path d="M257 157Q257 115 310 115H463Q509 115 509 161V286H257Z" fill="#96afa0" /><rect x="238" y="210" width=" 50" height=" 90" rx="22" fill="#729487" /><rect x="481" y="210" width=" 50" height=" 90" rx="22" fill="#729487" /><path d="M266 287v35m238-35v35" stroke="#947657" strokeWidth="11" strokeLinecap="round" />
        <g transform="translate(381 206) rotate(-6)"><path d="M0-25Q-35-45-73-28V45Q-35 27 0 48Q35 27 73 45V-28Q35-45 0-25Z" fill="#fff4d9" /><path d="M0-25V47M-59-14L-14-6M-59 1L-14 9M-59 16L-14 24M14-6L59-14M14 9L59 1M14 24L59 16" stroke="#cbb991" strokeWidth="3" fill="none" /></g>
        <Mug x={589} y={285} color="#b992ab" />
      </>}
    </svg>
    <span className="scene-category">{activity.category}</span>
  </div>;
}
