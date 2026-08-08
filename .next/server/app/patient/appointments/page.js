(()=>{var e={};e.id=723,e.ids=[723],e.modules={2934:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},4770:e=>{"use strict";e.exports=require("crypto")},665:e=>{"use strict";e.exports=require("dns")},7702:e=>{"use strict";e.exports=require("events")},2048:e=>{"use strict";e.exports=require("fs")},2615:e=>{"use strict";e.exports=require("http")},2694:e=>{"use strict";e.exports=require("http2")},8216:e=>{"use strict";e.exports=require("net")},9801:e=>{"use strict";e.exports=require("os")},5315:e=>{"use strict";e.exports=require("path")},5816:e=>{"use strict";e.exports=require("process")},6162:e=>{"use strict";e.exports=require("stream")},4026:e=>{"use strict";e.exports=require("string_decoder")},2452:e=>{"use strict";e.exports=require("tls")},7360:e=>{"use strict";e.exports=require("url")},1764:e=>{"use strict";e.exports=require("util")},1568:e=>{"use strict";e.exports=require("zlib")},8061:e=>{"use strict";e.exports=require("node:assert")},2761:e=>{"use strict";e.exports=require("node:async_hooks")},2254:e=>{"use strict";e.exports=require("node:buffer")},27:e=>{"use strict";e.exports=require("node:console")},6005:e=>{"use strict";e.exports=require("node:crypto")},5714:e=>{"use strict";e.exports=require("node:diagnostics_channel")},5673:e=>{"use strict";e.exports=require("node:events")},8849:e=>{"use strict";e.exports=require("node:http")},2725:e=>{"use strict";e.exports=require("node:http2")},7503:e=>{"use strict";e.exports=require("node:net")},8846:e=>{"use strict";e.exports=require("node:perf_hooks")},5815:e=>{"use strict";e.exports=require("node:querystring")},4492:e=>{"use strict";e.exports=require("node:stream")},9516:e=>{"use strict";e.exports=require("node:tls")},1041:e=>{"use strict";e.exports=require("node:url")},7261:e=>{"use strict";e.exports=require("node:util")},3746:e=>{"use strict";e.exports=require("node:util/types")},4086:e=>{"use strict";e.exports=require("node:worker_threads")},5628:e=>{"use strict";e.exports=require("node:zlib")},7050:(e,t,s)=>{"use strict";s.r(t),s.d(t,{GlobalError:()=>o.a,__next_app__:()=>u,originalPathname:()=>c,pages:()=>l,routeModule:()=>m,tree:()=>p}),s(2716),s(7764),s(5866);var i=s(3191),r=s(8716),n=s(7922),o=s.n(n),a=s(5231),d={};for(let e in a)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(d[e]=()=>a[e]);s.d(t,d);let p=["",{children:["patient",{children:["appointments",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(s.bind(s,2716)),"/workspaces/telemed/app/patient/appointments/page.js"]}]},{}]},{}]},{layout:[()=>Promise.resolve().then(s.bind(s,7764)),"/workspaces/telemed/app/layout.js"],"not-found":[()=>Promise.resolve().then(s.t.bind(s,5866,23)),"next/dist/client/components/not-found-error"]}],l=["/workspaces/telemed/app/patient/appointments/page.js"],c="/patient/appointments/page",u={require:s,loadChunk:()=>Promise.resolve()},m=new i.AppPageRouteModule({definition:{kind:r.x.APP_PAGE,page:"/patient/appointments/page",pathname:"/patient/appointments",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:p}})},4934:(e,t,s)=>{Promise.resolve().then(s.bind(s,4602))},3194:(e,t,s)=>{Promise.resolve().then(s.t.bind(s,2994,23)),Promise.resolve().then(s.t.bind(s,6114,23)),Promise.resolve().then(s.t.bind(s,9727,23)),Promise.resolve().then(s.t.bind(s,9671,23)),Promise.resolve().then(s.t.bind(s,1868,23)),Promise.resolve().then(s.t.bind(s,4759,23))},5303:()=>{},4602:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>m});var i=s(326),r=s(7577),n=s(5047),o=s(76),a=s(1552),d=s(9264),p=s(780),l=s(3801),c=s(1551);let u=["image/png","image/jpeg","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];function m(){let{user:e,role:t,loading:s}=(0,p.a)(),{profile:m,loadingProfile:x}=(0,l.G)(e),g=(0,n.useRouter)(),[h,v]=(0,r.useState)([]),[f,b]=(0,r.useState)(!0),[y,q]=(0,r.useState)(""),[j,w]=(0,r.useState)(null),[P,$]=(0,r.useState)({});async function S(e,t){let s=t.target.files?.[0];if(t.target.value="",s){if($(t=>({...t,[e]:""})),!u.includes(s.type)){$(t=>({...t,[e]:"Only PNG, JPG, PDF, or Word documents are allowed."}));return}if(s.size>10485760){$(t=>({...t,[e]:"File must be under 10MB."}));return}w(e);try{let t=`appointments/${e}/${Date.now()}_${s.name}`,i=(0,a.iH)(d.tO,t);await (0,a.KV)(i,s);let r=await (0,a.Jt)(i),n={name:s.name,url:r,uploadedAt:new Date().toISOString()};await (0,o.r7)((0,o.JU)(d.db,"appointments",e),{attachments:(0,o.vr)(n)}),v(t=>t.map(t=>t.id===e?{...t,attachments:[...t.attachments||[],n]}:t))}catch(t){console.error(t),$(t=>({...t,[e]:"Upload failed. Please try again."}))}finally{w(null)}}}return s||x||!e||m&&!m.profileComplete?i.jsx("main",{style:{padding:24},children:"Loading..."}):(0,i.jsxs)("main",{style:{padding:24},children:[i.jsx("h1",{children:"Your appointments"}),f&&i.jsx("p",{children:"Loading..."}),y&&i.jsx("p",{style:{color:"red"},children:y}),!f&&!y&&0===h.length&&i.jsx("p",{children:"No appointments booked yet. Head back to find a doctor."}),h.map(e=>(0,i.jsxs)("div",{style:{border:"1px solid #ddd",borderRadius:8,padding:16,marginBottom:12},children:[i.jsx("p",{style:{margin:"0 0 4px"},children:i.jsx("strong",{children:e.doctorName})}),i.jsx("p",{style:{margin:"0 0 8px",color:"#666"},children:e.startTime?.toDate().toLocaleString()}),(0,i.jsxs)("div",{style:{display:"flex",gap:8},children:[i.jsx("button",{onClick:()=>g.push(`/call?appointmentId=${e.id}&mode=video`),children:"Video call"}),i.jsx("button",{onClick:()=>g.push(`/call?appointmentId=${e.id}&mode=voice`),children:"Voice call"})]}),e.notes&&(0,i.jsxs)("div",{style:{marginTop:12,padding:12,background:"#f7f7f7",borderRadius:6},children:[i.jsx("p",{style:{margin:"0 0 4px",fontSize:14,color:"#666"},children:"Visit notes"}),i.jsx("p",{style:{margin:0,whiteSpace:"pre-wrap"},children:e.notes})]}),e.prescription?.medications&&(0,i.jsxs)("div",{style:{marginTop:12,padding:12,background:"#f7f7f7",borderRadius:6},children:[i.jsx("p",{style:{margin:"0 0 4px",fontSize:14,color:"#666"},children:"Prescription"}),e.prescription.diagnosis&&(0,i.jsxs)("p",{style:{margin:"0 0 4px"},children:[i.jsx("strong",{children:"Diagnosis:"})," ",e.prescription.diagnosis]}),i.jsx("p",{style:{margin:"0 0 8px",whiteSpace:"pre-wrap"},children:e.prescription.medications}),i.jsx("button",{onClick:()=>(0,c.f)({...e.prescription,patientName:e.patientName}),children:"Print"})]}),e.investigationRequest?.testsRequested&&(0,i.jsxs)("div",{style:{marginTop:12,padding:12,background:"#f7f7f7",borderRadius:6},children:[(0,i.jsxs)("p",{style:{margin:"0 0 4px",fontSize:14,color:"#666"},children:["Investigation request","urgent"===e.investigationRequest.urgency&&i.jsx("span",{style:{color:"red",fontWeight:"bold"},children:" — URGENT"})]}),i.jsx("p",{style:{margin:"0 0 8px",whiteSpace:"pre-wrap"},children:e.investigationRequest.testsRequested}),i.jsx("button",{onClick:()=>(0,c.r)({...e.investigationRequest,patientName:e.patientName}),children:"Print"})]}),(0,i.jsxs)("div",{style:{marginTop:12},children:[i.jsx("label",{style:{display:"block",marginBottom:4,fontSize:14,color:"#666"},children:"Attach a file for the doctor (PNG, JPG, PDF, or Word — max 10MB)"}),i.jsx("input",{type:"file",accept:".png,.jpg,.jpeg,.pdf,.doc,.docx",disabled:j===e.id,onChange:t=>S(e.id,t)}),j===e.id&&i.jsx("p",{style:{margin:"4px 0",fontSize:14},children:"Uploading..."}),P[e.id]&&i.jsx("p",{style:{margin:"4px 0",fontSize:14,color:"red"},children:P[e.id]}),e.attachments?.length>0&&i.jsx("ul",{style:{marginTop:8,paddingLeft:20},children:e.attachments.map((e,t)=>i.jsx("li",{children:i.jsx("a",{href:e.url,target:"_blank",rel:"noopener noreferrer",children:e.name})},t))})]})]},e.id))]})}},9264:(e,t,s)=>{"use strict";s.d(t,{I8:()=>p,db:()=>l,tO:()=>c,wk:()=>u});var i=s(2585),r=s(6791),n=s(76),o=s(1552),a=s(8470);let d=(0,i.C6)().length?(0,i.C6)()[0]:(0,i.ZF)({apiKey:"AIzaSyBhAYAfRgKuGZZU3Naiq5roTlURHX1T3xQ",authDomain:"telemedmgr.firebaseapp.com",projectId:"telemedmgr",storageBucket:"telemedmgr.firebasestorage.app",messagingSenderId:"955425320820",appId:"1:955425320820:web:250cb6ce3bed7ee5c6c621"}),p=(0,r.v0)(d),l=(0,n.ad)(d),c=(0,o.cF)(d),u=(0,a.$C)(d)},1551:(e,t,s)=>{"use strict";function i(e,t){let s=window.open("","_blank","width=800,height=900");if(!s){alert("Please allow pop-ups to print this document.");return}s.document.write(`
    <html>
      <head>
        <title>${e}</title>
        <style>
          body { font-family: Georgia, serif; padding: 40px; color: #111; max-width: 640px; margin: 0 auto; }
          .brand { font-size: 14px; letter-spacing: 1px; text-transform: uppercase; color: #666; margin-bottom: 4px; }
          h1 { font-size: 22px; margin: 0 0 20px; border-bottom: 2px solid #111; padding-bottom: 12px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px; }
          .meta { margin-bottom: 24px; }
          .section { margin-bottom: 20px; }
          .section-label { font-size: 12px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .section-content { white-space: pre-wrap; font-size: 15px; line-height: 1.5; }
          .signature { margin-top: 56px; }
          .signature-line { border-top: 1px solid #333; width: 260px; padding-top: 6px; font-size: 14px; }
          .urgent { color: #b91c1c; font-weight: bold; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>${t}</body>
    </html>
  `),s.document.close(),s.focus(),s.print()}function r(e){return e?("function"==typeof e.toDate?e.toDate():new Date(e)).toLocaleDateString(void 0,{year:"numeric",month:"long",day:"numeric"}):""}function n({doctorName:e,specialty:t,licenseNumber:s,patientName:n,diagnosis:o,medications:a,issuedAt:d}){i("Prescription",`
    <div class="brand">Telemed</div>
    <h1>Prescription</h1>
    <div class="meta">
      <div class="row"><span>Patient</span><span>${n||"—"}</span></div>
      <div class="row"><span>Date</span><span>${r(d)}</span></div>
      <div class="row"><span>Prescribing doctor</span><span>Dr. ${e||"—"}${t?`, ${t}`:""}</span></div>
      <div class="row"><span>License / registration no.</span><span>${s||"—"}</span></div>
    </div>
    ${o?`
    <div class="section">
      <div class="section-label">Diagnosis</div>
      <div class="section-content">${o}</div>
    </div>`:""}
    <div class="section">
      <div class="section-label">Rx — Medications</div>
      <div class="section-content">${a||"—"}</div>
    </div>
    <div class="signature">
      <div class="signature-line">Dr. ${e||""}</div>
    </div>
  `)}function o({doctorName:e,specialty:t,licenseNumber:s,patientName:n,clinicalNotes:o,testsRequested:a,urgency:d,issuedAt:p}){i("Investigation Request",`
    <div class="brand">Telemed</div>
    <h1>Investigation Request</h1>
    <div class="meta">
      <div class="row"><span>Patient</span><span>${n||"—"}</span></div>
      <div class="row"><span>Date</span><span>${r(p)}</span></div>
      <div class="row"><span>Requesting doctor</span><span>Dr. ${e||"—"}${t?`, ${t}`:""}</span></div>
      <div class="row"><span>License / registration no.</span><span>${s||"—"}</span></div>
      <div class="row"><span>Urgency</span><span class="${"urgent"===d?"urgent":""}">${"urgent"===d?"URGENT":"Routine"}</span></div>
    </div>
    ${o?`
    <div class="section">
      <div class="section-label">Clinical notes / provisional diagnosis</div>
      <div class="section-content">${o}</div>
    </div>`:""}
    <div class="section">
      <div class="section-label">Tests requested</div>
      <div class="section-content">${a||"—"}</div>
    </div>
    <div class="signature">
      <div class="signature-line">Dr. ${e||""}</div>
    </div>
  `)}s.d(t,{f:()=>n,r:()=>o})},780:(e,t,s)=>{"use strict";s.d(t,{a:()=>r});var i=s(7577);function r(){let[e,t]=(0,i.useState)(null),[s,r]=(0,i.useState)(null),[n,o]=(0,i.useState)(!0);return{user:e,role:s,loading:n}}s(6791),s(76),s(9264)},3801:(e,t,s)=>{"use strict";s.d(t,{G:()=>r});var i=s(7577);function r(e){let[t,s]=(0,i.useState)(null),[r,n]=(0,i.useState)(!0);return{profile:t,loadingProfile:r}}s(76),s(9264)},7764:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>n,metadata:()=>r});var i=s(9510);let r={title:"Telemed",description:"Book and video-call a doctor"};function n({children:e}){return i.jsx("html",{lang:"en",children:i.jsx("body",{style:{fontFamily:"sans-serif",margin:0},children:e})})}},2716:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>i});let i=(0,s(8570).createProxy)(String.raw`/workspaces/telemed/app/patient/appointments/page.js#default`)}};var t=require("../../../webpack-runtime.js");t.C(e);var s=e=>t(t.s=e),i=t.X(0,[819,124],()=>s(7050));module.exports=i})();