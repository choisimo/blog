import{r as d,R as jt,a as Je,b as oe,c as $n}from"./vendor-D7jv_ly0.js";var It={exports:{}},Se={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Bn=d,Wn=Symbol.for("react.element"),Un=Symbol.for("react.fragment"),Kn=Object.prototype.hasOwnProperty,Xn=Bn.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,Yn={key:!0,ref:!0,__self:!0,__source:!0};function zt(e,t,n){var o,r={},s=null,a=null;n!==void 0&&(s=""+n),t.key!==void 0&&(s=""+t.key),t.ref!==void 0&&(a=t.ref);for(o in t)Kn.call(t,o)&&!Yn.hasOwnProperty(o)&&(r[o]=t[o]);if(e&&e.defaultProps)for(o in t=e.defaultProps,t)r[o]===void 0&&(r[o]=t[o]);return{$$typeof:Wn,type:e,key:s,ref:a,props:r,_owner:Xn.current}}Se.Fragment=Un;Se.jsx=zt;Se.jsxs=zt;It.exports=Se;var M=It.exports;function wt(e,t){if(typeof e=="function")return e(t);e!=null&&(e.current=t)}function Ft(...e){return t=>{let n=!1;const o=e.map(r=>{const s=wt(r,t);return!n&&typeof s=="function"&&(n=!0),s});if(n)return()=>{for(let r=0;r<o.length;r++){const s=o[r];typeof s=="function"?s():wt(e[r],null)}}}}function B(...e){return d.useCallback(Ft(...e),e)}function Ee(e){const t=Zn(e),n=d.forwardRef((o,r)=>{const{children:s,...a}=o,c=d.Children.toArray(s),l=c.find(Qn);if(l){const i=l.props.children,u=c.map(p=>p===l?d.Children.count(i)>1?d.Children.only(null):d.isValidElement(i)?i.props.children:null:p);return M.jsx(t,{...a,ref:r,children:d.isValidElement(i)?d.cloneElement(i,void 0,u):null})}return M.jsx(t,{...a,ref:r,children:s})});return n.displayName=`${e}.Slot`,n}var Ds=Ee("Slot");function Zn(e){const t=d.forwardRef((n,o)=>{const{children:r,...s}=n;if(d.isValidElement(r)){const a=eo(r),c=Jn(s,r.props);return r.type!==d.Fragment&&(c.ref=o?Ft(o,a):a),d.cloneElement(r,c)}return d.Children.count(r)>1?d.Children.only(null):null});return t.displayName=`${e}.SlotClone`,t}var Ht=Symbol("radix.slottable");function Gn(e){const t=({children:n})=>M.jsx(M.Fragment,{children:n});return t.displayName=`${e}.Slottable`,t.__radixId=Ht,t}function Qn(e){return d.isValidElement(e)&&typeof e.type=="function"&&"__radixId"in e.type&&e.type.__radixId===Ht}function Jn(e,t){const n={...t};for(const o in t){const r=e[o],s=t[o];/^on[A-Z]/.test(o)?r&&s?n[o]=(...c)=>{const l=s(...c);return r(...c),l}:r&&(n[o]=r):o==="style"?n[o]={...r,...s}:o==="className"&&(n[o]=[r,s].filter(Boolean).join(" "))}return{...e,...n}}function eo(e){var o,r;let t=(o=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:o.get,n=t&&"isReactWarning"in t&&t.isReactWarning;return n?e.ref:(t=(r=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:r.get,n=t&&"isReactWarning"in t&&t.isReactWarning,n?e.props.ref:e.props.ref||e.ref)}/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const to=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),Vt=(...e)=>e.filter((t,n,o)=>!!t&&t.trim()!==""&&o.indexOf(t)===n).join(" ").trim();/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var no={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oo=d.forwardRef(({color:e="currentColor",size:t=24,strokeWidth:n=2,absoluteStrokeWidth:o,className:r="",children:s,iconNode:a,...c},l)=>d.createElement("svg",{ref:l,...no,width:t,height:t,stroke:e,strokeWidth:o?Number(n)*24/Number(t):n,className:Vt("lucide",r),...c},[...a.map(([i,u])=>d.createElement(i,u)),...Array.isArray(s)?s:[s]]));/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=(e,t)=>{const n=d.forwardRef(({className:o,...r},s)=>d.createElement(oo,{ref:s,iconNode:t,className:Vt(`lucide-${to(e)}`,o),...r}));return n.displayName=`${e}`,n};/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ns=f("Activity",[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",key:"169zse"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _s=f("ArrowDown",[["path",{d:"M12 5v14",key:"s699le"}],["path",{d:"m19 12-7 7-7-7",key:"1idqje"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const js=f("ArrowLeft",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Is=f("ArrowRight",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zs=f("ArrowUp",[["path",{d:"m5 12 7-7 7 7",key:"hav0vg"}],["path",{d:"M12 19V5",key:"x0mq9r"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fs=f("Bell",[["path",{d:"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",key:"1qo2s2"}],["path",{d:"M10.3 21a1.94 1.94 0 0 0 3.4 0",key:"qgo35s"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Hs=f("BookDashed",[["path",{d:"M12 17h2",key:"13u4lk"}],["path",{d:"M12 22h2",key:"kn7ki6"}],["path",{d:"M12 2h2",key:"cvn524"}],["path",{d:"M18 22h1a1 1 0 0 0 1-1",key:"w6gbqz"}],["path",{d:"M18 2h1a1 1 0 0 1 1 1v1",key:"1vpra5"}],["path",{d:"M20 15v2h-2",key:"fph276"}],["path",{d:"M20 8v3",key:"deu0bs"}],["path",{d:"M4 11V9",key:"v3xsx8"}],["path",{d:"M4 19.5V15",key:"6gr39e"}],["path",{d:"M4 5v-.5A2.5 2.5 0 0 1 6.5 2H8",key:"wywhs9"}],["path",{d:"M8 22H6.5a1 1 0 0 1 0-5H8",key:"1cu73q"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vs=f("BookOpenText",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M16 12h2",key:"7q9ll5"}],["path",{d:"M16 8h2",key:"msurwy"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}],["path",{d:"M6 12h2",key:"32wvfc"}],["path",{d:"M6 8h2",key:"30oboj"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qs=f("BookOpen",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $s=f("BookmarkCheck",[["path",{d:"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z",key:"169p4p"}],["path",{d:"m9 10 2 2 4-4",key:"1gnqz4"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Bs=f("Bookmark",[["path",{d:"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z",key:"1fy3hk"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ws=f("BotMessageSquare",[["path",{d:"M12 6V2H8",key:"1155em"}],["path",{d:"m8 18-4 4V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2Z",key:"w2lp3e"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M9 11v2",key:"1ueba0"}],["path",{d:"M15 11v2",key:"i11awn"}],["path",{d:"M20 12h2",key:"1q8mjw"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Us=f("Bot",[["path",{d:"M12 8V4H8",key:"hb8ula"}],["rect",{width:"16",height:"12",x:"4",y:"8",rx:"2",key:"enze0r"}],["path",{d:"M2 14h2",key:"vft8re"}],["path",{d:"M20 14h2",key:"4cs60a"}],["path",{d:"M15 13v2",key:"1xurst"}],["path",{d:"M9 13v2",key:"rq6x2g"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ks=f("BrainCircuit",[["path",{d:"M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",key:"l5xja"}],["path",{d:"M9 13a4.5 4.5 0 0 0 3-4",key:"10igwf"}],["path",{d:"M6.003 5.125A3 3 0 0 0 6.401 6.5",key:"105sqy"}],["path",{d:"M3.477 10.896a4 4 0 0 1 .585-.396",key:"ql3yin"}],["path",{d:"M6 18a4 4 0 0 1-1.967-.516",key:"2e4loj"}],["path",{d:"M12 13h4",key:"1ku699"}],["path",{d:"M12 18h6a2 2 0 0 1 2 2v1",key:"105ag5"}],["path",{d:"M12 8h8",key:"1lhi5i"}],["path",{d:"M16 8V5a2 2 0 0 1 2-2",key:"u6izg6"}],["circle",{cx:"16",cy:"13",r:".5",key:"ry7gng"}],["circle",{cx:"18",cy:"3",r:".5",key:"1aiba7"}],["circle",{cx:"20",cy:"21",r:".5",key:"yhc1fs"}],["circle",{cx:"20",cy:"8",r:".5",key:"1e43v0"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xs=f("Brain",[["path",{d:"M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",key:"l5xja"}],["path",{d:"M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z",key:"ep3f8r"}],["path",{d:"M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4",key:"1p4c4q"}],["path",{d:"M17.599 6.5a3 3 0 0 0 .399-1.375",key:"tmeiqw"}],["path",{d:"M6.003 5.125A3 3 0 0 0 6.401 6.5",key:"105sqy"}],["path",{d:"M3.477 10.896a4 4 0 0 1 .585-.396",key:"ql3yin"}],["path",{d:"M19.938 10.5a4 4 0 0 1 .585.396",key:"1qfode"}],["path",{d:"M6 18a4 4 0 0 1-1.967-.516",key:"2e4loj"}],["path",{d:"M19.967 17.484A4 4 0 0 1 18 18",key:"159ez6"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ys=f("Calendar",[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zs=f("ChartColumn",[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Gs=f("CheckCheck",[["path",{d:"M18 6 7 17l-5-5",key:"116fxf"}],["path",{d:"m22 10-7.5 7.5L13 16",key:"ke71qq"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qs=f("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Js=f("ChevronDown",[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ea=f("ChevronLeft",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ta=f("ChevronRight",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const na=f("ChevronUp",[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oa=f("ChevronsLeft",[["path",{d:"m11 17-5-5 5-5",key:"13zhaf"}],["path",{d:"m18 17-5-5 5-5",key:"h8a8et"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ra=f("ChevronsRight",[["path",{d:"m6 17 5-5-5-5",key:"xnjwq"}],["path",{d:"m13 17 5-5-5-5",key:"17xmmf"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sa=f("CircleAlert",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const aa=f("CircleCheckBig",[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ia=f("CircleCheck",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ca=f("CircleX",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const la=f("Circle",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const da=f("Clock3",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16.5 12",key:"1aq6pp"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ua=f("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fa=f("Cloud",[["path",{d:"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z",key:"p7xjir"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pa=f("CodeXml",[["path",{d:"m18 16 4-4-4-4",key:"1inbqp"}],["path",{d:"m6 8-4 4 4 4",key:"15zrgr"}],["path",{d:"m14.5 4-5 16",key:"e7oirm"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ha=f("Compass",[["path",{d:"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z",key:"9ktpf1"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ya=f("Copy",[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ma=f("CornerUpLeft",[["polyline",{points:"9 14 4 9 9 4",key:"881910"}],["path",{d:"M20 20v-7a4 4 0 0 0-4-4H4",key:"1nkjon"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xa=f("Cpu",[["rect",{width:"16",height:"16",x:"4",y:"4",rx:"2",key:"14l7u7"}],["rect",{width:"6",height:"6",x:"9",y:"9",rx:"1",key:"5aljv4"}],["path",{d:"M15 2v2",key:"13l42r"}],["path",{d:"M15 20v2",key:"15mkzm"}],["path",{d:"M2 15h2",key:"1gxd5l"}],["path",{d:"M2 9h2",key:"1bbxkp"}],["path",{d:"M20 15h2",key:"19e6y8"}],["path",{d:"M20 9h2",key:"19tzq7"}],["path",{d:"M9 2v2",key:"165o2o"}],["path",{d:"M9 20v2",key:"i2bqo8"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const va=f("Database",[["ellipse",{cx:"12",cy:"5",rx:"9",ry:"3",key:"msslwz"}],["path",{d:"M3 5V19A9 3 0 0 0 21 19V5",key:"1wlel7"}],["path",{d:"M3 12A9 3 0 0 0 21 12",key:"mv7ke4"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ka=f("DollarSign",[["line",{x1:"12",x2:"12",y1:"2",y2:"22",key:"7eqyqh"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",key:"1b0p4s"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ga=f("Dot",[["circle",{cx:"12.1",cy:"12.1",r:"1",key:"18d7e5"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wa=f("Download",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"7 10 12 15 17 10",key:"2ggqvy"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3",key:"1vk2je"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ba=f("Earth",[["path",{d:"M21.54 15H17a2 2 0 0 0-2 2v4.54",key:"1djwo0"}],["path",{d:"M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17",key:"1tzkfa"}],["path",{d:"M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05",key:"14pb5j"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ma=f("EllipsisVertical",[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"12",cy:"5",r:"1",key:"gxeob9"}],["circle",{cx:"12",cy:"19",r:"1",key:"lyex9k"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ca=f("Ellipsis",[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"19",cy:"12",r:"1",key:"1wjl8i"}],["circle",{cx:"5",cy:"12",r:"1",key:"1pcz8c"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ea=f("ExternalLink",[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ta=f("EyeOff",[["path",{d:"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",key:"ct8e1f"}],["path",{d:"M14.084 14.158a3 3 0 0 1-4.242-4.242",key:"151rxh"}],["path",{d:"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",key:"13bj9a"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pa=f("Eye",[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Aa=f("FileSearch",[["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M4.268 21a2 2 0 0 0 1.727 1H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3",key:"ms7g94"}],["path",{d:"m9 18-1.5-1.5",key:"1j6qii"}],["circle",{cx:"5",cy:"14",r:"3",key:"ufru5t"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ra=f("FileText",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sa=f("Filter",[["polygon",{points:"22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3",key:"1yg77f"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oa=f("FlaskConical",[["path",{d:"M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2",key:"pzvekw"}],["path",{d:"M8.5 2h7",key:"csnxdl"}],["path",{d:"M7 16h10",key:"wp8him"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const La=f("FolderKanban",[["path",{d:"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z",key:"1fr9dc"}],["path",{d:"M8 10v4",key:"tgpxqk"}],["path",{d:"M12 10v2",key:"hh53o1"}],["path",{d:"M16 10v6",key:"1d6xys"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Da=f("FolderOpen",[["path",{d:"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",key:"usdka0"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Na=f("Folder",[["path",{d:"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",key:"1kt360"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _a=f("GitBranch",[["line",{x1:"6",x2:"6",y1:"3",y2:"15",key:"17qcm7"}],["circle",{cx:"18",cy:"6",r:"3",key:"1h7g24"}],["circle",{cx:"6",cy:"18",r:"3",key:"fqmcym"}],["path",{d:"M18 9a9 9 0 0 1-9 9",key:"n2h4wq"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ja=f("Github",[["path",{d:"M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4",key:"tonef"}],["path",{d:"M9 18c-4.51 2-5-2-7-2",key:"9comsn"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ia=f("Globe",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",key:"13o1zl"}],["path",{d:"M2 12h20",key:"9i4pu4"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const za=f("GraduationCap",[["path",{d:"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z",key:"j76jl0"}],["path",{d:"M22 10v6",key:"1lu8f3"}],["path",{d:"M6 12.5V16a6 3 0 0 0 12 0v-3.5",key:"1r8lef"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fa=f("GripVertical",[["circle",{cx:"9",cy:"12",r:"1",key:"1vctgf"}],["circle",{cx:"9",cy:"5",r:"1",key:"hp0tcf"}],["circle",{cx:"9",cy:"19",r:"1",key:"fkjjf6"}],["circle",{cx:"15",cy:"12",r:"1",key:"1tmaij"}],["circle",{cx:"15",cy:"5",r:"1",key:"19l28e"}],["circle",{cx:"15",cy:"19",r:"1",key:"f4zoj3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ha=f("HardDrive",[["line",{x1:"22",x2:"2",y1:"12",y2:"12",key:"1y58io"}],["path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",key:"oot6mr"}],["line",{x1:"6",x2:"6.01",y1:"16",y2:"16",key:"sgf278"}],["line",{x1:"10",x2:"10.01",y1:"16",y2:"16",key:"1l4acy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Va=f("Hash",[["line",{x1:"4",x2:"20",y1:"9",y2:"9",key:"4lhtct"}],["line",{x1:"4",x2:"20",y1:"15",y2:"15",key:"vyu0kd"}],["line",{x1:"10",x2:"8",y1:"3",y2:"21",key:"1ggp8o"}],["line",{x1:"16",x2:"14",y1:"3",y2:"21",key:"weycgp"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qa=f("History",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $a=f("House",[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"1d0kgt"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ba=f("Image",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2",key:"1m3agn"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",key:"1xmnt7"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wa=f("Info",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ua=f("Key",[["path",{d:"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4",key:"g0fldk"}],["path",{d:"m21 2-9.6 9.6",key:"1j0ho8"}],["circle",{cx:"7.5",cy:"15.5",r:"5.5",key:"yqb3hr"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ka=f("Languages",[["path",{d:"m5 8 6 6",key:"1wu5hv"}],["path",{d:"m4 14 6-6 2-3",key:"1k1g8d"}],["path",{d:"M2 5h12",key:"or177f"}],["path",{d:"M7 2h1",key:"1t2jsx"}],["path",{d:"m22 22-5-10-5 10",key:"don7ne"}],["path",{d:"M14 18h6",key:"1m8k6r"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xa=f("Layers",[["path",{d:"m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",key:"8b97xw"}],["path",{d:"m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65",key:"dd6zsq"}],["path",{d:"m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65",key:"ep9fru"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ya=f("LayoutGrid",[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1",key:"1g98yp"}],["rect",{width:"7",height:"7",x:"14",y:"3",rx:"1",key:"6d4xhi"}],["rect",{width:"7",height:"7",x:"14",y:"14",rx:"1",key:"nxv5o0"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1",key:"1bb6yr"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Za=f("Library",[["path",{d:"m16 6 4 14",key:"ji33uf"}],["path",{d:"M12 6v14",key:"1n7gus"}],["path",{d:"M8 8v12",key:"1gg7y9"}],["path",{d:"M4 4v16",key:"6qkkli"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ga=f("LifeBuoy",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m4.93 4.93 4.24 4.24",key:"1ymg45"}],["path",{d:"m14.83 9.17 4.24-4.24",key:"1cb5xl"}],["path",{d:"m14.83 14.83 4.24 4.24",key:"q42g0n"}],["path",{d:"m9.17 14.83-4.24 4.24",key:"bqpfvv"}],["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qa=f("Lightbulb",[["path",{d:"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",key:"1gvzjb"}],["path",{d:"M9 18h6",key:"x1upvd"}],["path",{d:"M10 22h4",key:"ceow96"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ja=f("Link2",[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ei=f("Linkedin",[["path",{d:"M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z",key:"c2jq9f"}],["rect",{width:"4",height:"12",x:"2",y:"9",key:"mk3on5"}],["circle",{cx:"4",cy:"4",r:"2",key:"bt5ra8"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ti=f("ListOrdered",[["path",{d:"M10 12h11",key:"6m4ad9"}],["path",{d:"M10 18h11",key:"11hvi2"}],["path",{d:"M10 6h11",key:"c7qv1k"}],["path",{d:"M4 10h2",key:"16xx2s"}],["path",{d:"M4 6h1v4",key:"cnovpq"}],["path",{d:"M6 18H4c0-1 2-2 2-3s-1-1.5-2-1",key:"m9a95d"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ni=f("List",[["path",{d:"M3 12h.01",key:"nlz23k"}],["path",{d:"M3 18h.01",key:"1tta3j"}],["path",{d:"M3 6h.01",key:"1rqtza"}],["path",{d:"M8 12h13",key:"1za7za"}],["path",{d:"M8 18h13",key:"1lx6n3"}],["path",{d:"M8 6h13",key:"ik3vkj"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oi=f("LoaderCircle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ri=f("LockKeyhole",[["circle",{cx:"12",cy:"16",r:"1",key:"1au0dj"}],["rect",{x:"3",y:"10",width:"18",height:"12",rx:"2",key:"6s8ecr"}],["path",{d:"M7 10V7a5 5 0 0 1 10 0v3",key:"1pqi11"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const si=f("Lock",[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ai=f("LogOut",[["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}],["polyline",{points:"16 17 21 12 16 7",key:"1gabdz"}],["line",{x1:"21",x2:"9",y1:"12",y2:"12",key:"1uyos4"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ii=f("Mail",[["rect",{width:"20",height:"16",x:"2",y:"4",rx:"2",key:"18n3k1"}],["path",{d:"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7",key:"1ocrg3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ci=f("Map",[["path",{d:"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",key:"169xi5"}],["path",{d:"M15 5.764v15",key:"1pn4in"}],["path",{d:"M9 3.236v15",key:"1uimfh"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const li=f("Maximize2",[["polyline",{points:"15 3 21 3 21 9",key:"mznyad"}],["polyline",{points:"9 21 3 21 3 15",key:"1avn1i"}],["line",{x1:"21",x2:"14",y1:"3",y2:"10",key:"ota7mn"}],["line",{x1:"3",x2:"10",y1:"21",y2:"14",key:"1atl0r"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const di=f("Menu",[["line",{x1:"4",x2:"20",y1:"12",y2:"12",key:"1e0a9i"}],["line",{x1:"4",x2:"20",y1:"6",y2:"6",key:"1owob3"}],["line",{x1:"4",x2:"20",y1:"18",y2:"18",key:"yk5zj1"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ui=f("MessageCircle",[["path",{d:"M7.9 20A9 9 0 1 0 4 16.1L2 22Z",key:"vv11sd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fi=f("MessageSquareHeart",[["path",{d:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",key:"1lielz"}],["path",{d:"M14.8 7.5a1.84 1.84 0 0 0-2.6 0l-.2.3-.3-.3a1.84 1.84 0 1 0-2.4 2.8L12 13l2.7-2.7c.9-.9.8-2.1.1-2.8",key:"1blaws"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pi=f("MessageSquareQuote",[["path",{d:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",key:"1lielz"}],["path",{d:"M8 12a2 2 0 0 0 2-2V8H8",key:"1jfesj"}],["path",{d:"M14 12a2 2 0 0 0 2-2V8h-2",key:"1dq9mh"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const hi=f("MessageSquare",[["path",{d:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",key:"1lielz"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yi=f("Milestone",[["path",{d:"M12 13v8",key:"1l5pq0"}],["path",{d:"M12 3v3",key:"1n5kay"}],["path",{d:"M4 6a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h13a2 2 0 0 0 1.152-.365l3.424-2.317a1 1 0 0 0 0-1.635l-3.424-2.318A2 2 0 0 0 17 6z",key:"1btarq"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const mi=f("Minimize2",[["polyline",{points:"4 14 10 14 10 20",key:"11kfnr"}],["polyline",{points:"20 10 14 10 14 4",key:"rlmsce"}],["line",{x1:"14",x2:"21",y1:"10",y2:"3",key:"o5lafz"}],["line",{x1:"3",x2:"10",y1:"21",y2:"14",key:"1atl0r"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xi=f("MonitorUp",[["path",{d:"m9 10 3-3 3 3",key:"11gsxs"}],["path",{d:"M12 13V7",key:"h0r20n"}],["rect",{width:"20",height:"14",x:"2",y:"3",rx:"2",key:"48i651"}],["path",{d:"M12 17v4",key:"1riwvh"}],["path",{d:"M8 21h8",key:"1ev6f3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vi=f("Monitor",[["rect",{width:"20",height:"14",x:"2",y:"3",rx:"2",key:"48i651"}],["line",{x1:"8",x2:"16",y1:"21",y2:"21",key:"1svkeh"}],["line",{x1:"12",x2:"12",y1:"17",y2:"21",key:"vw1qmm"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ki=f("Moon",[["path",{d:"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",key:"a7tn18"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const gi=f("Network",[["rect",{x:"16",y:"16",width:"6",height:"6",rx:"1",key:"4q2zg0"}],["rect",{x:"2",y:"16",width:"6",height:"6",rx:"1",key:"8cvhb9"}],["rect",{x:"9",y:"2",width:"6",height:"6",rx:"1",key:"1egb70"}],["path",{d:"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3",key:"1jsf9p"}],["path",{d:"M12 12V8",key:"2874zd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wi=f("NotebookPen",[["path",{d:"M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4",key:"re6nr2"}],["path",{d:"M2 6h4",key:"aawbzj"}],["path",{d:"M2 10h4",key:"l0bgd4"}],["path",{d:"M2 14h4",key:"1gsvsf"}],["path",{d:"M2 18h4",key:"1bu2t1"}],["path",{d:"M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",key:"pqwjuv"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const bi=f("Orbit",[["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}],["circle",{cx:"19",cy:"5",r:"2",key:"mhkx31"}],["circle",{cx:"5",cy:"19",r:"2",key:"v8kfzx"}],["path",{d:"M10.4 21.9a10 10 0 0 0 9.941-15.416",key:"eohfx2"}],["path",{d:"M13.5 2.1a10 10 0 0 0-9.841 15.416",key:"19pvbm"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Mi=f("PanelLeft",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M9 3v18",key:"fh3hqa"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ci=f("Pause",[["rect",{x:"14",y:"4",width:"4",height:"16",rx:"1",key:"zuxfzm"}],["rect",{x:"6",y:"4",width:"4",height:"16",rx:"1",key:"1okwgv"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ei=f("PenLine",[["path",{d:"M12 20h9",key:"t2du7b"}],["path",{d:"M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",key:"1ykcvy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ti=f("Pencil",[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pi=f("Play",[["polygon",{points:"6 3 20 12 6 21 6 3",key:"1oa8hb"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ai=f("Plus",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ri=f("PowerOff",[["path",{d:"M18.36 6.64A9 9 0 0 1 20.77 15",key:"dxknvb"}],["path",{d:"M6.16 6.16a9 9 0 1 0 12.68 12.68",key:"1x7qb5"}],["path",{d:"M12 2v4",key:"3427ic"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Si=f("Power",[["path",{d:"M12 2v10",key:"mnfbl"}],["path",{d:"M18.4 6.6a9 9 0 1 1-12.77.04",key:"obofu9"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oi=f("Radio",[["path",{d:"M4.9 19.1C1 15.2 1 8.8 4.9 4.9",key:"1vaf9d"}],["path",{d:"M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5",key:"u1ii0m"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5",key:"1j5fej"}],["path",{d:"M19.1 4.9C23 8.8 23 15.1 19.1 19",key:"10b0cb"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Li=f("RefreshCw",[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Di=f("Rocket",[["path",{d:"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z",key:"m3kijz"}],["path",{d:"m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z",key:"1fmvmk"}],["path",{d:"M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0",key:"1f8sc4"}],["path",{d:"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",key:"qeys4"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ni=f("RotateCcw",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _i=f("RotateCw",[["path",{d:"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8",key:"1p45f6"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ji=f("Save",[["path",{d:"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",key:"1c8476"}],["path",{d:"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",key:"1ydtos"}],["path",{d:"M7 3v4a1 1 0 0 0 1 1h7",key:"t51u73"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ii=f("Scale",[["path",{d:"m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z",key:"7g6ntu"}],["path",{d:"m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z",key:"ijws7r"}],["path",{d:"M7 21h10",key:"1b0cd5"}],["path",{d:"M12 3v18",key:"108xh3"}],["path",{d:"M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2",key:"3gwbw2"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zi=f("ScrollText",[["path",{d:"M15 12h-5",key:"r7krc0"}],["path",{d:"M15 8h-5",key:"1khuty"}],["path",{d:"M19 17V5a2 2 0 0 0-2-2H4",key:"zz82l3"}],["path",{d:"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3",key:"1ph1d7"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fi=f("Search",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Hi=f("Send",[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vi=f("ServerCrash",[["path",{d:"M6 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2",key:"4b9dqc"}],["path",{d:"M6 14H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2",key:"22nnkd"}],["path",{d:"M6 6h.01",key:"1utrut"}],["path",{d:"M6 18h.01",key:"uhywen"}],["path",{d:"m13 6-4 6h6l-4 6",key:"14hqih"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qi=f("Server",[["rect",{width:"20",height:"8",x:"2",y:"2",rx:"2",ry:"2",key:"ngkwjq"}],["rect",{width:"20",height:"8",x:"2",y:"14",rx:"2",ry:"2",key:"iecqi9"}],["line",{x1:"6",x2:"6.01",y1:"6",y2:"6",key:"16zg32"}],["line",{x1:"6",x2:"6.01",y1:"18",y2:"18",key:"nzw8ys"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $i=f("Settings",[["path",{d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",key:"1qme2f"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Bi=f("Share2",[["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}],["circle",{cx:"6",cy:"12",r:"3",key:"w7nqdw"}],["circle",{cx:"18",cy:"19",r:"3",key:"1xt0gg"}],["line",{x1:"8.59",x2:"15.42",y1:"13.51",y2:"17.49",key:"47mynk"}],["line",{x1:"15.41",x2:"8.59",y1:"6.51",y2:"10.49",key:"1n3mei"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wi=f("ShieldAlert",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"M12 8v4",key:"1got3b"}],["path",{d:"M12 16h.01",key:"1drbdi"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ui=f("ShieldCheck",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ki=f("Shield",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xi=f("Sparkles",[["path",{d:"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",key:"4pj2yx"}],["path",{d:"M20 3v4",key:"1olli1"}],["path",{d:"M22 5h-4",key:"1gvqau"}],["path",{d:"M4 17v2",key:"vumght"}],["path",{d:"M5 18H3",key:"zchphs"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yi=f("SquarePen",[["path",{d:"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",key:"1m0v6g"}],["path",{d:"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",key:"ohrbg2"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zi=f("Square",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Gi=f("Star",[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qi=f("Sun",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ji=f("Swords",[["polyline",{points:"14.5 17.5 3 6 3 3 6 3 17.5 14.5",key:"1hfsw2"}],["line",{x1:"13",x2:"19",y1:"19",y2:"13",key:"1vrmhu"}],["line",{x1:"16",x2:"20",y1:"16",y2:"20",key:"1bron3"}],["line",{x1:"19",x2:"21",y1:"21",y2:"19",key:"13pww6"}],["polyline",{points:"14.5 6.5 18 3 21 3 21 6 17.5 9.5",key:"hbey2j"}],["line",{x1:"5",x2:"9",y1:"14",y2:"18",key:"1hf58s"}],["line",{x1:"7",x2:"4",y1:"17",y2:"20",key:"pidxm4"}],["line",{x1:"3",x2:"5",y1:"19",y2:"21",key:"1pehsh"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ec=f("Table2",[["path",{d:"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18",key:"gugj83"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const tc=f("Table",[["path",{d:"M12 3v18",key:"108xh3"}],["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M3 9h18",key:"1pudct"}],["path",{d:"M3 15h18",key:"5xshup"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const nc=f("Tag",[["path",{d:"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",key:"vktsd0"}],["circle",{cx:"7.5",cy:"7.5",r:".5",fill:"currentColor",key:"kqv944"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oc=f("Terminal",[["polyline",{points:"4 17 10 11 4 5",key:"akl6gq"}],["line",{x1:"12",x2:"20",y1:"19",y2:"19",key:"q2wloq"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rc=f("ToggleLeft",[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"6",ry:"6",key:"f2vt7d"}],["circle",{cx:"8",cy:"12",r:"2",key:"1nvbw3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sc=f("ToggleRight",[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"6",ry:"6",key:"f2vt7d"}],["circle",{cx:"16",cy:"12",r:"2",key:"4ma0v8"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ac=f("Trash2",[["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",key:"4alrt4"}],["path",{d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",key:"v07s0e"}],["line",{x1:"10",x2:"10",y1:"11",y2:"17",key:"1uufr5"}],["line",{x1:"14",x2:"14",y1:"11",y2:"17",key:"xtxkd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ic=f("TrendingUp",[["polyline",{points:"22 7 13.5 15.5 8.5 10.5 2 17",key:"126l90"}],["polyline",{points:"16 7 22 7 22 13",key:"kwv8wd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const cc=f("TriangleAlert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const lc=f("Twitter",[["path",{d:"M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z",key:"pff0z6"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const dc=f("User",[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const uc=f("Users",[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["path",{d:"M22 21v-2a4 4 0 0 0-3-3.87",key:"kshegd"}],["path",{d:"M16 3.13a4 4 0 0 1 0 7.75",key:"1da9ce"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fc=f("WandSparkles",[["path",{d:"m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72",key:"ul74o6"}],["path",{d:"m14 7 3 3",key:"1r5n42"}],["path",{d:"M5 6v4",key:"ilb8ba"}],["path",{d:"M19 14v4",key:"blhpug"}],["path",{d:"M10 2v2",key:"7u0qdc"}],["path",{d:"M7 8H3",key:"zfb6yr"}],["path",{d:"M21 16h-4",key:"1cnmox"}],["path",{d:"M11 3H9",key:"1obp7u"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pc=f("WifiOff",[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}],["path",{d:"M5 12.859a10 10 0 0 1 5.17-2.69",key:"1dl1wf"}],["path",{d:"M19 12.859a10 10 0 0 0-2.007-1.523",key:"4k23kn"}],["path",{d:"M2 8.82a15 15 0 0 1 4.177-2.643",key:"1grhjp"}],["path",{d:"M22 8.82a15 15 0 0 0-11.288-3.764",key:"z3jwby"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const hc=f("Wifi",[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M2 8.82a15 15 0 0 1 20 0",key:"dnpr2z"}],["path",{d:"M5 12.859a10 10 0 0 1 14 0",key:"1x1e6c"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yc=f("X",[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const mc=f("Zap",[["path",{d:"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",key:"1xq2db"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xc=f("ZoomIn",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"11",x2:"11",y1:"8",y2:"14",key:"1vmskp"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vc=f("ZoomOut",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]]);function F(e,t,{checkForDefaultPrevented:n=!0}={}){return function(r){if(e==null||e(r),n===!1||!r.defaultPrevented)return t==null?void 0:t(r)}}function kc(e,t){const n=d.createContext(t),o=s=>{const{children:a,...c}=s,l=d.useMemo(()=>c,Object.values(c));return M.jsx(n.Provider,{value:l,children:a})};o.displayName=e+"Provider";function r(s){const a=d.useContext(n);if(a)return a;if(t!==void 0)return t;throw new Error(`\`${s}\` must be used within \`${e}\``)}return[o,r]}function Oe(e,t=[]){let n=[];function o(s,a){const c=d.createContext(a),l=n.length;n=[...n,a];const i=p=>{var g;const{scope:y,children:h,...v}=p,x=((g=y==null?void 0:y[e])==null?void 0:g[l])||c,m=d.useMemo(()=>v,Object.values(v));return M.jsx(x.Provider,{value:m,children:h})};i.displayName=s+"Provider";function u(p,y){var x;const h=((x=y==null?void 0:y[e])==null?void 0:x[l])||c,v=d.useContext(h);if(v)return v;if(a!==void 0)return a;throw new Error(`\`${p}\` must be used within \`${s}\``)}return[i,u]}const r=()=>{const s=n.map(a=>d.createContext(a));return function(c){const l=(c==null?void 0:c[e])||s;return d.useMemo(()=>({[`__scope${e}`]:{...c,[e]:l}}),[c,l])}};return r.scopeName=e,[o,ro(r,...t)]}function ro(...e){const t=e[0];if(e.length===1)return t;const n=()=>{const o=e.map(r=>({useScope:r(),scopeName:r.scopeName}));return function(s){const a=o.reduce((c,{useScope:l,scopeName:i})=>{const p=l(s)[`__scope${i}`];return{...c,...p}},{});return d.useMemo(()=>({[`__scope${t.scopeName}`]:a}),[a])}};return n.scopeName=t.scopeName,n}var G=globalThis!=null&&globalThis.document?d.useLayoutEffect:()=>{},so=jt[" useInsertionEffect ".trim().toString()]||G;function qt({prop:e,defaultProp:t,onChange:n=()=>{},caller:o}){const[r,s,a]=ao({defaultProp:t,onChange:n}),c=e!==void 0,l=c?e:r;{const u=d.useRef(e!==void 0);d.useEffect(()=>{const p=u.current;p!==c&&console.warn(`${o} is changing from ${p?"controlled":"uncontrolled"} to ${c?"controlled":"uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`),u.current=c},[c,o])}const i=d.useCallback(u=>{var p;if(c){const y=io(u)?u(e):u;y!==e&&((p=a.current)==null||p.call(a,y))}else s(u)},[c,e,s,a]);return[l,i]}function ao({defaultProp:e,onChange:t}){const[n,o]=d.useState(e),r=d.useRef(n),s=d.useRef(t);return so(()=>{s.current=t},[t]),d.useEffect(()=>{var a;r.current!==n&&((a=s.current)==null||a.call(s,n),r.current=n)},[n,r]),[n,o,s]}function io(e){return typeof e=="function"}var co=["a","button","div","form","h2","h3","img","input","label","li","nav","ol","p","select","span","svg","ul"],H=co.reduce((e,t)=>{const n=Ee(`Primitive.${t}`),o=d.forwardRef((r,s)=>{const{asChild:a,...c}=r,l=a?n:t;return typeof window<"u"&&(window[Symbol.for("radix-ui")]=!0),M.jsx(l,{...c,ref:s})});return o.displayName=`Primitive.${t}`,{...e,[t]:o}},{});function $t(e,t){e&&Je.flushSync(()=>e.dispatchEvent(t))}function lo(e){const t=e+"CollectionProvider",[n,o]=Oe(t),[r,s]=n(t,{collectionRef:{current:null},itemMap:new Map}),a=x=>{const{scope:m,children:g}=x,k=oe.useRef(null),w=oe.useRef(new Map).current;return M.jsx(r,{scope:m,itemMap:w,collectionRef:k,children:g})};a.displayName=t;const c=e+"CollectionSlot",l=Ee(c),i=oe.forwardRef((x,m)=>{const{scope:g,children:k}=x,w=s(c,g),b=B(m,w.collectionRef);return M.jsx(l,{ref:b,children:k})});i.displayName=c;const u=e+"CollectionItemSlot",p="data-radix-collection-item",y=Ee(u),h=oe.forwardRef((x,m)=>{const{scope:g,children:k,...w}=x,b=oe.useRef(null),C=B(m,b),P=s(u,g);return oe.useEffect(()=>(P.itemMap.set(b,{ref:b,...w}),()=>void P.itemMap.delete(b))),M.jsx(y,{[p]:"",ref:C,children:k})});h.displayName=u;function v(x){const m=s(e+"CollectionConsumer",x);return oe.useCallback(()=>{const k=m.collectionRef.current;if(!k)return[];const w=Array.from(k.querySelectorAll(`[${p}]`));return Array.from(m.itemMap.values()).sort((P,E)=>w.indexOf(P.ref.current)-w.indexOf(E.ref.current))},[m.collectionRef,m.itemMap])}return[{Provider:a,Slot:i,ItemSlot:h},v,o]}function ee(e){const t=d.useRef(e);return d.useEffect(()=>{t.current=e}),d.useMemo(()=>(...n)=>{var o;return(o=t.current)==null?void 0:o.call(t,...n)},[])}function uo(e,t=globalThis==null?void 0:globalThis.document){const n=ee(e);d.useEffect(()=>{const o=r=>{r.key==="Escape"&&n(r)};return t.addEventListener("keydown",o,{capture:!0}),()=>t.removeEventListener("keydown",o,{capture:!0})},[n,t])}var fo="DismissableLayer",Be="dismissableLayer.update",po="dismissableLayer.pointerDownOutside",ho="dismissableLayer.focusOutside",bt,Bt=d.createContext({layers:new Set,layersWithOutsidePointerEventsDisabled:new Set,branches:new Set}),et=d.forwardRef((e,t)=>{const{disableOutsidePointerEvents:n=!1,onEscapeKeyDown:o,onPointerDownOutside:r,onFocusOutside:s,onInteractOutside:a,onDismiss:c,...l}=e,i=d.useContext(Bt),[u,p]=d.useState(null),y=(u==null?void 0:u.ownerDocument)??(globalThis==null?void 0:globalThis.document),[,h]=d.useState({}),v=B(t,E=>p(E)),x=Array.from(i.layers),[m]=[...i.layersWithOutsidePointerEventsDisabled].slice(-1),g=x.indexOf(m),k=u?x.indexOf(u):-1,w=i.layersWithOutsidePointerEventsDisabled.size>0,b=k>=g,C=mo(E=>{const R=E.target,N=[...i.branches].some(O=>O.contains(R));!b||N||(r==null||r(E),a==null||a(E),E.defaultPrevented||c==null||c())},y),P=xo(E=>{const R=E.target;[...i.branches].some(O=>O.contains(R))||(s==null||s(E),a==null||a(E),E.defaultPrevented||c==null||c())},y);return uo(E=>{k===i.layers.size-1&&(o==null||o(E),!E.defaultPrevented&&c&&(E.preventDefault(),c()))},y),d.useEffect(()=>{if(u)return n&&(i.layersWithOutsidePointerEventsDisabled.size===0&&(bt=y.body.style.pointerEvents,y.body.style.pointerEvents="none"),i.layersWithOutsidePointerEventsDisabled.add(u)),i.layers.add(u),Mt(),()=>{n&&i.layersWithOutsidePointerEventsDisabled.size===1&&(y.body.style.pointerEvents=bt)}},[u,y,n,i]),d.useEffect(()=>()=>{u&&(i.layers.delete(u),i.layersWithOutsidePointerEventsDisabled.delete(u),Mt())},[u,i]),d.useEffect(()=>{const E=()=>h({});return document.addEventListener(Be,E),()=>document.removeEventListener(Be,E)},[]),M.jsx(H.div,{...l,ref:v,style:{pointerEvents:w?b?"auto":"none":void 0,...e.style},onFocusCapture:F(e.onFocusCapture,P.onFocusCapture),onBlurCapture:F(e.onBlurCapture,P.onBlurCapture),onPointerDownCapture:F(e.onPointerDownCapture,C.onPointerDownCapture)})});et.displayName=fo;var yo="DismissableLayerBranch",Wt=d.forwardRef((e,t)=>{const n=d.useContext(Bt),o=d.useRef(null),r=B(t,o);return d.useEffect(()=>{const s=o.current;if(s)return n.branches.add(s),()=>{n.branches.delete(s)}},[n.branches]),M.jsx(H.div,{...e,ref:r})});Wt.displayName=yo;function mo(e,t=globalThis==null?void 0:globalThis.document){const n=ee(e),o=d.useRef(!1),r=d.useRef(()=>{});return d.useEffect(()=>{const s=c=>{if(c.target&&!o.current){let l=function(){Ut(po,n,i,{discrete:!0})};const i={originalEvent:c};c.pointerType==="touch"?(t.removeEventListener("click",r.current),r.current=l,t.addEventListener("click",r.current,{once:!0})):l()}else t.removeEventListener("click",r.current);o.current=!1},a=window.setTimeout(()=>{t.addEventListener("pointerdown",s)},0);return()=>{window.clearTimeout(a),t.removeEventListener("pointerdown",s),t.removeEventListener("click",r.current)}},[t,n]),{onPointerDownCapture:()=>o.current=!0}}function xo(e,t=globalThis==null?void 0:globalThis.document){const n=ee(e),o=d.useRef(!1);return d.useEffect(()=>{const r=s=>{s.target&&!o.current&&Ut(ho,n,{originalEvent:s},{discrete:!1})};return t.addEventListener("focusin",r),()=>t.removeEventListener("focusin",r)},[t,n]),{onFocusCapture:()=>o.current=!0,onBlurCapture:()=>o.current=!1}}function Mt(){const e=new CustomEvent(Be);document.dispatchEvent(e)}function Ut(e,t,n,{discrete:o}){const r=n.originalEvent.target,s=new CustomEvent(e,{bubbles:!1,cancelable:!0,detail:n});t&&r.addEventListener(e,t,{once:!0}),o?$t(r,s):r.dispatchEvent(s)}var vo=et,ko=Wt,go=jt[" useId ".trim().toString()]||(()=>{}),wo=0;function bo(e){const[t,n]=d.useState(go());return G(()=>{n(o=>o??String(wo++))},[e]),t?`radix-${t}`:""}const Mo=["top","right","bottom","left"],te=Math.min,V=Math.max,Te=Math.round,we=Math.floor,X=e=>({x:e,y:e}),Co={left:"right",right:"left",bottom:"top",top:"bottom"},Eo={start:"end",end:"start"};function We(e,t,n){return V(e,te(t,n))}function Q(e,t){return typeof e=="function"?e(t):e}function J(e){return e.split("-")[0]}function de(e){return e.split("-")[1]}function tt(e){return e==="x"?"y":"x"}function nt(e){return e==="y"?"height":"width"}const To=new Set(["top","bottom"]);function K(e){return To.has(J(e))?"y":"x"}function ot(e){return tt(K(e))}function Po(e,t,n){n===void 0&&(n=!1);const o=de(e),r=ot(e),s=nt(r);let a=r==="x"?o===(n?"end":"start")?"right":"left":o==="start"?"bottom":"top";return t.reference[s]>t.floating[s]&&(a=Pe(a)),[a,Pe(a)]}function Ao(e){const t=Pe(e);return[Ue(e),t,Ue(t)]}function Ue(e){return e.replace(/start|end/g,t=>Eo[t])}const Ct=["left","right"],Et=["right","left"],Ro=["top","bottom"],So=["bottom","top"];function Oo(e,t,n){switch(e){case"top":case"bottom":return n?t?Et:Ct:t?Ct:Et;case"left":case"right":return t?Ro:So;default:return[]}}function Lo(e,t,n,o){const r=de(e);let s=Oo(J(e),n==="start",o);return r&&(s=s.map(a=>a+"-"+r),t&&(s=s.concat(s.map(Ue)))),s}function Pe(e){return e.replace(/left|right|bottom|top/g,t=>Co[t])}function Do(e){return{top:0,right:0,bottom:0,left:0,...e}}function Kt(e){return typeof e!="number"?Do(e):{top:e,right:e,bottom:e,left:e}}function Ae(e){const{x:t,y:n,width:o,height:r}=e;return{width:o,height:r,top:n,left:t,right:t+o,bottom:n+r,x:t,y:n}}function Tt(e,t,n){let{reference:o,floating:r}=e;const s=K(t),a=ot(t),c=nt(a),l=J(t),i=s==="y",u=o.x+o.width/2-r.width/2,p=o.y+o.height/2-r.height/2,y=o[c]/2-r[c]/2;let h;switch(l){case"top":h={x:u,y:o.y-r.height};break;case"bottom":h={x:u,y:o.y+o.height};break;case"right":h={x:o.x+o.width,y:p};break;case"left":h={x:o.x-r.width,y:p};break;default:h={x:o.x,y:o.y}}switch(de(t)){case"start":h[a]-=y*(n&&i?-1:1);break;case"end":h[a]+=y*(n&&i?-1:1);break}return h}const No=async(e,t,n)=>{const{placement:o="bottom",strategy:r="absolute",middleware:s=[],platform:a}=n,c=s.filter(Boolean),l=await(a.isRTL==null?void 0:a.isRTL(t));let i=await a.getElementRects({reference:e,floating:t,strategy:r}),{x:u,y:p}=Tt(i,o,l),y=o,h={},v=0;for(let x=0;x<c.length;x++){const{name:m,fn:g}=c[x],{x:k,y:w,data:b,reset:C}=await g({x:u,y:p,initialPlacement:o,placement:y,strategy:r,middlewareData:h,rects:i,platform:a,elements:{reference:e,floating:t}});u=k??u,p=w??p,h={...h,[m]:{...h[m],...b}},C&&v<=50&&(v++,typeof C=="object"&&(C.placement&&(y=C.placement),C.rects&&(i=C.rects===!0?await a.getElementRects({reference:e,floating:t,strategy:r}):C.rects),{x:u,y:p}=Tt(i,y,l)),x=-1)}return{x:u,y:p,placement:y,strategy:r,middlewareData:h}};async function he(e,t){var n;t===void 0&&(t={});const{x:o,y:r,platform:s,rects:a,elements:c,strategy:l}=e,{boundary:i="clippingAncestors",rootBoundary:u="viewport",elementContext:p="floating",altBoundary:y=!1,padding:h=0}=Q(t,e),v=Kt(h),m=c[y?p==="floating"?"reference":"floating":p],g=Ae(await s.getClippingRect({element:(n=await(s.isElement==null?void 0:s.isElement(m)))==null||n?m:m.contextElement||await(s.getDocumentElement==null?void 0:s.getDocumentElement(c.floating)),boundary:i,rootBoundary:u,strategy:l})),k=p==="floating"?{x:o,y:r,width:a.floating.width,height:a.floating.height}:a.reference,w=await(s.getOffsetParent==null?void 0:s.getOffsetParent(c.floating)),b=await(s.isElement==null?void 0:s.isElement(w))?await(s.getScale==null?void 0:s.getScale(w))||{x:1,y:1}:{x:1,y:1},C=Ae(s.convertOffsetParentRelativeRectToViewportRelativeRect?await s.convertOffsetParentRelativeRectToViewportRelativeRect({elements:c,rect:k,offsetParent:w,strategy:l}):k);return{top:(g.top-C.top+v.top)/b.y,bottom:(C.bottom-g.bottom+v.bottom)/b.y,left:(g.left-C.left+v.left)/b.x,right:(C.right-g.right+v.right)/b.x}}const _o=e=>({name:"arrow",options:e,async fn(t){const{x:n,y:o,placement:r,rects:s,platform:a,elements:c,middlewareData:l}=t,{element:i,padding:u=0}=Q(e,t)||{};if(i==null)return{};const p=Kt(u),y={x:n,y:o},h=ot(r),v=nt(h),x=await a.getDimensions(i),m=h==="y",g=m?"top":"left",k=m?"bottom":"right",w=m?"clientHeight":"clientWidth",b=s.reference[v]+s.reference[h]-y[h]-s.floating[v],C=y[h]-s.reference[h],P=await(a.getOffsetParent==null?void 0:a.getOffsetParent(i));let E=P?P[w]:0;(!E||!await(a.isElement==null?void 0:a.isElement(P)))&&(E=c.floating[w]||s.floating[v]);const R=b/2-C/2,N=E/2-x[v]/2-1,O=te(p[g],N),I=te(p[k],N),j=O,_=E-x[v]-I,T=E/2-x[v]/2+R,L=We(j,T,_),S=!l.arrow&&de(r)!=null&&T!==L&&s.reference[v]/2-(T<j?O:I)-x[v]/2<0,D=S?T<j?T-j:T-_:0;return{[h]:y[h]+D,data:{[h]:L,centerOffset:T-L-D,...S&&{alignmentOffset:D}},reset:S}}}),jo=function(e){return e===void 0&&(e={}),{name:"flip",options:e,async fn(t){var n,o;const{placement:r,middlewareData:s,rects:a,initialPlacement:c,platform:l,elements:i}=t,{mainAxis:u=!0,crossAxis:p=!0,fallbackPlacements:y,fallbackStrategy:h="bestFit",fallbackAxisSideDirection:v="none",flipAlignment:x=!0,...m}=Q(e,t);if((n=s.arrow)!=null&&n.alignmentOffset)return{};const g=J(r),k=K(c),w=J(c)===c,b=await(l.isRTL==null?void 0:l.isRTL(i.floating)),C=y||(w||!x?[Pe(c)]:Ao(c)),P=v!=="none";!y&&P&&C.push(...Lo(c,x,v,b));const E=[c,...C],R=await he(t,m),N=[];let O=((o=s.flip)==null?void 0:o.overflows)||[];if(u&&N.push(R[g]),p){const T=Po(r,a,b);N.push(R[T[0]],R[T[1]])}if(O=[...O,{placement:r,overflows:N}],!N.every(T=>T<=0)){var I,j;const T=(((I=s.flip)==null?void 0:I.index)||0)+1,L=E[T];if(L&&(!(p==="alignment"?k!==K(L):!1)||O.every(A=>K(A.placement)===k?A.overflows[0]>0:!0)))return{data:{index:T,overflows:O},reset:{placement:L}};let S=(j=O.filter(D=>D.overflows[0]<=0).sort((D,A)=>D.overflows[1]-A.overflows[1])[0])==null?void 0:j.placement;if(!S)switch(h){case"bestFit":{var _;const D=(_=O.filter(A=>{if(P){const z=K(A.placement);return z===k||z==="y"}return!0}).map(A=>[A.placement,A.overflows.filter(z=>z>0).reduce((z,$)=>z+$,0)]).sort((A,z)=>A[1]-z[1])[0])==null?void 0:_[0];D&&(S=D);break}case"initialPlacement":S=c;break}if(r!==S)return{reset:{placement:S}}}return{}}}};function Pt(e,t){return{top:e.top-t.height,right:e.right-t.width,bottom:e.bottom-t.height,left:e.left-t.width}}function At(e){return Mo.some(t=>e[t]>=0)}const Io=function(e){return e===void 0&&(e={}),{name:"hide",options:e,async fn(t){const{rects:n}=t,{strategy:o="referenceHidden",...r}=Q(e,t);switch(o){case"referenceHidden":{const s=await he(t,{...r,elementContext:"reference"}),a=Pt(s,n.reference);return{data:{referenceHiddenOffsets:a,referenceHidden:At(a)}}}case"escaped":{const s=await he(t,{...r,altBoundary:!0}),a=Pt(s,n.floating);return{data:{escapedOffsets:a,escaped:At(a)}}}default:return{}}}}},Xt=new Set(["left","top"]);async function zo(e,t){const{placement:n,platform:o,elements:r}=e,s=await(o.isRTL==null?void 0:o.isRTL(r.floating)),a=J(n),c=de(n),l=K(n)==="y",i=Xt.has(a)?-1:1,u=s&&l?-1:1,p=Q(t,e);let{mainAxis:y,crossAxis:h,alignmentAxis:v}=typeof p=="number"?{mainAxis:p,crossAxis:0,alignmentAxis:null}:{mainAxis:p.mainAxis||0,crossAxis:p.crossAxis||0,alignmentAxis:p.alignmentAxis};return c&&typeof v=="number"&&(h=c==="end"?v*-1:v),l?{x:h*u,y:y*i}:{x:y*i,y:h*u}}const Fo=function(e){return e===void 0&&(e=0),{name:"offset",options:e,async fn(t){var n,o;const{x:r,y:s,placement:a,middlewareData:c}=t,l=await zo(t,e);return a===((n=c.offset)==null?void 0:n.placement)&&(o=c.arrow)!=null&&o.alignmentOffset?{}:{x:r+l.x,y:s+l.y,data:{...l,placement:a}}}}},Ho=function(e){return e===void 0&&(e={}),{name:"shift",options:e,async fn(t){const{x:n,y:o,placement:r}=t,{mainAxis:s=!0,crossAxis:a=!1,limiter:c={fn:m=>{let{x:g,y:k}=m;return{x:g,y:k}}},...l}=Q(e,t),i={x:n,y:o},u=await he(t,l),p=K(J(r)),y=tt(p);let h=i[y],v=i[p];if(s){const m=y==="y"?"top":"left",g=y==="y"?"bottom":"right",k=h+u[m],w=h-u[g];h=We(k,h,w)}if(a){const m=p==="y"?"top":"left",g=p==="y"?"bottom":"right",k=v+u[m],w=v-u[g];v=We(k,v,w)}const x=c.fn({...t,[y]:h,[p]:v});return{...x,data:{x:x.x-n,y:x.y-o,enabled:{[y]:s,[p]:a}}}}}},Vo=function(e){return e===void 0&&(e={}),{options:e,fn(t){const{x:n,y:o,placement:r,rects:s,middlewareData:a}=t,{offset:c=0,mainAxis:l=!0,crossAxis:i=!0}=Q(e,t),u={x:n,y:o},p=K(r),y=tt(p);let h=u[y],v=u[p];const x=Q(c,t),m=typeof x=="number"?{mainAxis:x,crossAxis:0}:{mainAxis:0,crossAxis:0,...x};if(l){const w=y==="y"?"height":"width",b=s.reference[y]-s.floating[w]+m.mainAxis,C=s.reference[y]+s.reference[w]-m.mainAxis;h<b?h=b:h>C&&(h=C)}if(i){var g,k;const w=y==="y"?"width":"height",b=Xt.has(J(r)),C=s.reference[p]-s.floating[w]+(b&&((g=a.offset)==null?void 0:g[p])||0)+(b?0:m.crossAxis),P=s.reference[p]+s.reference[w]+(b?0:((k=a.offset)==null?void 0:k[p])||0)-(b?m.crossAxis:0);v<C?v=C:v>P&&(v=P)}return{[y]:h,[p]:v}}}},qo=function(e){return e===void 0&&(e={}),{name:"size",options:e,async fn(t){var n,o;const{placement:r,rects:s,platform:a,elements:c}=t,{apply:l=()=>{},...i}=Q(e,t),u=await he(t,i),p=J(r),y=de(r),h=K(r)==="y",{width:v,height:x}=s.floating;let m,g;p==="top"||p==="bottom"?(m=p,g=y===(await(a.isRTL==null?void 0:a.isRTL(c.floating))?"start":"end")?"left":"right"):(g=p,m=y==="end"?"top":"bottom");const k=x-u.top-u.bottom,w=v-u.left-u.right,b=te(x-u[m],k),C=te(v-u[g],w),P=!t.middlewareData.shift;let E=b,R=C;if((n=t.middlewareData.shift)!=null&&n.enabled.x&&(R=w),(o=t.middlewareData.shift)!=null&&o.enabled.y&&(E=k),P&&!y){const O=V(u.left,0),I=V(u.right,0),j=V(u.top,0),_=V(u.bottom,0);h?R=v-2*(O!==0||I!==0?O+I:V(u.left,u.right)):E=x-2*(j!==0||_!==0?j+_:V(u.top,u.bottom))}await l({...t,availableWidth:R,availableHeight:E});const N=await a.getDimensions(c.floating);return v!==N.width||x!==N.height?{reset:{rects:!0}}:{}}}};function Le(){return typeof window<"u"}function ue(e){return Yt(e)?(e.nodeName||"").toLowerCase():"#document"}function q(e){var t;return(e==null||(t=e.ownerDocument)==null?void 0:t.defaultView)||window}function Z(e){var t;return(t=(Yt(e)?e.ownerDocument:e.document)||window.document)==null?void 0:t.documentElement}function Yt(e){return Le()?e instanceof Node||e instanceof q(e).Node:!1}function W(e){return Le()?e instanceof Element||e instanceof q(e).Element:!1}function Y(e){return Le()?e instanceof HTMLElement||e instanceof q(e).HTMLElement:!1}function Rt(e){return!Le()||typeof ShadowRoot>"u"?!1:e instanceof ShadowRoot||e instanceof q(e).ShadowRoot}const $o=new Set(["inline","contents"]);function xe(e){const{overflow:t,overflowX:n,overflowY:o,display:r}=U(e);return/auto|scroll|overlay|hidden|clip/.test(t+o+n)&&!$o.has(r)}const Bo=new Set(["table","td","th"]);function Wo(e){return Bo.has(ue(e))}const Uo=[":popover-open",":modal"];function De(e){return Uo.some(t=>{try{return e.matches(t)}catch{return!1}})}const Ko=["transform","translate","scale","rotate","perspective"],Xo=["transform","translate","scale","rotate","perspective","filter"],Yo=["paint","layout","strict","content"];function rt(e){const t=st(),n=W(e)?U(e):e;return Ko.some(o=>n[o]?n[o]!=="none":!1)||(n.containerType?n.containerType!=="normal":!1)||!t&&(n.backdropFilter?n.backdropFilter!=="none":!1)||!t&&(n.filter?n.filter!=="none":!1)||Xo.some(o=>(n.willChange||"").includes(o))||Yo.some(o=>(n.contain||"").includes(o))}function Zo(e){let t=ne(e);for(;Y(t)&&!ce(t);){if(rt(t))return t;if(De(t))return null;t=ne(t)}return null}function st(){return typeof CSS>"u"||!CSS.supports?!1:CSS.supports("-webkit-backdrop-filter","none")}const Go=new Set(["html","body","#document"]);function ce(e){return Go.has(ue(e))}function U(e){return q(e).getComputedStyle(e)}function Ne(e){return W(e)?{scrollLeft:e.scrollLeft,scrollTop:e.scrollTop}:{scrollLeft:e.scrollX,scrollTop:e.scrollY}}function ne(e){if(ue(e)==="html")return e;const t=e.assignedSlot||e.parentNode||Rt(e)&&e.host||Z(e);return Rt(t)?t.host:t}function Zt(e){const t=ne(e);return ce(t)?e.ownerDocument?e.ownerDocument.body:e.body:Y(t)&&xe(t)?t:Zt(t)}function ye(e,t,n){var o;t===void 0&&(t=[]),n===void 0&&(n=!0);const r=Zt(e),s=r===((o=e.ownerDocument)==null?void 0:o.body),a=q(r);if(s){const c=Ke(a);return t.concat(a,a.visualViewport||[],xe(r)?r:[],c&&n?ye(c):[])}return t.concat(r,ye(r,[],n))}function Ke(e){return e.parent&&Object.getPrototypeOf(e.parent)?e.frameElement:null}function Gt(e){const t=U(e);let n=parseFloat(t.width)||0,o=parseFloat(t.height)||0;const r=Y(e),s=r?e.offsetWidth:n,a=r?e.offsetHeight:o,c=Te(n)!==s||Te(o)!==a;return c&&(n=s,o=a),{width:n,height:o,$:c}}function at(e){return W(e)?e:e.contextElement}function ie(e){const t=at(e);if(!Y(t))return X(1);const n=t.getBoundingClientRect(),{width:o,height:r,$:s}=Gt(t);let a=(s?Te(n.width):n.width)/o,c=(s?Te(n.height):n.height)/r;return(!a||!Number.isFinite(a))&&(a=1),(!c||!Number.isFinite(c))&&(c=1),{x:a,y:c}}const Qo=X(0);function Qt(e){const t=q(e);return!st()||!t.visualViewport?Qo:{x:t.visualViewport.offsetLeft,y:t.visualViewport.offsetTop}}function Jo(e,t,n){return t===void 0&&(t=!1),!n||t&&n!==q(e)?!1:t}function re(e,t,n,o){t===void 0&&(t=!1),n===void 0&&(n=!1);const r=e.getBoundingClientRect(),s=at(e);let a=X(1);t&&(o?W(o)&&(a=ie(o)):a=ie(e));const c=Jo(s,n,o)?Qt(s):X(0);let l=(r.left+c.x)/a.x,i=(r.top+c.y)/a.y,u=r.width/a.x,p=r.height/a.y;if(s){const y=q(s),h=o&&W(o)?q(o):o;let v=y,x=Ke(v);for(;x&&o&&h!==v;){const m=ie(x),g=x.getBoundingClientRect(),k=U(x),w=g.left+(x.clientLeft+parseFloat(k.paddingLeft))*m.x,b=g.top+(x.clientTop+parseFloat(k.paddingTop))*m.y;l*=m.x,i*=m.y,u*=m.x,p*=m.y,l+=w,i+=b,v=q(x),x=Ke(v)}}return Ae({width:u,height:p,x:l,y:i})}function _e(e,t){const n=Ne(e).scrollLeft;return t?t.left+n:re(Z(e)).left+n}function Jt(e,t){const n=e.getBoundingClientRect(),o=n.left+t.scrollLeft-_e(e,n),r=n.top+t.scrollTop;return{x:o,y:r}}function er(e){let{elements:t,rect:n,offsetParent:o,strategy:r}=e;const s=r==="fixed",a=Z(o),c=t?De(t.floating):!1;if(o===a||c&&s)return n;let l={scrollLeft:0,scrollTop:0},i=X(1);const u=X(0),p=Y(o);if((p||!p&&!s)&&((ue(o)!=="body"||xe(a))&&(l=Ne(o)),Y(o))){const h=re(o);i=ie(o),u.x=h.x+o.clientLeft,u.y=h.y+o.clientTop}const y=a&&!p&&!s?Jt(a,l):X(0);return{width:n.width*i.x,height:n.height*i.y,x:n.x*i.x-l.scrollLeft*i.x+u.x+y.x,y:n.y*i.y-l.scrollTop*i.y+u.y+y.y}}function tr(e){return Array.from(e.getClientRects())}function nr(e){const t=Z(e),n=Ne(e),o=e.ownerDocument.body,r=V(t.scrollWidth,t.clientWidth,o.scrollWidth,o.clientWidth),s=V(t.scrollHeight,t.clientHeight,o.scrollHeight,o.clientHeight);let a=-n.scrollLeft+_e(e);const c=-n.scrollTop;return U(o).direction==="rtl"&&(a+=V(t.clientWidth,o.clientWidth)-r),{width:r,height:s,x:a,y:c}}const St=25;function or(e,t){const n=q(e),o=Z(e),r=n.visualViewport;let s=o.clientWidth,a=o.clientHeight,c=0,l=0;if(r){s=r.width,a=r.height;const u=st();(!u||u&&t==="fixed")&&(c=r.offsetLeft,l=r.offsetTop)}const i=_e(o);if(i<=0){const u=o.ownerDocument,p=u.body,y=getComputedStyle(p),h=u.compatMode==="CSS1Compat"&&parseFloat(y.marginLeft)+parseFloat(y.marginRight)||0,v=Math.abs(o.clientWidth-p.clientWidth-h);v<=St&&(s-=v)}else i<=St&&(s+=i);return{width:s,height:a,x:c,y:l}}const rr=new Set(["absolute","fixed"]);function sr(e,t){const n=re(e,!0,t==="fixed"),o=n.top+e.clientTop,r=n.left+e.clientLeft,s=Y(e)?ie(e):X(1),a=e.clientWidth*s.x,c=e.clientHeight*s.y,l=r*s.x,i=o*s.y;return{width:a,height:c,x:l,y:i}}function Ot(e,t,n){let o;if(t==="viewport")o=or(e,n);else if(t==="document")o=nr(Z(e));else if(W(t))o=sr(t,n);else{const r=Qt(e);o={x:t.x-r.x,y:t.y-r.y,width:t.width,height:t.height}}return Ae(o)}function en(e,t){const n=ne(e);return n===t||!W(n)||ce(n)?!1:U(n).position==="fixed"||en(n,t)}function ar(e,t){const n=t.get(e);if(n)return n;let o=ye(e,[],!1).filter(c=>W(c)&&ue(c)!=="body"),r=null;const s=U(e).position==="fixed";let a=s?ne(e):e;for(;W(a)&&!ce(a);){const c=U(a),l=rt(a);!l&&c.position==="fixed"&&(r=null),(s?!l&&!r:!l&&c.position==="static"&&!!r&&rr.has(r.position)||xe(a)&&!l&&en(e,a))?o=o.filter(u=>u!==a):r=c,a=ne(a)}return t.set(e,o),o}function ir(e){let{element:t,boundary:n,rootBoundary:o,strategy:r}=e;const a=[...n==="clippingAncestors"?De(t)?[]:ar(t,this._c):[].concat(n),o],c=a[0],l=a.reduce((i,u)=>{const p=Ot(t,u,r);return i.top=V(p.top,i.top),i.right=te(p.right,i.right),i.bottom=te(p.bottom,i.bottom),i.left=V(p.left,i.left),i},Ot(t,c,r));return{width:l.right-l.left,height:l.bottom-l.top,x:l.left,y:l.top}}function cr(e){const{width:t,height:n}=Gt(e);return{width:t,height:n}}function lr(e,t,n){const o=Y(t),r=Z(t),s=n==="fixed",a=re(e,!0,s,t);let c={scrollLeft:0,scrollTop:0};const l=X(0);function i(){l.x=_e(r)}if(o||!o&&!s)if((ue(t)!=="body"||xe(r))&&(c=Ne(t)),o){const h=re(t,!0,s,t);l.x=h.x+t.clientLeft,l.y=h.y+t.clientTop}else r&&i();s&&!o&&r&&i();const u=r&&!o&&!s?Jt(r,c):X(0),p=a.left+c.scrollLeft-l.x-u.x,y=a.top+c.scrollTop-l.y-u.y;return{x:p,y,width:a.width,height:a.height}}function Ve(e){return U(e).position==="static"}function Lt(e,t){if(!Y(e)||U(e).position==="fixed")return null;if(t)return t(e);let n=e.offsetParent;return Z(e)===n&&(n=n.ownerDocument.body),n}function tn(e,t){const n=q(e);if(De(e))return n;if(!Y(e)){let r=ne(e);for(;r&&!ce(r);){if(W(r)&&!Ve(r))return r;r=ne(r)}return n}let o=Lt(e,t);for(;o&&Wo(o)&&Ve(o);)o=Lt(o,t);return o&&ce(o)&&Ve(o)&&!rt(o)?n:o||Zo(e)||n}const dr=async function(e){const t=this.getOffsetParent||tn,n=this.getDimensions,o=await n(e.floating);return{reference:lr(e.reference,await t(e.floating),e.strategy),floating:{x:0,y:0,width:o.width,height:o.height}}};function ur(e){return U(e).direction==="rtl"}const fr={convertOffsetParentRelativeRectToViewportRelativeRect:er,getDocumentElement:Z,getClippingRect:ir,getOffsetParent:tn,getElementRects:dr,getClientRects:tr,getDimensions:cr,getScale:ie,isElement:W,isRTL:ur};function nn(e,t){return e.x===t.x&&e.y===t.y&&e.width===t.width&&e.height===t.height}function pr(e,t){let n=null,o;const r=Z(e);function s(){var c;clearTimeout(o),(c=n)==null||c.disconnect(),n=null}function a(c,l){c===void 0&&(c=!1),l===void 0&&(l=1),s();const i=e.getBoundingClientRect(),{left:u,top:p,width:y,height:h}=i;if(c||t(),!y||!h)return;const v=we(p),x=we(r.clientWidth-(u+y)),m=we(r.clientHeight-(p+h)),g=we(u),w={rootMargin:-v+"px "+-x+"px "+-m+"px "+-g+"px",threshold:V(0,te(1,l))||1};let b=!0;function C(P){const E=P[0].intersectionRatio;if(E!==l){if(!b)return a();E?a(!1,E):o=setTimeout(()=>{a(!1,1e-7)},1e3)}E===1&&!nn(i,e.getBoundingClientRect())&&a(),b=!1}try{n=new IntersectionObserver(C,{...w,root:r.ownerDocument})}catch{n=new IntersectionObserver(C,w)}n.observe(e)}return a(!0),s}function hr(e,t,n,o){o===void 0&&(o={});const{ancestorScroll:r=!0,ancestorResize:s=!0,elementResize:a=typeof ResizeObserver=="function",layoutShift:c=typeof IntersectionObserver=="function",animationFrame:l=!1}=o,i=at(e),u=r||s?[...i?ye(i):[],...ye(t)]:[];u.forEach(g=>{r&&g.addEventListener("scroll",n,{passive:!0}),s&&g.addEventListener("resize",n)});const p=i&&c?pr(i,n):null;let y=-1,h=null;a&&(h=new ResizeObserver(g=>{let[k]=g;k&&k.target===i&&h&&(h.unobserve(t),cancelAnimationFrame(y),y=requestAnimationFrame(()=>{var w;(w=h)==null||w.observe(t)})),n()}),i&&!l&&h.observe(i),h.observe(t));let v,x=l?re(e):null;l&&m();function m(){const g=re(e);x&&!nn(x,g)&&n(),x=g,v=requestAnimationFrame(m)}return n(),()=>{var g;u.forEach(k=>{r&&k.removeEventListener("scroll",n),s&&k.removeEventListener("resize",n)}),p==null||p(),(g=h)==null||g.disconnect(),h=null,l&&cancelAnimationFrame(v)}}const yr=Fo,mr=Ho,xr=jo,vr=qo,kr=Io,Dt=_o,gr=Vo,wr=(e,t,n)=>{const o=new Map,r={platform:fr,...n},s={...r.platform,_c:o};return No(e,t,{...r,platform:s})};var br=typeof document<"u",Mr=function(){},Ce=br?d.useLayoutEffect:Mr;function Re(e,t){if(e===t)return!0;if(typeof e!=typeof t)return!1;if(typeof e=="function"&&e.toString()===t.toString())return!0;let n,o,r;if(e&&t&&typeof e=="object"){if(Array.isArray(e)){if(n=e.length,n!==t.length)return!1;for(o=n;o--!==0;)if(!Re(e[o],t[o]))return!1;return!0}if(r=Object.keys(e),n=r.length,n!==Object.keys(t).length)return!1;for(o=n;o--!==0;)if(!{}.hasOwnProperty.call(t,r[o]))return!1;for(o=n;o--!==0;){const s=r[o];if(!(s==="_owner"&&e.$$typeof)&&!Re(e[s],t[s]))return!1}return!0}return e!==e&&t!==t}function on(e){return typeof window>"u"?1:(e.ownerDocument.defaultView||window).devicePixelRatio||1}function Nt(e,t){const n=on(e);return Math.round(t*n)/n}function qe(e){const t=d.useRef(e);return Ce(()=>{t.current=e}),t}function Cr(e){e===void 0&&(e={});const{placement:t="bottom",strategy:n="absolute",middleware:o=[],platform:r,elements:{reference:s,floating:a}={},transform:c=!0,whileElementsMounted:l,open:i}=e,[u,p]=d.useState({x:0,y:0,strategy:n,placement:t,middlewareData:{},isPositioned:!1}),[y,h]=d.useState(o);Re(y,o)||h(o);const[v,x]=d.useState(null),[m,g]=d.useState(null),k=d.useCallback(A=>{A!==P.current&&(P.current=A,x(A))},[]),w=d.useCallback(A=>{A!==E.current&&(E.current=A,g(A))},[]),b=s||v,C=a||m,P=d.useRef(null),E=d.useRef(null),R=d.useRef(u),N=l!=null,O=qe(l),I=qe(r),j=qe(i),_=d.useCallback(()=>{if(!P.current||!E.current)return;const A={placement:t,strategy:n,middleware:y};I.current&&(A.platform=I.current),wr(P.current,E.current,A).then(z=>{const $={...z,isPositioned:j.current!==!1};T.current&&!Re(R.current,$)&&(R.current=$,Je.flushSync(()=>{p($)}))})},[y,t,n,I,j]);Ce(()=>{i===!1&&R.current.isPositioned&&(R.current.isPositioned=!1,p(A=>({...A,isPositioned:!1})))},[i]);const T=d.useRef(!1);Ce(()=>(T.current=!0,()=>{T.current=!1}),[]),Ce(()=>{if(b&&(P.current=b),C&&(E.current=C),b&&C){if(O.current)return O.current(b,C,_);_()}},[b,C,_,O,N]);const L=d.useMemo(()=>({reference:P,floating:E,setReference:k,setFloating:w}),[k,w]),S=d.useMemo(()=>({reference:b,floating:C}),[b,C]),D=d.useMemo(()=>{const A={position:n,left:0,top:0};if(!S.floating)return A;const z=Nt(S.floating,u.x),$=Nt(S.floating,u.y);return c?{...A,transform:"translate("+z+"px, "+$+"px)",...on(S.floating)>=1.5&&{willChange:"transform"}}:{position:n,left:z,top:$}},[n,c,S.floating,u.x,u.y]);return d.useMemo(()=>({...u,update:_,refs:L,elements:S,floatingStyles:D}),[u,_,L,S,D])}const Er=e=>{function t(n){return{}.hasOwnProperty.call(n,"current")}return{name:"arrow",options:e,fn(n){const{element:o,padding:r}=typeof e=="function"?e(n):e;return o&&t(o)?o.current!=null?Dt({element:o.current,padding:r}).fn(n):{}:o?Dt({element:o,padding:r}).fn(n):{}}}},Tr=(e,t)=>({...yr(e),options:[e,t]}),Pr=(e,t)=>({...mr(e),options:[e,t]}),Ar=(e,t)=>({...gr(e),options:[e,t]}),Rr=(e,t)=>({...xr(e),options:[e,t]}),Sr=(e,t)=>({...vr(e),options:[e,t]}),Or=(e,t)=>({...kr(e),options:[e,t]}),Lr=(e,t)=>({...Er(e),options:[e,t]});var Dr="Arrow",rn=d.forwardRef((e,t)=>{const{children:n,width:o=10,height:r=5,...s}=e;return M.jsx(H.svg,{...s,ref:t,width:o,height:r,viewBox:"0 0 30 10",preserveAspectRatio:"none",children:e.asChild?n:M.jsx("polygon",{points:"0,0 30,0 15,10"})})});rn.displayName=Dr;var Nr=rn;function _r(e){const[t,n]=d.useState(void 0);return G(()=>{if(e){n({width:e.offsetWidth,height:e.offsetHeight});const o=new ResizeObserver(r=>{if(!Array.isArray(r)||!r.length)return;const s=r[0];let a,c;if("borderBoxSize"in s){const l=s.borderBoxSize,i=Array.isArray(l)?l[0]:l;a=i.inlineSize,c=i.blockSize}else a=e.offsetWidth,c=e.offsetHeight;n({width:a,height:c})});return o.observe(e,{box:"border-box"}),()=>o.unobserve(e)}else n(void 0)},[e]),t}var it="Popper",[sn,an]=Oe(it),[jr,cn]=sn(it),ln=e=>{const{__scopePopper:t,children:n}=e,[o,r]=d.useState(null);return M.jsx(jr,{scope:t,anchor:o,onAnchorChange:r,children:n})};ln.displayName=it;var dn="PopperAnchor",un=d.forwardRef((e,t)=>{const{__scopePopper:n,virtualRef:o,...r}=e,s=cn(dn,n),a=d.useRef(null),c=B(t,a),l=d.useRef(null);return d.useEffect(()=>{const i=l.current;l.current=(o==null?void 0:o.current)||a.current,i!==l.current&&s.onAnchorChange(l.current)}),o?null:M.jsx(H.div,{...r,ref:c})});un.displayName=dn;var ct="PopperContent",[Ir,zr]=sn(ct),fn=d.forwardRef((e,t)=>{var ht,yt,mt,xt,vt,kt;const{__scopePopper:n,side:o="bottom",sideOffset:r=0,align:s="center",alignOffset:a=0,arrowPadding:c=0,avoidCollisions:l=!0,collisionBoundary:i=[],collisionPadding:u=0,sticky:p="partial",hideWhenDetached:y=!1,updatePositionStrategy:h="optimized",onPlaced:v,...x}=e,m=cn(ct,n),[g,k]=d.useState(null),w=B(t,pe=>k(pe)),[b,C]=d.useState(null),P=_r(b),E=(P==null?void 0:P.width)??0,R=(P==null?void 0:P.height)??0,N=o+(s!=="center"?"-"+s:""),O=typeof u=="number"?u:{top:0,right:0,bottom:0,left:0,...u},I=Array.isArray(i)?i:[i],j=I.length>0,_={padding:O,boundary:I.filter(Hr),altBoundary:j},{refs:T,floatingStyles:L,placement:S,isPositioned:D,middlewareData:A}=Cr({strategy:"fixed",placement:N,whileElementsMounted:(...pe)=>hr(...pe,{animationFrame:h==="always"}),elements:{reference:m.anchor},middleware:[Tr({mainAxis:r+R,alignmentAxis:a}),l&&Pr({mainAxis:!0,crossAxis:!1,limiter:p==="partial"?Ar():void 0,..._}),l&&Rr({..._}),Sr({..._,apply:({elements:pe,rects:gt,availableWidth:Fn,availableHeight:Hn})=>{const{width:Vn,height:qn}=gt.reference,ge=pe.floating.style;ge.setProperty("--radix-popper-available-width",`${Fn}px`),ge.setProperty("--radix-popper-available-height",`${Hn}px`),ge.setProperty("--radix-popper-anchor-width",`${Vn}px`),ge.setProperty("--radix-popper-anchor-height",`${qn}px`)}}),b&&Lr({element:b,padding:c}),Vr({arrowWidth:E,arrowHeight:R}),y&&Or({strategy:"referenceHidden",..._})]}),[z,$]=yn(S),se=ee(v);G(()=>{D&&(se==null||se())},[D,se]);const fe=(ht=A.arrow)==null?void 0:ht.x,ae=(yt=A.arrow)==null?void 0:yt.y,ke=((mt=A.arrow)==null?void 0:mt.centerOffset)!==0,[In,zn]=d.useState();return G(()=>{g&&zn(window.getComputedStyle(g).zIndex)},[g]),M.jsx("div",{ref:T.setFloating,"data-radix-popper-content-wrapper":"",style:{...L,transform:D?L.transform:"translate(0, -200%)",minWidth:"max-content",zIndex:In,"--radix-popper-transform-origin":[(xt=A.transformOrigin)==null?void 0:xt.x,(vt=A.transformOrigin)==null?void 0:vt.y].join(" "),...((kt=A.hide)==null?void 0:kt.referenceHidden)&&{visibility:"hidden",pointerEvents:"none"}},dir:e.dir,children:M.jsx(Ir,{scope:n,placedSide:z,onArrowChange:C,arrowX:fe,arrowY:ae,shouldHideArrow:ke,children:M.jsx(H.div,{"data-side":z,"data-align":$,...x,ref:w,style:{...x.style,animation:D?void 0:"none"}})})})});fn.displayName=ct;var pn="PopperArrow",Fr={top:"bottom",right:"left",bottom:"top",left:"right"},hn=d.forwardRef(function(t,n){const{__scopePopper:o,...r}=t,s=zr(pn,o),a=Fr[s.placedSide];return M.jsx("span",{ref:s.onArrowChange,style:{position:"absolute",left:s.arrowX,top:s.arrowY,[a]:0,transformOrigin:{top:"",right:"0 0",bottom:"center 0",left:"100% 0"}[s.placedSide],transform:{top:"translateY(100%)",right:"translateY(50%) rotate(90deg) translateX(-50%)",bottom:"rotate(180deg)",left:"translateY(50%) rotate(-90deg) translateX(50%)"}[s.placedSide],visibility:s.shouldHideArrow?"hidden":void 0},children:M.jsx(Nr,{...r,ref:n,style:{...r.style,display:"block"}})})});hn.displayName=pn;function Hr(e){return e!==null}var Vr=e=>({name:"transformOrigin",options:e,fn(t){var m,g,k;const{placement:n,rects:o,middlewareData:r}=t,a=((m=r.arrow)==null?void 0:m.centerOffset)!==0,c=a?0:e.arrowWidth,l=a?0:e.arrowHeight,[i,u]=yn(n),p={start:"0%",center:"50%",end:"100%"}[u],y=(((g=r.arrow)==null?void 0:g.x)??0)+c/2,h=(((k=r.arrow)==null?void 0:k.y)??0)+l/2;let v="",x="";return i==="bottom"?(v=a?p:`${y}px`,x=`${-l}px`):i==="top"?(v=a?p:`${y}px`,x=`${o.floating.height+l}px`):i==="right"?(v=`${-l}px`,x=a?p:`${h}px`):i==="left"&&(v=`${o.floating.width+l}px`,x=a?p:`${h}px`),{data:{x:v,y:x}}}});function yn(e){const[t,n="center"]=e.split("-");return[t,n]}var qr=ln,$r=un,Br=fn,Wr=hn,Ur="Portal",mn=d.forwardRef((e,t)=>{var c;const{container:n,...o}=e,[r,s]=d.useState(!1);G(()=>s(!0),[]);const a=n||r&&((c=globalThis==null?void 0:globalThis.document)==null?void 0:c.body);return a?$n.createPortal(M.jsx(H.div,{...o,ref:t}),a):null});mn.displayName=Ur;function Kr(e,t){return d.useReducer((n,o)=>t[n][o]??n,e)}var lt=e=>{const{present:t,children:n}=e,o=Xr(t),r=typeof n=="function"?n({present:o.isPresent}):d.Children.only(n),s=B(o.ref,Yr(r));return typeof n=="function"||o.isPresent?d.cloneElement(r,{ref:s}):null};lt.displayName="Presence";function Xr(e){const[t,n]=d.useState(),o=d.useRef(null),r=d.useRef(e),s=d.useRef("none"),a=e?"mounted":"unmounted",[c,l]=Kr(a,{mounted:{UNMOUNT:"unmounted",ANIMATION_OUT:"unmountSuspended"},unmountSuspended:{MOUNT:"mounted",ANIMATION_END:"unmounted"},unmounted:{MOUNT:"mounted"}});return d.useEffect(()=>{const i=be(o.current);s.current=c==="mounted"?i:"none"},[c]),G(()=>{const i=o.current,u=r.current;if(u!==e){const y=s.current,h=be(i);e?l("MOUNT"):h==="none"||(i==null?void 0:i.display)==="none"?l("UNMOUNT"):l(u&&y!==h?"ANIMATION_OUT":"UNMOUNT"),r.current=e}},[e,l]),G(()=>{if(t){let i;const u=t.ownerDocument.defaultView??window,p=h=>{const x=be(o.current).includes(CSS.escape(h.animationName));if(h.target===t&&x&&(l("ANIMATION_END"),!r.current)){const m=t.style.animationFillMode;t.style.animationFillMode="forwards",i=u.setTimeout(()=>{t.style.animationFillMode==="forwards"&&(t.style.animationFillMode=m)})}},y=h=>{h.target===t&&(s.current=be(o.current))};return t.addEventListener("animationstart",y),t.addEventListener("animationcancel",p),t.addEventListener("animationend",p),()=>{u.clearTimeout(i),t.removeEventListener("animationstart",y),t.removeEventListener("animationcancel",p),t.removeEventListener("animationend",p)}}else l("ANIMATION_END")},[t,l]),{isPresent:["mounted","unmountSuspended"].includes(c),ref:d.useCallback(i=>{o.current=i?getComputedStyle(i):null,n(i)},[])}}function be(e){return(e==null?void 0:e.animationName)||"none"}function Yr(e){var o,r;let t=(o=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:o.get,n=t&&"isReactWarning"in t&&t.isReactWarning;return n?e.ref:(t=(r=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:r.get,n=t&&"isReactWarning"in t&&t.isReactWarning,n?e.props.ref:e.props.ref||e.ref)}var Zr=Object.freeze({position:"absolute",border:0,width:1,height:1,padding:0,margin:-1,overflow:"hidden",clip:"rect(0, 0, 0, 0)",whiteSpace:"nowrap",wordWrap:"normal"}),Gr="VisuallyHidden",je=d.forwardRef((e,t)=>M.jsx(H.span,{...e,ref:t,style:{...Zr,...e.style}}));je.displayName=Gr;var Qr=je,[Ie]=Oe("Tooltip",[an]),ze=an(),xn="TooltipProvider",Jr=700,Xe="tooltip.open",[es,dt]=Ie(xn),vn=e=>{const{__scopeTooltip:t,delayDuration:n=Jr,skipDelayDuration:o=300,disableHoverableContent:r=!1,children:s}=e,a=d.useRef(!0),c=d.useRef(!1),l=d.useRef(0);return d.useEffect(()=>{const i=l.current;return()=>window.clearTimeout(i)},[]),M.jsx(es,{scope:t,isOpenDelayedRef:a,delayDuration:n,onOpen:d.useCallback(()=>{window.clearTimeout(l.current),a.current=!1},[]),onClose:d.useCallback(()=>{window.clearTimeout(l.current),l.current=window.setTimeout(()=>a.current=!0,o)},[o]),isPointerInTransitRef:c,onPointerInTransitChange:d.useCallback(i=>{c.current=i},[]),disableHoverableContent:r,children:s})};vn.displayName=xn;var me="Tooltip",[ts,Fe]=Ie(me),kn=e=>{const{__scopeTooltip:t,children:n,open:o,defaultOpen:r,onOpenChange:s,disableHoverableContent:a,delayDuration:c}=e,l=dt(me,e.__scopeTooltip),i=ze(t),[u,p]=d.useState(null),y=bo(),h=d.useRef(0),v=a??l.disableHoverableContent,x=c??l.delayDuration,m=d.useRef(!1),[g,k]=qt({prop:o,defaultProp:r??!1,onChange:E=>{E?(l.onOpen(),document.dispatchEvent(new CustomEvent(Xe))):l.onClose(),s==null||s(E)},caller:me}),w=d.useMemo(()=>g?m.current?"delayed-open":"instant-open":"closed",[g]),b=d.useCallback(()=>{window.clearTimeout(h.current),h.current=0,m.current=!1,k(!0)},[k]),C=d.useCallback(()=>{window.clearTimeout(h.current),h.current=0,k(!1)},[k]),P=d.useCallback(()=>{window.clearTimeout(h.current),h.current=window.setTimeout(()=>{m.current=!0,k(!0),h.current=0},x)},[x,k]);return d.useEffect(()=>()=>{h.current&&(window.clearTimeout(h.current),h.current=0)},[]),M.jsx(qr,{...i,children:M.jsx(ts,{scope:t,contentId:y,open:g,stateAttribute:w,trigger:u,onTriggerChange:p,onTriggerEnter:d.useCallback(()=>{l.isOpenDelayedRef.current?P():b()},[l.isOpenDelayedRef,P,b]),onTriggerLeave:d.useCallback(()=>{v?C():(window.clearTimeout(h.current),h.current=0)},[C,v]),onOpen:b,onClose:C,disableHoverableContent:v,children:n})})};kn.displayName=me;var Ye="TooltipTrigger",gn=d.forwardRef((e,t)=>{const{__scopeTooltip:n,...o}=e,r=Fe(Ye,n),s=dt(Ye,n),a=ze(n),c=d.useRef(null),l=B(t,c,r.onTriggerChange),i=d.useRef(!1),u=d.useRef(!1),p=d.useCallback(()=>i.current=!1,[]);return d.useEffect(()=>()=>document.removeEventListener("pointerup",p),[p]),M.jsx($r,{asChild:!0,...a,children:M.jsx(H.button,{"aria-describedby":r.open?r.contentId:void 0,"data-state":r.stateAttribute,...o,ref:l,onPointerMove:F(e.onPointerMove,y=>{y.pointerType!=="touch"&&!u.current&&!s.isPointerInTransitRef.current&&(r.onTriggerEnter(),u.current=!0)}),onPointerLeave:F(e.onPointerLeave,()=>{r.onTriggerLeave(),u.current=!1}),onPointerDown:F(e.onPointerDown,()=>{r.open&&r.onClose(),i.current=!0,document.addEventListener("pointerup",p,{once:!0})}),onFocus:F(e.onFocus,()=>{i.current||r.onOpen()}),onBlur:F(e.onBlur,r.onClose),onClick:F(e.onClick,r.onClose)})})});gn.displayName=Ye;var ns="TooltipPortal",[gc,os]=Ie(ns,{forceMount:void 0}),le="TooltipContent",wn=d.forwardRef((e,t)=>{const n=os(le,e.__scopeTooltip),{forceMount:o=n.forceMount,side:r="top",...s}=e,a=Fe(le,e.__scopeTooltip);return M.jsx(lt,{present:o||a.open,children:a.disableHoverableContent?M.jsx(bn,{side:r,...s,ref:t}):M.jsx(rs,{side:r,...s,ref:t})})}),rs=d.forwardRef((e,t)=>{const n=Fe(le,e.__scopeTooltip),o=dt(le,e.__scopeTooltip),r=d.useRef(null),s=B(t,r),[a,c]=d.useState(null),{trigger:l,onClose:i}=n,u=r.current,{onPointerInTransitChange:p}=o,y=d.useCallback(()=>{c(null),p(!1)},[p]),h=d.useCallback((v,x)=>{const m=v.currentTarget,g={x:v.clientX,y:v.clientY},k=ls(g,m.getBoundingClientRect()),w=ds(g,k),b=us(x.getBoundingClientRect()),C=ps([...w,...b]);c(C),p(!0)},[p]);return d.useEffect(()=>()=>y(),[y]),d.useEffect(()=>{if(l&&u){const v=m=>h(m,u),x=m=>h(m,l);return l.addEventListener("pointerleave",v),u.addEventListener("pointerleave",x),()=>{l.removeEventListener("pointerleave",v),u.removeEventListener("pointerleave",x)}}},[l,u,h,y]),d.useEffect(()=>{if(a){const v=x=>{const m=x.target,g={x:x.clientX,y:x.clientY},k=(l==null?void 0:l.contains(m))||(u==null?void 0:u.contains(m)),w=!fs(g,a);k?y():w&&(y(),i())};return document.addEventListener("pointermove",v),()=>document.removeEventListener("pointermove",v)}},[l,u,a,i,y]),M.jsx(bn,{...e,ref:s})}),[ss,as]=Ie(me,{isInside:!1}),is=Gn("TooltipContent"),bn=d.forwardRef((e,t)=>{const{__scopeTooltip:n,children:o,"aria-label":r,onEscapeKeyDown:s,onPointerDownOutside:a,...c}=e,l=Fe(le,n),i=ze(n),{onClose:u}=l;return d.useEffect(()=>(document.addEventListener(Xe,u),()=>document.removeEventListener(Xe,u)),[u]),d.useEffect(()=>{if(l.trigger){const p=y=>{const h=y.target;h!=null&&h.contains(l.trigger)&&u()};return window.addEventListener("scroll",p,{capture:!0}),()=>window.removeEventListener("scroll",p,{capture:!0})}},[l.trigger,u]),M.jsx(et,{asChild:!0,disableOutsidePointerEvents:!1,onEscapeKeyDown:s,onPointerDownOutside:a,onFocusOutside:p=>p.preventDefault(),onDismiss:u,children:M.jsxs(Br,{"data-state":l.stateAttribute,...i,...c,ref:t,style:{...c.style,"--radix-tooltip-content-transform-origin":"var(--radix-popper-transform-origin)","--radix-tooltip-content-available-width":"var(--radix-popper-available-width)","--radix-tooltip-content-available-height":"var(--radix-popper-available-height)","--radix-tooltip-trigger-width":"var(--radix-popper-anchor-width)","--radix-tooltip-trigger-height":"var(--radix-popper-anchor-height)"},children:[M.jsx(is,{children:o}),M.jsx(ss,{scope:n,isInside:!0,children:M.jsx(Qr,{id:l.contentId,role:"tooltip",children:r||o})})]})})});wn.displayName=le;var Mn="TooltipArrow",cs=d.forwardRef((e,t)=>{const{__scopeTooltip:n,...o}=e,r=ze(n);return as(Mn,n).isInside?null:M.jsx(Wr,{...r,...o,ref:t})});cs.displayName=Mn;function ls(e,t){const n=Math.abs(t.top-e.y),o=Math.abs(t.bottom-e.y),r=Math.abs(t.right-e.x),s=Math.abs(t.left-e.x);switch(Math.min(n,o,r,s)){case s:return"left";case r:return"right";case n:return"top";case o:return"bottom";default:throw new Error("unreachable")}}function ds(e,t,n=5){const o=[];switch(t){case"top":o.push({x:e.x-n,y:e.y+n},{x:e.x+n,y:e.y+n});break;case"bottom":o.push({x:e.x-n,y:e.y-n},{x:e.x+n,y:e.y-n});break;case"left":o.push({x:e.x+n,y:e.y-n},{x:e.x+n,y:e.y+n});break;case"right":o.push({x:e.x-n,y:e.y-n},{x:e.x-n,y:e.y+n});break}return o}function us(e){const{top:t,right:n,bottom:o,left:r}=e;return[{x:r,y:t},{x:n,y:t},{x:n,y:o},{x:r,y:o}]}function fs(e,t){const{x:n,y:o}=e;let r=!1;for(let s=0,a=t.length-1;s<t.length;a=s++){const c=t[s],l=t[a],i=c.x,u=c.y,p=l.x,y=l.y;u>o!=y>o&&n<(p-i)*(o-u)/(y-u)+i&&(r=!r)}return r}function ps(e){const t=e.slice();return t.sort((n,o)=>n.x<o.x?-1:n.x>o.x?1:n.y<o.y?-1:n.y>o.y?1:0),hs(t)}function hs(e){if(e.length<=1)return e.slice();const t=[];for(let o=0;o<e.length;o++){const r=e[o];for(;t.length>=2;){const s=t[t.length-1],a=t[t.length-2];if((s.x-a.x)*(r.y-a.y)>=(s.y-a.y)*(r.x-a.x))t.pop();else break}t.push(r)}t.pop();const n=[];for(let o=e.length-1;o>=0;o--){const r=e[o];for(;n.length>=2;){const s=n[n.length-1],a=n[n.length-2];if((s.x-a.x)*(r.y-a.y)>=(s.y-a.y)*(r.x-a.x))n.pop();else break}n.push(r)}return n.pop(),t.length===1&&n.length===1&&t[0].x===n[0].x&&t[0].y===n[0].y?t:t.concat(n)}var wc=vn,bc=kn,Mc=gn,Cc=wn,ut="ToastProvider",[ft,ys,ms]=lo("Toast"),[Cn]=Oe("Toast",[ms]),[xs,He]=Cn(ut),En=e=>{const{__scopeToast:t,label:n="Notification",duration:o=5e3,swipeDirection:r="right",swipeThreshold:s=50,children:a}=e,[c,l]=d.useState(null),[i,u]=d.useState(0),p=d.useRef(!1),y=d.useRef(!1);return n.trim()||console.error(`Invalid prop \`label\` supplied to \`${ut}\`. Expected non-empty \`string\`.`),M.jsx(ft.Provider,{scope:t,children:M.jsx(xs,{scope:t,label:n,duration:o,swipeDirection:r,swipeThreshold:s,toastCount:i,viewport:c,onViewportChange:l,onToastAdd:d.useCallback(()=>u(h=>h+1),[]),onToastRemove:d.useCallback(()=>u(h=>h-1),[]),isFocusedToastEscapeKeyDownRef:p,isClosePausedRef:y,children:a})})};En.displayName=ut;var Tn="ToastViewport",vs=["F8"],Ze="toast.viewportPause",Ge="toast.viewportResume",Pn=d.forwardRef((e,t)=>{const{__scopeToast:n,hotkey:o=vs,label:r="Notifications ({hotkey})",...s}=e,a=He(Tn,n),c=ys(n),l=d.useRef(null),i=d.useRef(null),u=d.useRef(null),p=d.useRef(null),y=B(t,p,a.onViewportChange),h=o.join("+").replace(/Key/g,"").replace(/Digit/g,""),v=a.toastCount>0;d.useEffect(()=>{const m=g=>{var w;o.length!==0&&o.every(b=>g[b]||g.code===b)&&((w=p.current)==null||w.focus())};return document.addEventListener("keydown",m),()=>document.removeEventListener("keydown",m)},[o]),d.useEffect(()=>{const m=l.current,g=p.current;if(v&&m&&g){const k=()=>{if(!a.isClosePausedRef.current){const P=new CustomEvent(Ze);g.dispatchEvent(P),a.isClosePausedRef.current=!0}},w=()=>{if(a.isClosePausedRef.current){const P=new CustomEvent(Ge);g.dispatchEvent(P),a.isClosePausedRef.current=!1}},b=P=>{!m.contains(P.relatedTarget)&&w()},C=()=>{m.contains(document.activeElement)||w()};return m.addEventListener("focusin",k),m.addEventListener("focusout",b),m.addEventListener("pointermove",k),m.addEventListener("pointerleave",C),window.addEventListener("blur",k),window.addEventListener("focus",w),()=>{m.removeEventListener("focusin",k),m.removeEventListener("focusout",b),m.removeEventListener("pointermove",k),m.removeEventListener("pointerleave",C),window.removeEventListener("blur",k),window.removeEventListener("focus",w)}}},[v,a.isClosePausedRef]);const x=d.useCallback(({tabbingDirection:m})=>{const k=c().map(w=>{const b=w.ref.current,C=[b,...Os(b)];return m==="forwards"?C:C.reverse()});return(m==="forwards"?k.reverse():k).flat()},[c]);return d.useEffect(()=>{const m=p.current;if(m){const g=k=>{var C,P,E;const w=k.altKey||k.ctrlKey||k.metaKey;if(k.key==="Tab"&&!w){const R=document.activeElement,N=k.shiftKey;if(k.target===m&&N){(C=i.current)==null||C.focus();return}const j=x({tabbingDirection:N?"backwards":"forwards"}),_=j.findIndex(T=>T===R);$e(j.slice(_+1))?k.preventDefault():N?(P=i.current)==null||P.focus():(E=u.current)==null||E.focus()}};return m.addEventListener("keydown",g),()=>m.removeEventListener("keydown",g)}},[c,x]),M.jsxs(ko,{ref:l,role:"region","aria-label":r.replace("{hotkey}",h),tabIndex:-1,style:{pointerEvents:v?void 0:"none"},children:[v&&M.jsx(Qe,{ref:i,onFocusFromOutsideViewport:()=>{const m=x({tabbingDirection:"forwards"});$e(m)}}),M.jsx(ft.Slot,{scope:n,children:M.jsx(H.ol,{tabIndex:-1,...s,ref:y})}),v&&M.jsx(Qe,{ref:u,onFocusFromOutsideViewport:()=>{const m=x({tabbingDirection:"backwards"});$e(m)}})]})});Pn.displayName=Tn;var An="ToastFocusProxy",Qe=d.forwardRef((e,t)=>{const{__scopeToast:n,onFocusFromOutsideViewport:o,...r}=e,s=He(An,n);return M.jsx(je,{tabIndex:0,...r,ref:t,style:{position:"fixed"},onFocus:a=>{var i;const c=a.relatedTarget;!((i=s.viewport)!=null&&i.contains(c))&&o()}})});Qe.displayName=An;var ve="Toast",ks="toast.swipeStart",gs="toast.swipeMove",ws="toast.swipeCancel",bs="toast.swipeEnd",Rn=d.forwardRef((e,t)=>{const{forceMount:n,open:o,defaultOpen:r,onOpenChange:s,...a}=e,[c,l]=qt({prop:o,defaultProp:r??!0,onChange:s,caller:ve});return M.jsx(lt,{present:n||c,children:M.jsx(Es,{open:c,...a,ref:t,onClose:()=>l(!1),onPause:ee(e.onPause),onResume:ee(e.onResume),onSwipeStart:F(e.onSwipeStart,i=>{i.currentTarget.setAttribute("data-swipe","start")}),onSwipeMove:F(e.onSwipeMove,i=>{const{x:u,y:p}=i.detail.delta;i.currentTarget.setAttribute("data-swipe","move"),i.currentTarget.style.setProperty("--radix-toast-swipe-move-x",`${u}px`),i.currentTarget.style.setProperty("--radix-toast-swipe-move-y",`${p}px`)}),onSwipeCancel:F(e.onSwipeCancel,i=>{i.currentTarget.setAttribute("data-swipe","cancel"),i.currentTarget.style.removeProperty("--radix-toast-swipe-move-x"),i.currentTarget.style.removeProperty("--radix-toast-swipe-move-y"),i.currentTarget.style.removeProperty("--radix-toast-swipe-end-x"),i.currentTarget.style.removeProperty("--radix-toast-swipe-end-y")}),onSwipeEnd:F(e.onSwipeEnd,i=>{const{x:u,y:p}=i.detail.delta;i.currentTarget.setAttribute("data-swipe","end"),i.currentTarget.style.removeProperty("--radix-toast-swipe-move-x"),i.currentTarget.style.removeProperty("--radix-toast-swipe-move-y"),i.currentTarget.style.setProperty("--radix-toast-swipe-end-x",`${u}px`),i.currentTarget.style.setProperty("--radix-toast-swipe-end-y",`${p}px`),l(!1)})})})});Rn.displayName=ve;var[Ms,Cs]=Cn(ve,{onClose(){}}),Es=d.forwardRef((e,t)=>{const{__scopeToast:n,type:o="foreground",duration:r,open:s,onClose:a,onEscapeKeyDown:c,onPause:l,onResume:i,onSwipeStart:u,onSwipeMove:p,onSwipeCancel:y,onSwipeEnd:h,...v}=e,x=He(ve,n),[m,g]=d.useState(null),k=B(t,T=>g(T)),w=d.useRef(null),b=d.useRef(null),C=r||x.duration,P=d.useRef(0),E=d.useRef(C),R=d.useRef(0),{onToastAdd:N,onToastRemove:O}=x,I=ee(()=>{var L;(m==null?void 0:m.contains(document.activeElement))&&((L=x.viewport)==null||L.focus()),a()}),j=d.useCallback(T=>{!T||T===1/0||(window.clearTimeout(R.current),P.current=new Date().getTime(),R.current=window.setTimeout(I,T))},[I]);d.useEffect(()=>{const T=x.viewport;if(T){const L=()=>{j(E.current),i==null||i()},S=()=>{const D=new Date().getTime()-P.current;E.current=E.current-D,window.clearTimeout(R.current),l==null||l()};return T.addEventListener(Ze,S),T.addEventListener(Ge,L),()=>{T.removeEventListener(Ze,S),T.removeEventListener(Ge,L)}}},[x.viewport,C,l,i,j]),d.useEffect(()=>{s&&!x.isClosePausedRef.current&&j(C)},[s,C,x.isClosePausedRef,j]),d.useEffect(()=>(N(),()=>O()),[N,O]);const _=d.useMemo(()=>m?jn(m):null,[m]);return x.viewport?M.jsxs(M.Fragment,{children:[_&&M.jsx(Ts,{__scopeToast:n,role:"status","aria-live":o==="foreground"?"assertive":"polite",children:_}),M.jsx(Ms,{scope:n,onClose:I,children:Je.createPortal(M.jsx(ft.ItemSlot,{scope:n,children:M.jsx(vo,{asChild:!0,onEscapeKeyDown:F(c,()=>{x.isFocusedToastEscapeKeyDownRef.current||I(),x.isFocusedToastEscapeKeyDownRef.current=!1}),children:M.jsx(H.li,{tabIndex:0,"data-state":s?"open":"closed","data-swipe-direction":x.swipeDirection,...v,ref:k,style:{userSelect:"none",touchAction:"none",...e.style},onKeyDown:F(e.onKeyDown,T=>{T.key==="Escape"&&(c==null||c(T.nativeEvent),T.nativeEvent.defaultPrevented||(x.isFocusedToastEscapeKeyDownRef.current=!0,I()))}),onPointerDown:F(e.onPointerDown,T=>{T.button===0&&(w.current={x:T.clientX,y:T.clientY})}),onPointerMove:F(e.onPointerMove,T=>{if(!w.current)return;const L=T.clientX-w.current.x,S=T.clientY-w.current.y,D=!!b.current,A=["left","right"].includes(x.swipeDirection),z=["left","up"].includes(x.swipeDirection)?Math.min:Math.max,$=A?z(0,L):0,se=A?0:z(0,S),fe=T.pointerType==="touch"?10:2,ae={x:$,y:se},ke={originalEvent:T,delta:ae};D?(b.current=ae,Me(gs,p,ke,{discrete:!1})):_t(ae,x.swipeDirection,fe)?(b.current=ae,Me(ks,u,ke,{discrete:!1}),T.target.setPointerCapture(T.pointerId)):(Math.abs(L)>fe||Math.abs(S)>fe)&&(w.current=null)}),onPointerUp:F(e.onPointerUp,T=>{const L=b.current,S=T.target;if(S.hasPointerCapture(T.pointerId)&&S.releasePointerCapture(T.pointerId),b.current=null,w.current=null,L){const D=T.currentTarget,A={originalEvent:T,delta:L};_t(L,x.swipeDirection,x.swipeThreshold)?Me(bs,h,A,{discrete:!0}):Me(ws,y,A,{discrete:!0}),D.addEventListener("click",z=>z.preventDefault(),{once:!0})}})})})}),x.viewport)})]}):null}),Ts=e=>{const{__scopeToast:t,children:n,...o}=e,r=He(ve,t),[s,a]=d.useState(!1),[c,l]=d.useState(!1);return Rs(()=>a(!0)),d.useEffect(()=>{const i=window.setTimeout(()=>l(!0),1e3);return()=>window.clearTimeout(i)},[]),c?null:M.jsx(mn,{asChild:!0,children:M.jsx(je,{...o,children:s&&M.jsxs(M.Fragment,{children:[r.label," ",n]})})})},Ps="ToastTitle",Sn=d.forwardRef((e,t)=>{const{__scopeToast:n,...o}=e;return M.jsx(H.div,{...o,ref:t})});Sn.displayName=Ps;var As="ToastDescription",On=d.forwardRef((e,t)=>{const{__scopeToast:n,...o}=e;return M.jsx(H.div,{...o,ref:t})});On.displayName=As;var Ln="ToastAction",Dn=d.forwardRef((e,t)=>{const{altText:n,...o}=e;return n.trim()?M.jsx(_n,{altText:n,asChild:!0,children:M.jsx(pt,{...o,ref:t})}):(console.error(`Invalid prop \`altText\` supplied to \`${Ln}\`. Expected non-empty \`string\`.`),null)});Dn.displayName=Ln;var Nn="ToastClose",pt=d.forwardRef((e,t)=>{const{__scopeToast:n,...o}=e,r=Cs(Nn,n);return M.jsx(_n,{asChild:!0,children:M.jsx(H.button,{type:"button",...o,ref:t,onClick:F(e.onClick,r.onClose)})})});pt.displayName=Nn;var _n=d.forwardRef((e,t)=>{const{__scopeToast:n,altText:o,...r}=e;return M.jsx(H.div,{"data-radix-toast-announce-exclude":"","data-radix-toast-announce-alt":o||void 0,...r,ref:t})});function jn(e){const t=[];return Array.from(e.childNodes).forEach(o=>{if(o.nodeType===o.TEXT_NODE&&o.textContent&&t.push(o.textContent),Ss(o)){const r=o.ariaHidden||o.hidden||o.style.display==="none",s=o.dataset.radixToastAnnounceExclude==="";if(!r)if(s){const a=o.dataset.radixToastAnnounceAlt;a&&t.push(a)}else t.push(...jn(o))}}),t}function Me(e,t,n,{discrete:o}){const r=n.originalEvent.currentTarget,s=new CustomEvent(e,{bubbles:!0,cancelable:!0,detail:n});t&&r.addEventListener(e,t,{once:!0}),o?$t(r,s):r.dispatchEvent(s)}var _t=(e,t,n=0)=>{const o=Math.abs(e.x),r=Math.abs(e.y),s=o>r;return t==="left"||t==="right"?s&&o>n:!s&&r>n};function Rs(e=()=>{}){const t=ee(e);G(()=>{let n=0,o=0;return n=window.requestAnimationFrame(()=>o=window.requestAnimationFrame(t)),()=>{window.cancelAnimationFrame(n),window.cancelAnimationFrame(o)}},[t])}function Ss(e){return e.nodeType===e.ELEMENT_NODE}function Os(e){const t=[],n=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT,{acceptNode:o=>{const r=o.tagName==="INPUT"&&o.type==="hidden";return o.disabled||o.hidden||r?NodeFilter.FILTER_SKIP:o.tabIndex>=0?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP}});for(;n.nextNode();)t.push(n.currentNode);return t}function $e(e){const t=document.activeElement;return e.some(n=>n===t?!0:(n.focus(),document.activeElement!==t))}var Ec=En,Tc=Pn,Pc=Rn,Ac=Sn,Rc=On,Sc=Dn,Oc=pt;export{Va as $,$r as A,Vs as B,Br as C,et as D,Li as E,Aa as F,Ia as G,$a as H,Vi as I,da as J,ri as K,Ga as L,ki as M,oi as N,ya as O,H as P,ec as Q,qr as R,Ds as S,oc as T,Cc as U,bc as V,pc as W,Mc as X,wc as Y,Ra as Z,Ea as _,B as a,Ni as a$,Us as a0,sa as a1,dc as a2,xa as a3,va as a4,Zi as a5,Hi as a6,aa as a7,Js as a8,na as a9,lc as aA,ei as aB,Tc as aC,Pc as aD,Sc as aE,Oc as aF,Ac as aG,Rc as aH,Ec as aI,Da as aJ,Na as aK,Xi as aL,pa as aM,ic as aN,ea as aO,oa as aP,ra as aQ,Ca as aR,ga as aS,Qr as aT,_r as aU,Mi as aV,zs as aW,ba as aX,Ei as aY,ti as aZ,Pi as a_,mc as aa,ac as ab,li as ac,mi as ad,yc as ae,kc as af,Gn as ag,G as ah,ui as ai,Oi as aj,uc as ak,qa as al,$i as am,ma as an,ua as ao,qs as ap,La as aq,Fs as ar,Gs as as,Wa as at,ia as au,Ws as av,Ki as aw,Za as ax,di as ay,ja as az,lo as b,Xs as b$,ca as b0,Bi as b1,Ys as b2,Ka as b3,nc as b4,Bs as b5,$s as b6,Ks as b7,fa as b8,ha as b9,zi as bA,Ua as bB,Ui as bC,si as bD,Ma as bE,Ba as bF,xi as bG,hc as bH,wi as bI,ci as bJ,Zr as bK,wa as bL,ji as bM,Ta as bN,Di as bO,Ha as bP,Ai as bQ,Ri as bR,Si as bS,Ti as bT,Gi as bU,_s as bV,ka as bW,Hs as bX,_a as bY,Yi as bZ,fc as b_,Ji as ba,za as bb,Zs as bc,bi as bd,fi as be,Pa as bf,Ya as bg,ni as bh,Fa as bi,Oa as bj,Ii as bk,pi as bl,yi as bm,Ja as bn,Xa as bo,Qa as bp,xc as bq,je as br,vc as bs,_i as bt,gi as bu,Sa as bv,hi as bw,qi as bx,ai as by,Ns as bz,Oe as c,sc as c0,rc as c1,tc as c2,Ci as c3,bo as d,F as e,qt as f,Ft as g,lt as h,mn as i,M as j,an as k,Ee as l,$t as m,Wr as n,ta as o,Qs as p,la as q,Qi as r,vi as s,Is as t,ee as u,js as v,cc as w,ii as x,Wi as y,Fi as z};
