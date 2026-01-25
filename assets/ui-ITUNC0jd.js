import{r as s,R as Ze,a as tn,b as S,c as nn}from"./vendor-Cmm2Fedx.js";var Ke={exports:{}},oe={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var rn=s,an=Symbol.for("react.element"),on=Symbol.for("react.fragment"),cn=Object.prototype.hasOwnProperty,sn=rn.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,ln={key:!0,ref:!0,__self:!0,__source:!0};function Xe(e,t,n){var r,a={},o=null,i=null;n!==void 0&&(o=""+n),t.key!==void 0&&(o=""+t.key),t.ref!==void 0&&(i=t.ref);for(r in t)cn.call(t,r)&&!ln.hasOwnProperty(r)&&(a[r]=t[r]);if(e&&e.defaultProps)for(r in t=e.defaultProps,t)a[r]===void 0&&(a[r]=t[r]);return{$$typeof:an,type:e,key:o,ref:i,props:a,_owner:sn.current}}oe.Fragment=on;oe.jsx=Xe;oe.jsxs=Xe;Ke.exports=oe;var p=Ke.exports;function De(e,t){if(typeof e=="function")return e(t);e!=null&&(e.current=t)}function Ye(...e){return t=>{let n=!1;const r=e.map(a=>{const o=De(a,t);return!n&&typeof o=="function"&&(n=!0),o});if(n)return()=>{for(let a=0;a<r.length;a++){const o=r[a];typeof o=="function"?o():De(e[a],null)}}}}function N(...e){return s.useCallback(Ye(...e),e)}function G(e){const t=un(e),n=s.forwardRef((r,a)=>{const{children:o,...i}=r,c=s.Children.toArray(o),f=c.find(dn);if(f){const u=f.props.children,h=c.map(y=>y===f?s.Children.count(u)>1?s.Children.only(null):s.isValidElement(u)?u.props.children:null:y);return p.jsx(t,{...i,ref:a,children:s.isValidElement(u)?s.cloneElement(u,void 0,h):null})}return p.jsx(t,{...i,ref:a,children:o})});return n.displayName=`${e}.Slot`,n}var xa=G("Slot");function un(e){const t=s.forwardRef((n,r)=>{const{children:a,...o}=n;if(s.isValidElement(a)){const i=hn(a),c=fn(o,a.props);return a.type!==s.Fragment&&(c.ref=r?Ye(r,i):i),s.cloneElement(a,c)}return s.Children.count(a)>1?s.Children.only(null):null});return t.displayName=`${e}.SlotClone`,t}var Qe=Symbol("radix.slottable");function ba(e){const t=({children:n})=>p.jsx(p.Fragment,{children:n});return t.displayName=`${e}.Slottable`,t.__radixId=Qe,t}function dn(e){return s.isValidElement(e)&&typeof e.type=="function"&&"__radixId"in e.type&&e.type.__radixId===Qe}function fn(e,t){const n={...t};for(const r in t){const a=e[r],o=t[r];/^on[A-Z]/.test(r)?a&&o?n[r]=(...c)=>{const f=o(...c);return a(...c),f}:a&&(n[r]=a):r==="style"?n[r]={...a,...o}:r==="className"&&(n[r]=[a,o].filter(Boolean).join(" "))}return{...e,...n}}function hn(e){var r,a;let t=(r=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:r.get,n=t&&"isReactWarning"in t&&t.isReactWarning;return n?e.ref:(t=(a=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:a.get,n=t&&"isReactWarning"in t&&t.isReactWarning,n?e.props.ref:e.props.ref||e.ref)}/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yn=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),Je=(...e)=>e.filter((t,n,r)=>!!t&&t.trim()!==""&&r.indexOf(t)===n).join(" ").trim();/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var pn={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vn=s.forwardRef(({color:e="currentColor",size:t=24,strokeWidth:n=2,absoluteStrokeWidth:r,className:a="",children:o,iconNode:i,...c},f)=>s.createElement("svg",{ref:f,...pn,width:t,height:t,stroke:e,strokeWidth:r?Number(n)*24/Number(t):n,className:Je("lucide",a),...c},[...i.map(([u,h])=>s.createElement(u,h)),...Array.isArray(o)?o:[o]]));/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=(e,t)=>{const n=s.forwardRef(({className:r,...a},o)=>s.createElement(vn,{ref:o,iconNode:t,className:Je(`lucide-${yn(e)}`,r),...a}));return n.displayName=`${e}`,n};/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ca=l("Activity",[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",key:"169zse"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ma=l("ArrowDown",[["path",{d:"M12 5v14",key:"s699le"}],["path",{d:"m19 12-7 7-7-7",key:"1idqje"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wa=l("ArrowLeft",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ea=l("ArrowRight",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sa=l("ArrowUp",[["path",{d:"m5 12 7-7 7 7",key:"hav0vg"}],["path",{d:"M12 19V5",key:"x0mq9r"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Aa=l("BookDashed",[["path",{d:"M12 17h2",key:"13u4lk"}],["path",{d:"M12 22h2",key:"kn7ki6"}],["path",{d:"M12 2h2",key:"cvn524"}],["path",{d:"M18 22h1a1 1 0 0 0 1-1",key:"w6gbqz"}],["path",{d:"M18 2h1a1 1 0 0 1 1 1v1",key:"1vpra5"}],["path",{d:"M20 15v2h-2",key:"fph276"}],["path",{d:"M20 8v3",key:"deu0bs"}],["path",{d:"M4 11V9",key:"v3xsx8"}],["path",{d:"M4 19.5V15",key:"6gr39e"}],["path",{d:"M4 5v-.5A2.5 2.5 0 0 1 6.5 2H8",key:"wywhs9"}],["path",{d:"M8 22H6.5a1 1 0 0 1 0-5H8",key:"1cu73q"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ra=l("BookOpen",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pa=l("BookmarkCheck",[["path",{d:"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z",key:"169p4p"}],["path",{d:"m9 10 2 2 4-4",key:"1gnqz4"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Na=l("Bookmark",[["path",{d:"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z",key:"1fy3hk"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const La=l("Bot",[["path",{d:"M12 8V4H8",key:"hb8ula"}],["rect",{width:"16",height:"12",x:"4",y:"8",rx:"2",key:"enze0r"}],["path",{d:"M2 14h2",key:"vft8re"}],["path",{d:"M20 14h2",key:"4cs60a"}],["path",{d:"M15 13v2",key:"1xurst"}],["path",{d:"M9 13v2",key:"rq6x2g"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ia=l("Brain",[["path",{d:"M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",key:"l5xja"}],["path",{d:"M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z",key:"ep3f8r"}],["path",{d:"M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4",key:"1p4c4q"}],["path",{d:"M17.599 6.5a3 3 0 0 0 .399-1.375",key:"tmeiqw"}],["path",{d:"M6.003 5.125A3 3 0 0 0 6.401 6.5",key:"105sqy"}],["path",{d:"M3.477 10.896a4 4 0 0 1 .585-.396",key:"ql3yin"}],["path",{d:"M19.938 10.5a4 4 0 0 1 .585.396",key:"1qfode"}],["path",{d:"M6 18a4 4 0 0 1-1.967-.516",key:"2e4loj"}],["path",{d:"M19.967 17.484A4 4 0 0 1 18 18",key:"159ez6"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oa=l("Calendar",[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Da=l("ChartColumn",[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ta=l("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _a=l("ChevronDown",[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ja=l("ChevronLeft",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const za=l("ChevronRight",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fa=l("ChevronUp",[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qa=l("ChevronsLeft",[["path",{d:"m11 17-5-5 5-5",key:"13zhaf"}],["path",{d:"m18 17-5-5 5-5",key:"h8a8et"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ha=l("ChevronsRight",[["path",{d:"m6 17 5-5-5-5",key:"xnjwq"}],["path",{d:"m13 17 5-5-5-5",key:"17xmmf"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Va=l("CircleAlert",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wa=l("CircleCheckBig",[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ba=l("CircleCheck",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $a=l("CircleX",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ua=l("Circle",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ga=l("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Za=l("Cloud",[["path",{d:"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z",key:"p7xjir"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ka=l("CodeXml",[["path",{d:"m18 16 4-4-4-4",key:"1inbqp"}],["path",{d:"m6 8-4 4 4 4",key:"15zrgr"}],["path",{d:"m14.5 4-5 16",key:"e7oirm"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xa=l("Compass",[["path",{d:"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z",key:"9ktpf1"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ya=l("Copy",[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qa=l("Cpu",[["rect",{width:"16",height:"16",x:"4",y:"4",rx:"2",key:"14l7u7"}],["rect",{width:"6",height:"6",x:"9",y:"9",rx:"1",key:"5aljv4"}],["path",{d:"M15 2v2",key:"13l42r"}],["path",{d:"M15 20v2",key:"15mkzm"}],["path",{d:"M2 15h2",key:"1gxd5l"}],["path",{d:"M2 9h2",key:"1bbxkp"}],["path",{d:"M20 15h2",key:"19e6y8"}],["path",{d:"M20 9h2",key:"19tzq7"}],["path",{d:"M9 2v2",key:"165o2o"}],["path",{d:"M9 20v2",key:"i2bqo8"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ja=l("Database",[["ellipse",{cx:"12",cy:"5",rx:"9",ry:"3",key:"msslwz"}],["path",{d:"M3 5V19A9 3 0 0 0 21 19V5",key:"1wlel7"}],["path",{d:"M3 12A9 3 0 0 0 21 12",key:"mv7ke4"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const eo=l("DollarSign",[["line",{x1:"12",x2:"12",y1:"2",y2:"22",key:"7eqyqh"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",key:"1b0p4s"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const to=l("Dot",[["circle",{cx:"12.1",cy:"12.1",r:"1",key:"18d7e5"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const no=l("Download",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"7 10 12 15 17 10",key:"2ggqvy"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3",key:"1vk2je"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ro=l("Earth",[["path",{d:"M21.54 15H17a2 2 0 0 0-2 2v4.54",key:"1djwo0"}],["path",{d:"M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17",key:"1tzkfa"}],["path",{d:"M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05",key:"14pb5j"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ao=l("EllipsisVertical",[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"12",cy:"5",r:"1",key:"gxeob9"}],["circle",{cx:"12",cy:"19",r:"1",key:"lyex9k"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oo=l("Ellipsis",[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"19",cy:"12",r:"1",key:"1wjl8i"}],["circle",{cx:"5",cy:"12",r:"1",key:"1pcz8c"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const co=l("ExternalLink",[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const so=l("EyeOff",[["path",{d:"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",key:"ct8e1f"}],["path",{d:"M14.084 14.158a3 3 0 0 1-4.242-4.242",key:"151rxh"}],["path",{d:"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",key:"13bj9a"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const io=l("Eye",[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const lo=l("FileText",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const uo=l("Filter",[["polygon",{points:"22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3",key:"1yg77f"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fo=l("FlaskConical",[["path",{d:"M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2",key:"pzvekw"}],["path",{d:"M8.5 2h7",key:"csnxdl"}],["path",{d:"M7 16h10",key:"wp8him"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ho=l("FolderOpen",[["path",{d:"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",key:"usdka0"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yo=l("Folder",[["path",{d:"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",key:"1kt360"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const po=l("GitBranch",[["line",{x1:"6",x2:"6",y1:"3",y2:"15",key:"17qcm7"}],["circle",{cx:"18",cy:"6",r:"3",key:"1h7g24"}],["circle",{cx:"6",cy:"18",r:"3",key:"fqmcym"}],["path",{d:"M18 9a9 9 0 0 1-9 9",key:"n2h4wq"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vo=l("Github",[["path",{d:"M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4",key:"tonef"}],["path",{d:"M9 18c-4.51 2-5-2-7-2",key:"9comsn"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const mo=l("Globe",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",key:"13o1zl"}],["path",{d:"M2 12h20",key:"9i4pu4"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ko=l("GraduationCap",[["path",{d:"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z",key:"j76jl0"}],["path",{d:"M22 10v6",key:"1lu8f3"}],["path",{d:"M6 12.5V16a6 3 0 0 0 12 0v-3.5",key:"1r8lef"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const go=l("HardDrive",[["line",{x1:"22",x2:"2",y1:"12",y2:"12",key:"1y58io"}],["path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",key:"oot6mr"}],["line",{x1:"6",x2:"6.01",y1:"16",y2:"16",key:"sgf278"}],["line",{x1:"10",x2:"10.01",y1:"16",y2:"16",key:"1l4acy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xo=l("Hash",[["line",{x1:"4",x2:"20",y1:"9",y2:"9",key:"4lhtct"}],["line",{x1:"4",x2:"20",y1:"15",y2:"15",key:"vyu0kd"}],["line",{x1:"10",x2:"8",y1:"3",y2:"21",key:"1ggp8o"}],["line",{x1:"16",x2:"14",y1:"3",y2:"21",key:"weycgp"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const bo=l("History",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Co=l("House",[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"1d0kgt"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Mo=l("Image",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2",key:"1m3agn"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",key:"1xmnt7"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wo=l("Key",[["path",{d:"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4",key:"g0fldk"}],["path",{d:"m21 2-9.6 9.6",key:"1j0ho8"}],["circle",{cx:"7.5",cy:"15.5",r:"5.5",key:"yqb3hr"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Eo=l("Languages",[["path",{d:"m5 8 6 6",key:"1wu5hv"}],["path",{d:"m4 14 6-6 2-3",key:"1k1g8d"}],["path",{d:"M2 5h12",key:"or177f"}],["path",{d:"M7 2h1",key:"1t2jsx"}],["path",{d:"m22 22-5-10-5 10",key:"don7ne"}],["path",{d:"M14 18h6",key:"1m8k6r"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const So=l("Layers",[["path",{d:"m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",key:"8b97xw"}],["path",{d:"m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65",key:"dd6zsq"}],["path",{d:"m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65",key:"ep9fru"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ao=l("Lightbulb",[["path",{d:"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",key:"1gvzjb"}],["path",{d:"M9 18h6",key:"x1upvd"}],["path",{d:"M10 22h4",key:"ceow96"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ro=l("Link2",[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Po=l("Linkedin",[["path",{d:"M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z",key:"c2jq9f"}],["rect",{width:"4",height:"12",x:"2",y:"9",key:"mk3on5"}],["circle",{cx:"4",cy:"4",r:"2",key:"bt5ra8"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const No=l("ListOrdered",[["path",{d:"M10 12h11",key:"6m4ad9"}],["path",{d:"M10 18h11",key:"11hvi2"}],["path",{d:"M10 6h11",key:"c7qv1k"}],["path",{d:"M4 10h2",key:"16xx2s"}],["path",{d:"M4 6h1v4",key:"cnovpq"}],["path",{d:"M6 18H4c0-1 2-2 2-3s-1-1.5-2-1",key:"m9a95d"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Lo=l("List",[["path",{d:"M3 12h.01",key:"nlz23k"}],["path",{d:"M3 18h.01",key:"1tta3j"}],["path",{d:"M3 6h.01",key:"1rqtza"}],["path",{d:"M8 12h13",key:"1za7za"}],["path",{d:"M8 18h13",key:"1lx6n3"}],["path",{d:"M8 6h13",key:"ik3vkj"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Io=l("LoaderCircle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oo=l("Lock",[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Do=l("Mail",[["rect",{width:"20",height:"16",x:"2",y:"4",rx:"2",key:"18n3k1"}],["path",{d:"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7",key:"1ocrg3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const To=l("Map",[["path",{d:"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",key:"169xi5"}],["path",{d:"M15 5.764v15",key:"1pn4in"}],["path",{d:"M9 3.236v15",key:"1uimfh"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _o=l("Maximize2",[["polyline",{points:"15 3 21 3 21 9",key:"mznyad"}],["polyline",{points:"9 21 3 21 3 15",key:"1avn1i"}],["line",{x1:"21",x2:"14",y1:"3",y2:"10",key:"ota7mn"}],["line",{x1:"3",x2:"10",y1:"21",y2:"14",key:"1atl0r"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const jo=l("Menu",[["line",{x1:"4",x2:"20",y1:"12",y2:"12",key:"1e0a9i"}],["line",{x1:"4",x2:"20",y1:"6",y2:"6",key:"1owob3"}],["line",{x1:"4",x2:"20",y1:"18",y2:"18",key:"yk5zj1"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zo=l("MessageCircle",[["path",{d:"M7.9 20A9 9 0 1 0 4 16.1L2 22Z",key:"vv11sd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fo=l("MessageSquare",[["path",{d:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",key:"1lielz"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qo=l("Minimize2",[["polyline",{points:"4 14 10 14 10 20",key:"11kfnr"}],["polyline",{points:"20 10 14 10 14 4",key:"rlmsce"}],["line",{x1:"14",x2:"21",y1:"10",y2:"3",key:"o5lafz"}],["line",{x1:"3",x2:"10",y1:"21",y2:"14",key:"1atl0r"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ho=l("MonitorUp",[["path",{d:"m9 10 3-3 3 3",key:"11gsxs"}],["path",{d:"M12 13V7",key:"h0r20n"}],["rect",{width:"20",height:"14",x:"2",y:"3",rx:"2",key:"48i651"}],["path",{d:"M12 17v4",key:"1riwvh"}],["path",{d:"M8 21h8",key:"1ev6f3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vo=l("Monitor",[["rect",{width:"20",height:"14",x:"2",y:"3",rx:"2",key:"48i651"}],["line",{x1:"8",x2:"16",y1:"21",y2:"21",key:"1svkeh"}],["line",{x1:"12",x2:"12",y1:"17",y2:"21",key:"vw1qmm"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wo=l("Moon",[["path",{d:"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",key:"a7tn18"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Bo=l("Network",[["rect",{x:"16",y:"16",width:"6",height:"6",rx:"1",key:"4q2zg0"}],["rect",{x:"2",y:"16",width:"6",height:"6",rx:"1",key:"8cvhb9"}],["rect",{x:"9",y:"2",width:"6",height:"6",rx:"1",key:"1egb70"}],["path",{d:"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3",key:"1jsf9p"}],["path",{d:"M12 12V8",key:"2874zd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $o=l("NotebookPen",[["path",{d:"M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4",key:"re6nr2"}],["path",{d:"M2 6h4",key:"aawbzj"}],["path",{d:"M2 10h4",key:"l0bgd4"}],["path",{d:"M2 14h4",key:"1gsvsf"}],["path",{d:"M2 18h4",key:"1bu2t1"}],["path",{d:"M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",key:"pqwjuv"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Uo=l("PanelLeft",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M9 3v18",key:"fh3hqa"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Go=l("Pause",[["rect",{x:"14",y:"4",width:"4",height:"16",rx:"1",key:"zuxfzm"}],["rect",{x:"6",y:"4",width:"4",height:"16",rx:"1",key:"1okwgv"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zo=l("PenLine",[["path",{d:"M12 20h9",key:"t2du7b"}],["path",{d:"M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",key:"1ykcvy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ko=l("Pencil",[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xo=l("Play",[["polygon",{points:"6 3 20 12 6 21 6 3",key:"1oa8hb"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yo=l("Plus",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qo=l("PowerOff",[["path",{d:"M18.36 6.64A9 9 0 0 1 20.77 15",key:"dxknvb"}],["path",{d:"M6.16 6.16a9 9 0 1 0 12.68 12.68",key:"1x7qb5"}],["path",{d:"M12 2v4",key:"3427ic"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Jo=l("Power",[["path",{d:"M12 2v10",key:"mnfbl"}],["path",{d:"M18.4 6.6a9 9 0 1 1-12.77.04",key:"obofu9"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ec=l("RefreshCw",[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const tc=l("Rocket",[["path",{d:"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z",key:"m3kijz"}],["path",{d:"m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z",key:"1fmvmk"}],["path",{d:"M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0",key:"1f8sc4"}],["path",{d:"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",key:"qeys4"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const nc=l("RotateCcw",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rc=l("RotateCw",[["path",{d:"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8",key:"1p45f6"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ac=l("Save",[["path",{d:"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",key:"1c8476"}],["path",{d:"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",key:"1ydtos"}],["path",{d:"M7 3v4a1 1 0 0 0 1 1h7",key:"t51u73"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oc=l("Scale",[["path",{d:"m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z",key:"7g6ntu"}],["path",{d:"m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z",key:"ijws7r"}],["path",{d:"M7 21h10",key:"1b0cd5"}],["path",{d:"M12 3v18",key:"108xh3"}],["path",{d:"M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2",key:"3gwbw2"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const cc=l("Search",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sc=l("Send",[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ic=l("Server",[["rect",{width:"20",height:"8",x:"2",y:"2",rx:"2",ry:"2",key:"ngkwjq"}],["rect",{width:"20",height:"8",x:"2",y:"14",rx:"2",ry:"2",key:"iecqi9"}],["line",{x1:"6",x2:"6.01",y1:"6",y2:"6",key:"16zg32"}],["line",{x1:"6",x2:"6.01",y1:"18",y2:"18",key:"nzw8ys"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const lc=l("Settings",[["path",{d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",key:"1qme2f"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const uc=l("Share2",[["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}],["circle",{cx:"6",cy:"12",r:"3",key:"w7nqdw"}],["circle",{cx:"18",cy:"19",r:"3",key:"1xt0gg"}],["line",{x1:"8.59",x2:"15.42",y1:"13.51",y2:"17.49",key:"47mynk"}],["line",{x1:"15.41",x2:"8.59",y1:"6.51",y2:"10.49",key:"1n3mei"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const dc=l("Shield",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fc=l("SkipForward",[["polygon",{points:"5 4 15 12 5 20 5 4",key:"16p6eg"}],["line",{x1:"19",x2:"19",y1:"5",y2:"19",key:"futhcm"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const hc=l("Sparkles",[["path",{d:"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",key:"4pj2yx"}],["path",{d:"M20 3v4",key:"1olli1"}],["path",{d:"M22 5h-4",key:"1gvqau"}],["path",{d:"M4 17v2",key:"vumght"}],["path",{d:"M5 18H3",key:"zchphs"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yc=l("SquarePen",[["path",{d:"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",key:"1m0v6g"}],["path",{d:"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",key:"ohrbg2"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pc=l("Square",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vc=l("Star",[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const mc=l("Sun",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const kc=l("Swords",[["polyline",{points:"14.5 17.5 3 6 3 3 6 3 17.5 14.5",key:"1hfsw2"}],["line",{x1:"13",x2:"19",y1:"19",y2:"13",key:"1vrmhu"}],["line",{x1:"16",x2:"20",y1:"16",y2:"20",key:"1bron3"}],["line",{x1:"19",x2:"21",y1:"21",y2:"19",key:"13pww6"}],["polyline",{points:"14.5 6.5 18 3 21 3 21 6 17.5 9.5",key:"hbey2j"}],["line",{x1:"5",x2:"9",y1:"14",y2:"18",key:"1hf58s"}],["line",{x1:"7",x2:"4",y1:"17",y2:"20",key:"pidxm4"}],["line",{x1:"3",x2:"5",y1:"19",y2:"21",key:"1pehsh"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const gc=l("Table2",[["path",{d:"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18",key:"gugj83"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xc=l("Tag",[["path",{d:"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",key:"vktsd0"}],["circle",{cx:"7.5",cy:"7.5",r:".5",fill:"currentColor",key:"kqv944"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const bc=l("Terminal",[["polyline",{points:"4 17 10 11 4 5",key:"akl6gq"}],["line",{x1:"12",x2:"20",y1:"19",y2:"19",key:"q2wloq"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Cc=l("ThumbsDown",[["path",{d:"M17 14V2",key:"8ymqnk"}],["path",{d:"M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z",key:"m61m77"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Mc=l("ThumbsUp",[["path",{d:"M7 10v12",key:"1qc93n"}],["path",{d:"M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",key:"emmmcr"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wc=l("ToggleLeft",[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"6",ry:"6",key:"f2vt7d"}],["circle",{cx:"8",cy:"12",r:"2",key:"1nvbw3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ec=l("ToggleRight",[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"6",ry:"6",key:"f2vt7d"}],["circle",{cx:"16",cy:"12",r:"2",key:"4ma0v8"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sc=l("Trash2",[["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",key:"4alrt4"}],["path",{d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",key:"v07s0e"}],["line",{x1:"10",x2:"10",y1:"11",y2:"17",key:"1uufr5"}],["line",{x1:"14",x2:"14",y1:"11",y2:"17",key:"xtxkd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ac=l("TrendingUp",[["polyline",{points:"22 7 13.5 15.5 8.5 10.5 2 17",key:"126l90"}],["polyline",{points:"16 7 22 7 22 13",key:"kwv8wd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Rc=l("TriangleAlert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pc=l("Trophy",[["path",{d:"M6 9H4.5a2.5 2.5 0 0 1 0-5H6",key:"17hqa7"}],["path",{d:"M18 9h1.5a2.5 2.5 0 0 0 0-5H18",key:"lmptdp"}],["path",{d:"M4 22h16",key:"57wxv0"}],["path",{d:"M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22",key:"1nw9bq"}],["path",{d:"M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22",key:"1np0yb"}],["path",{d:"M18 2H6v7a6 6 0 0 0 12 0V2Z",key:"u46fv3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Nc=l("Twitter",[["path",{d:"M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z",key:"pff0z6"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Lc=l("User",[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ic=l("Users",[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["path",{d:"M22 21v-2a4 4 0 0 0-3-3.87",key:"kshegd"}],["path",{d:"M16 3.13a4 4 0 0 1 0 7.75",key:"1da9ce"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oc=l("WandSparkles",[["path",{d:"m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72",key:"ul74o6"}],["path",{d:"m14 7 3 3",key:"1r5n42"}],["path",{d:"M5 6v4",key:"ilb8ba"}],["path",{d:"M19 14v4",key:"blhpug"}],["path",{d:"M10 2v2",key:"7u0qdc"}],["path",{d:"M7 8H3",key:"zfb6yr"}],["path",{d:"M21 16h-4",key:"1cnmox"}],["path",{d:"M11 3H9",key:"1obp7u"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Dc=l("WifiOff",[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}],["path",{d:"M5 12.859a10 10 0 0 1 5.17-2.69",key:"1dl1wf"}],["path",{d:"M19 12.859a10 10 0 0 0-2.007-1.523",key:"4k23kn"}],["path",{d:"M2 8.82a15 15 0 0 1 4.177-2.643",key:"1grhjp"}],["path",{d:"M22 8.82a15 15 0 0 0-11.288-3.764",key:"z3jwby"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Tc=l("Wifi",[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M2 8.82a15 15 0 0 1 20 0",key:"dnpr2z"}],["path",{d:"M5 12.859a10 10 0 0 1 14 0",key:"1x1e6c"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _c=l("X",[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const jc=l("Zap",[["path",{d:"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",key:"1xq2db"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zc=l("ZoomIn",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"11",x2:"11",y1:"8",y2:"14",key:"1vmskp"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fc=l("ZoomOut",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]]);function D(e,t,{checkForDefaultPrevented:n=!0}={}){return function(a){if(e==null||e(a),n===!1||!a.defaultPrevented)return t==null?void 0:t(a)}}function mn(e,t){const n=s.createContext(t),r=o=>{const{children:i,...c}=o,f=s.useMemo(()=>c,Object.values(c));return p.jsx(n.Provider,{value:f,children:i})};r.displayName=e+"Provider";function a(o){const i=s.useContext(n);if(i)return i;if(t!==void 0)return t;throw new Error(`\`${o}\` must be used within \`${e}\``)}return[r,a]}function Z(e,t=[]){let n=[];function r(o,i){const c=s.createContext(i),f=n.length;n=[...n,i];const u=y=>{var x;const{scope:v,children:g,...w}=y,d=((x=v==null?void 0:v[e])==null?void 0:x[f])||c,m=s.useMemo(()=>w,Object.values(w));return p.jsx(d.Provider,{value:m,children:g})};u.displayName=o+"Provider";function h(y,v){var d;const g=((d=v==null?void 0:v[e])==null?void 0:d[f])||c,w=s.useContext(g);if(w)return w;if(i!==void 0)return i;throw new Error(`\`${y}\` must be used within \`${o}\``)}return[u,h]}const a=()=>{const o=n.map(i=>s.createContext(i));return function(c){const f=(c==null?void 0:c[e])||o;return s.useMemo(()=>({[`__scope${e}`]:{...c,[e]:f}}),[c,f])}};return a.scopeName=e,[r,kn(a,...t)]}function kn(...e){const t=e[0];if(e.length===1)return t;const n=()=>{const r=e.map(a=>({useScope:a(),scopeName:a.scopeName}));return function(o){const i=r.reduce((c,{useScope:f,scopeName:u})=>{const y=f(o)[`__scope${u}`];return{...c,...y}},{});return s.useMemo(()=>({[`__scope${t.scopeName}`]:i}),[i])}};return n.scopeName=t.scopeName,n}var _=globalThis!=null&&globalThis.document?s.useLayoutEffect:()=>{},gn=Ze[" useInsertionEffect ".trim().toString()]||_;function ce({prop:e,defaultProp:t,onChange:n=()=>{},caller:r}){const[a,o,i]=xn({defaultProp:t,onChange:n}),c=e!==void 0,f=c?e:a;{const h=s.useRef(e!==void 0);s.useEffect(()=>{const y=h.current;y!==c&&console.warn(`${r} is changing from ${y?"controlled":"uncontrolled"} to ${c?"controlled":"uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`),h.current=c},[c,r])}const u=s.useCallback(h=>{var y;if(c){const v=bn(h)?h(e):h;v!==e&&((y=i.current)==null||y.call(i,v))}else o(h)},[c,e,o,i]);return[f,u]}function xn({defaultProp:e,onChange:t}){const[n,r]=s.useState(e),a=s.useRef(n),o=s.useRef(t);return gn(()=>{o.current=t},[t]),s.useEffect(()=>{var i;a.current!==n&&((i=o.current)==null||i.call(o,n),a.current=n)},[n,a]),[n,r,o]}function bn(e){return typeof e=="function"}var Cn=["a","button","div","form","h2","h3","img","input","label","li","nav","ol","p","select","span","svg","ul"],R=Cn.reduce((e,t)=>{const n=G(`Primitive.${t}`),r=s.forwardRef((a,o)=>{const{asChild:i,...c}=a,f=i?n:t;return typeof window<"u"&&(window[Symbol.for("radix-ui")]=!0),p.jsx(f,{...c,ref:o})});return r.displayName=`Primitive.${t}`,{...e,[t]:r}},{});function Mn(e,t){e&&tn.flushSync(()=>e.dispatchEvent(t))}function wn(e){const t=e+"CollectionProvider",[n,r]=Z(t),[a,o]=n(t,{collectionRef:{current:null},itemMap:new Map}),i=d=>{const{scope:m,children:x}=d,k=S.useRef(null),b=S.useRef(new Map).current;return p.jsx(a,{scope:m,itemMap:b,collectionRef:k,children:x})};i.displayName=t;const c=e+"CollectionSlot",f=G(c),u=S.forwardRef((d,m)=>{const{scope:x,children:k}=d,b=o(c,x),C=N(m,b.collectionRef);return p.jsx(f,{ref:C,children:k})});u.displayName=c;const h=e+"CollectionItemSlot",y="data-radix-collection-item",v=G(h),g=S.forwardRef((d,m)=>{const{scope:x,children:k,...b}=d,C=S.useRef(null),E=N(m,C),A=o(h,x);return S.useEffect(()=>(A.itemMap.set(C,{ref:C,...b}),()=>void A.itemMap.delete(C))),p.jsx(v,{[y]:"",ref:E,children:k})});g.displayName=h;function w(d){const m=o(e+"CollectionConsumer",d);return S.useCallback(()=>{const k=m.collectionRef.current;if(!k)return[];const b=Array.from(k.querySelectorAll(`[${y}]`));return Array.from(m.itemMap.values()).sort((A,M)=>b.indexOf(A.ref.current)-b.indexOf(M.ref.current))},[m.collectionRef,m.itemMap])}return[{Provider:i,Slot:u,ItemSlot:g},w,r]}var En=s.createContext(void 0);function Sn(e){const t=s.useContext(En);return e||t||"ltr"}function B(e){const t=s.useRef(e);return s.useEffect(()=>{t.current=e}),s.useMemo(()=>(...n)=>{var r;return(r=t.current)==null?void 0:r.call(t,...n)},[])}function An(e,t=globalThis==null?void 0:globalThis.document){const n=B(e);s.useEffect(()=>{const r=a=>{a.key==="Escape"&&n(a)};return t.addEventListener("keydown",r,{capture:!0}),()=>t.removeEventListener("keydown",r,{capture:!0})},[n,t])}var Rn="DismissableLayer",xe="dismissableLayer.update",Pn="dismissableLayer.pointerDownOutside",Nn="dismissableLayer.focusOutside",Te,et=s.createContext({layers:new Set,layersWithOutsidePointerEventsDisabled:new Set,branches:new Set}),Me=s.forwardRef((e,t)=>{const{disableOutsidePointerEvents:n=!1,onEscapeKeyDown:r,onPointerDownOutside:a,onFocusOutside:o,onInteractOutside:i,onDismiss:c,...f}=e,u=s.useContext(et),[h,y]=s.useState(null),v=(h==null?void 0:h.ownerDocument)??(globalThis==null?void 0:globalThis.document),[,g]=s.useState({}),w=N(t,M=>y(M)),d=Array.from(u.layers),[m]=[...u.layersWithOutsidePointerEventsDisabled].slice(-1),x=d.indexOf(m),k=h?d.indexOf(h):-1,b=u.layersWithOutsidePointerEventsDisabled.size>0,C=k>=x,E=In(M=>{const P=M.target,T=[...u.branches].some(F=>F.contains(P));!C||T||(a==null||a(M),i==null||i(M),M.defaultPrevented||c==null||c())},v),A=On(M=>{const P=M.target;[...u.branches].some(F=>F.contains(P))||(o==null||o(M),i==null||i(M),M.defaultPrevented||c==null||c())},v);return An(M=>{k===u.layers.size-1&&(r==null||r(M),!M.defaultPrevented&&c&&(M.preventDefault(),c()))},v),s.useEffect(()=>{if(h)return n&&(u.layersWithOutsidePointerEventsDisabled.size===0&&(Te=v.body.style.pointerEvents,v.body.style.pointerEvents="none"),u.layersWithOutsidePointerEventsDisabled.add(h)),u.layers.add(h),_e(),()=>{n&&u.layersWithOutsidePointerEventsDisabled.size===1&&(v.body.style.pointerEvents=Te)}},[h,v,n,u]),s.useEffect(()=>()=>{h&&(u.layers.delete(h),u.layersWithOutsidePointerEventsDisabled.delete(h),_e())},[h,u]),s.useEffect(()=>{const M=()=>g({});return document.addEventListener(xe,M),()=>document.removeEventListener(xe,M)},[]),p.jsx(R.div,{...f,ref:w,style:{pointerEvents:b?C?"auto":"none":void 0,...e.style},onFocusCapture:D(e.onFocusCapture,A.onFocusCapture),onBlurCapture:D(e.onBlurCapture,A.onBlurCapture),onPointerDownCapture:D(e.onPointerDownCapture,E.onPointerDownCapture)})});Me.displayName=Rn;var Ln="DismissableLayerBranch",tt=s.forwardRef((e,t)=>{const n=s.useContext(et),r=s.useRef(null),a=N(t,r);return s.useEffect(()=>{const o=r.current;if(o)return n.branches.add(o),()=>{n.branches.delete(o)}},[n.branches]),p.jsx(R.div,{...e,ref:a})});tt.displayName=Ln;function In(e,t=globalThis==null?void 0:globalThis.document){const n=B(e),r=s.useRef(!1),a=s.useRef(()=>{});return s.useEffect(()=>{const o=c=>{if(c.target&&!r.current){let f=function(){nt(Pn,n,u,{discrete:!0})};const u={originalEvent:c};c.pointerType==="touch"?(t.removeEventListener("click",a.current),a.current=f,t.addEventListener("click",a.current,{once:!0})):f()}else t.removeEventListener("click",a.current);r.current=!1},i=window.setTimeout(()=>{t.addEventListener("pointerdown",o)},0);return()=>{window.clearTimeout(i),t.removeEventListener("pointerdown",o),t.removeEventListener("click",a.current)}},[t,n]),{onPointerDownCapture:()=>r.current=!0}}function On(e,t=globalThis==null?void 0:globalThis.document){const n=B(e),r=s.useRef(!1);return s.useEffect(()=>{const a=o=>{o.target&&!r.current&&nt(Nn,n,{originalEvent:o},{discrete:!1})};return t.addEventListener("focusin",a),()=>t.removeEventListener("focusin",a)},[t,n]),{onFocusCapture:()=>r.current=!0,onBlurCapture:()=>r.current=!1}}function _e(){const e=new CustomEvent(xe);document.dispatchEvent(e)}function nt(e,t,n,{discrete:r}){const a=n.originalEvent.target,o=new CustomEvent(e,{bubbles:!1,cancelable:!0,detail:n});t&&a.addEventListener(e,t,{once:!0}),r?Mn(a,o):a.dispatchEvent(o)}var qc=Me,Hc=tt,fe=0;function Dn(){s.useEffect(()=>{const e=document.querySelectorAll("[data-radix-focus-guard]");return document.body.insertAdjacentElement("afterbegin",e[0]??je()),document.body.insertAdjacentElement("beforeend",e[1]??je()),fe++,()=>{fe===1&&document.querySelectorAll("[data-radix-focus-guard]").forEach(t=>t.remove()),fe--}},[])}function je(){const e=document.createElement("span");return e.setAttribute("data-radix-focus-guard",""),e.tabIndex=0,e.style.outline="none",e.style.opacity="0",e.style.position="fixed",e.style.pointerEvents="none",e}var he="focusScope.autoFocusOnMount",ye="focusScope.autoFocusOnUnmount",ze={bubbles:!1,cancelable:!0},Tn="FocusScope",rt=s.forwardRef((e,t)=>{const{loop:n=!1,trapped:r=!1,onMountAutoFocus:a,onUnmountAutoFocus:o,...i}=e,[c,f]=s.useState(null),u=B(a),h=B(o),y=s.useRef(null),v=N(t,d=>f(d)),g=s.useRef({paused:!1,pause(){this.paused=!0},resume(){this.paused=!1}}).current;s.useEffect(()=>{if(r){let d=function(b){if(g.paused||!c)return;const C=b.target;c.contains(C)?y.current=C:j(y.current,{select:!0})},m=function(b){if(g.paused||!c)return;const C=b.relatedTarget;C!==null&&(c.contains(C)||j(y.current,{select:!0}))},x=function(b){if(document.activeElement===document.body)for(const E of b)E.removedNodes.length>0&&j(c)};document.addEventListener("focusin",d),document.addEventListener("focusout",m);const k=new MutationObserver(x);return c&&k.observe(c,{childList:!0,subtree:!0}),()=>{document.removeEventListener("focusin",d),document.removeEventListener("focusout",m),k.disconnect()}}},[r,c,g.paused]),s.useEffect(()=>{if(c){qe.add(g);const d=document.activeElement;if(!c.contains(d)){const x=new CustomEvent(he,ze);c.addEventListener(he,u),c.dispatchEvent(x),x.defaultPrevented||(_n(Hn(at(c)),{select:!0}),document.activeElement===d&&j(c))}return()=>{c.removeEventListener(he,u),setTimeout(()=>{const x=new CustomEvent(ye,ze);c.addEventListener(ye,h),c.dispatchEvent(x),x.defaultPrevented||j(d??document.body,{select:!0}),c.removeEventListener(ye,h),qe.remove(g)},0)}}},[c,u,h,g]);const w=s.useCallback(d=>{if(!n&&!r||g.paused)return;const m=d.key==="Tab"&&!d.altKey&&!d.ctrlKey&&!d.metaKey,x=document.activeElement;if(m&&x){const k=d.currentTarget,[b,C]=jn(k);b&&C?!d.shiftKey&&x===C?(d.preventDefault(),n&&j(b,{select:!0})):d.shiftKey&&x===b&&(d.preventDefault(),n&&j(C,{select:!0})):x===k&&d.preventDefault()}},[n,r,g.paused]);return p.jsx(R.div,{tabIndex:-1,...i,ref:v,onKeyDown:w})});rt.displayName=Tn;function _n(e,{select:t=!1}={}){const n=document.activeElement;for(const r of e)if(j(r,{select:t}),document.activeElement!==n)return}function jn(e){const t=at(e),n=Fe(t,e),r=Fe(t.reverse(),e);return[n,r]}function at(e){const t=[],n=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT,{acceptNode:r=>{const a=r.tagName==="INPUT"&&r.type==="hidden";return r.disabled||r.hidden||a?NodeFilter.FILTER_SKIP:r.tabIndex>=0?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP}});for(;n.nextNode();)t.push(n.currentNode);return t}function Fe(e,t){for(const n of e)if(!zn(n,{upTo:t}))return n}function zn(e,{upTo:t}){if(getComputedStyle(e).visibility==="hidden")return!0;for(;e;){if(t!==void 0&&e===t)return!1;if(getComputedStyle(e).display==="none")return!0;e=e.parentElement}return!1}function Fn(e){return e instanceof HTMLInputElement&&"select"in e}function j(e,{select:t=!1}={}){if(e&&e.focus){const n=document.activeElement;e.focus({preventScroll:!0}),e!==n&&Fn(e)&&t&&e.select()}}var qe=qn();function qn(){let e=[];return{add(t){const n=e[0];t!==n&&(n==null||n.pause()),e=He(e,t),e.unshift(t)},remove(t){var n;e=He(e,t),(n=e[0])==null||n.resume()}}}function He(e,t){const n=[...e],r=n.indexOf(t);return r!==-1&&n.splice(r,1),n}function Hn(e){return e.filter(t=>t.tagName!=="A")}var Vn=Ze[" useId ".trim().toString()]||(()=>{}),Wn=0;function U(e){const[t,n]=s.useState(Vn());return _(()=>{n(r=>r??String(Wn++))},[e]),t?`radix-${t}`:""}var Bn="Portal",ot=s.forwardRef((e,t)=>{var c;const{container:n,...r}=e,[a,o]=s.useState(!1);_(()=>o(!0),[]);const i=n||a&&((c=globalThis==null?void 0:globalThis.document)==null?void 0:c.body);return i?nn.createPortal(p.jsx(R.div,{...r,ref:t}),i):null});ot.displayName=Bn;function $n(e,t){return s.useReducer((n,r)=>t[n][r]??n,e)}var K=e=>{const{present:t,children:n}=e,r=Un(t),a=typeof n=="function"?n({present:r.isPresent}):s.Children.only(n),o=N(r.ref,Gn(a));return typeof n=="function"||r.isPresent?s.cloneElement(a,{ref:o}):null};K.displayName="Presence";function Un(e){const[t,n]=s.useState(),r=s.useRef(null),a=s.useRef(e),o=s.useRef("none"),i=e?"mounted":"unmounted",[c,f]=$n(i,{mounted:{UNMOUNT:"unmounted",ANIMATION_OUT:"unmountSuspended"},unmountSuspended:{MOUNT:"mounted",ANIMATION_END:"unmounted"},unmounted:{MOUNT:"mounted"}});return s.useEffect(()=>{const u=X(r.current);o.current=c==="mounted"?u:"none"},[c]),_(()=>{const u=r.current,h=a.current;if(h!==e){const v=o.current,g=X(u);e?f("MOUNT"):g==="none"||(u==null?void 0:u.display)==="none"?f("UNMOUNT"):f(h&&v!==g?"ANIMATION_OUT":"UNMOUNT"),a.current=e}},[e,f]),_(()=>{if(t){let u;const h=t.ownerDocument.defaultView??window,y=g=>{const d=X(r.current).includes(CSS.escape(g.animationName));if(g.target===t&&d&&(f("ANIMATION_END"),!a.current)){const m=t.style.animationFillMode;t.style.animationFillMode="forwards",u=h.setTimeout(()=>{t.style.animationFillMode==="forwards"&&(t.style.animationFillMode=m)})}},v=g=>{g.target===t&&(o.current=X(r.current))};return t.addEventListener("animationstart",v),t.addEventListener("animationcancel",y),t.addEventListener("animationend",y),()=>{h.clearTimeout(u),t.removeEventListener("animationstart",v),t.removeEventListener("animationcancel",y),t.removeEventListener("animationend",y)}}else f("ANIMATION_END")},[t,f]),{isPresent:["mounted","unmountSuspended"].includes(c),ref:s.useCallback(u=>{r.current=u?getComputedStyle(u):null,n(u)},[])}}function X(e){return(e==null?void 0:e.animationName)||"none"}function Gn(e){var r,a;let t=(r=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:r.get,n=t&&"isReactWarning"in t&&t.isReactWarning;return n?e.ref:(t=(a=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:a.get,n=t&&"isReactWarning"in t&&t.isReactWarning,n?e.props.ref:e.props.ref||e.ref)}var Zn=function(e){if(typeof document>"u")return null;var t=Array.isArray(e)?e[0]:e;return t.ownerDocument.body},q=new WeakMap,Y=new WeakMap,Q={},pe=0,ct=function(e){return e&&(e.host||ct(e.parentNode))},Kn=function(e,t){return t.map(function(n){if(e.contains(n))return n;var r=ct(n);return r&&e.contains(r)?r:(console.error("aria-hidden",n,"in not contained inside",e,". Doing nothing"),null)}).filter(function(n){return!!n})},Xn=function(e,t,n,r){var a=Kn(t,Array.isArray(e)?e:[e]);Q[n]||(Q[n]=new WeakMap);var o=Q[n],i=[],c=new Set,f=new Set(a),u=function(y){!y||c.has(y)||(c.add(y),u(y.parentNode))};a.forEach(u);var h=function(y){!y||f.has(y)||Array.prototype.forEach.call(y.children,function(v){if(c.has(v))h(v);else try{var g=v.getAttribute(r),w=g!==null&&g!=="false",d=(q.get(v)||0)+1,m=(o.get(v)||0)+1;q.set(v,d),o.set(v,m),i.push(v),d===1&&w&&Y.set(v,!0),m===1&&v.setAttribute(n,"true"),w||v.setAttribute(r,"true")}catch(x){console.error("aria-hidden: cannot operate on ",v,x)}})};return h(t),c.clear(),pe++,function(){i.forEach(function(y){var v=q.get(y)-1,g=o.get(y)-1;q.set(y,v),o.set(y,g),v||(Y.has(y)||y.removeAttribute(r),Y.delete(y)),g||y.removeAttribute(n)}),pe--,pe||(q=new WeakMap,q=new WeakMap,Y=new WeakMap,Q={})}},Yn=function(e,t,n){n===void 0&&(n="data-aria-hidden");var r=Array.from(Array.isArray(e)?e:[e]),a=Zn(e);return a?(r.push.apply(r,Array.from(a.querySelectorAll("[aria-live], script"))),Xn(r,a,n,"aria-hidden")):function(){return null}},O=function(){return O=Object.assign||function(t){for(var n,r=1,a=arguments.length;r<a;r++){n=arguments[r];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(t[o]=n[o])}return t},O.apply(this,arguments)};function st(e,t){var n={};for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&t.indexOf(r)<0&&(n[r]=e[r]);if(e!=null&&typeof Object.getOwnPropertySymbols=="function")for(var a=0,r=Object.getOwnPropertySymbols(e);a<r.length;a++)t.indexOf(r[a])<0&&Object.prototype.propertyIsEnumerable.call(e,r[a])&&(n[r[a]]=e[r[a]]);return n}function Qn(e,t,n){if(n||arguments.length===2)for(var r=0,a=t.length,o;r<a;r++)(o||!(r in t))&&(o||(o=Array.prototype.slice.call(t,0,r)),o[r]=t[r]);return e.concat(o||Array.prototype.slice.call(t))}var te="right-scroll-bar-position",ne="width-before-scroll-bar",Jn="with-scroll-bars-hidden",er="--removed-body-scroll-bar-size";function ve(e,t){return typeof e=="function"?e(t):e&&(e.current=t),e}function tr(e,t){var n=s.useState(function(){return{value:e,callback:t,facade:{get current(){return n.value},set current(r){var a=n.value;a!==r&&(n.value=r,n.callback(r,a))}}}})[0];return n.callback=t,n.facade}var nr=typeof window<"u"?s.useLayoutEffect:s.useEffect,Ve=new WeakMap;function rr(e,t){var n=tr(null,function(r){return e.forEach(function(a){return ve(a,r)})});return nr(function(){var r=Ve.get(n);if(r){var a=new Set(r),o=new Set(e),i=n.current;a.forEach(function(c){o.has(c)||ve(c,null)}),o.forEach(function(c){a.has(c)||ve(c,i)})}Ve.set(n,e)},[e]),n}function ar(e){return e}function or(e,t){t===void 0&&(t=ar);var n=[],r=!1,a={read:function(){if(r)throw new Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");return n.length?n[n.length-1]:e},useMedium:function(o){var i=t(o,r);return n.push(i),function(){n=n.filter(function(c){return c!==i})}},assignSyncMedium:function(o){for(r=!0;n.length;){var i=n;n=[],i.forEach(o)}n={push:function(c){return o(c)},filter:function(){return n}}},assignMedium:function(o){r=!0;var i=[];if(n.length){var c=n;n=[],c.forEach(o),i=n}var f=function(){var h=i;i=[],h.forEach(o)},u=function(){return Promise.resolve().then(f)};u(),n={push:function(h){i.push(h),u()},filter:function(h){return i=i.filter(h),n}}}};return a}function cr(e){e===void 0&&(e={});var t=or(null);return t.options=O({async:!0,ssr:!1},e),t}var it=function(e){var t=e.sideCar,n=st(e,["sideCar"]);if(!t)throw new Error("Sidecar: please provide `sideCar` property to import the right car");var r=t.read();if(!r)throw new Error("Sidecar medium not found");return s.createElement(r,O({},n))};it.isSideCarExport=!0;function sr(e,t){return e.useMedium(t),it}var lt=cr(),me=function(){},se=s.forwardRef(function(e,t){var n=s.useRef(null),r=s.useState({onScrollCapture:me,onWheelCapture:me,onTouchMoveCapture:me}),a=r[0],o=r[1],i=e.forwardProps,c=e.children,f=e.className,u=e.removeScrollBar,h=e.enabled,y=e.shards,v=e.sideCar,g=e.noRelative,w=e.noIsolation,d=e.inert,m=e.allowPinchZoom,x=e.as,k=x===void 0?"div":x,b=e.gapMode,C=st(e,["forwardProps","children","className","removeScrollBar","enabled","shards","sideCar","noRelative","noIsolation","inert","allowPinchZoom","as","gapMode"]),E=v,A=rr([n,t]),M=O(O({},C),a);return s.createElement(s.Fragment,null,h&&s.createElement(E,{sideCar:lt,removeScrollBar:u,shards:y,noRelative:g,noIsolation:w,inert:d,setCallbacks:o,allowPinchZoom:!!m,lockRef:n,gapMode:b}),i?s.cloneElement(s.Children.only(c),O(O({},M),{ref:A})):s.createElement(k,O({},M,{className:f,ref:A}),c))});se.defaultProps={enabled:!0,removeScrollBar:!0,inert:!1};se.classNames={fullWidth:ne,zeroRight:te};var ir=function(){if(typeof __webpack_nonce__<"u")return __webpack_nonce__};function lr(){if(!document)return null;var e=document.createElement("style");e.type="text/css";var t=ir();return t&&e.setAttribute("nonce",t),e}function ur(e,t){e.styleSheet?e.styleSheet.cssText=t:e.appendChild(document.createTextNode(t))}function dr(e){var t=document.head||document.getElementsByTagName("head")[0];t.appendChild(e)}var fr=function(){var e=0,t=null;return{add:function(n){e==0&&(t=lr())&&(ur(t,n),dr(t)),e++},remove:function(){e--,!e&&t&&(t.parentNode&&t.parentNode.removeChild(t),t=null)}}},hr=function(){var e=fr();return function(t,n){s.useEffect(function(){return e.add(t),function(){e.remove()}},[t&&n])}},ut=function(){var e=hr(),t=function(n){var r=n.styles,a=n.dynamic;return e(r,a),null};return t},yr={left:0,top:0,right:0,gap:0},ke=function(e){return parseInt(e||"",10)||0},pr=function(e){var t=window.getComputedStyle(document.body),n=t[e==="padding"?"paddingLeft":"marginLeft"],r=t[e==="padding"?"paddingTop":"marginTop"],a=t[e==="padding"?"paddingRight":"marginRight"];return[ke(n),ke(r),ke(a)]},vr=function(e){if(e===void 0&&(e="margin"),typeof window>"u")return yr;var t=pr(e),n=document.documentElement.clientWidth,r=window.innerWidth;return{left:t[0],top:t[1],right:t[2],gap:Math.max(0,r-n+t[2]-t[0])}},mr=ut(),W="data-scroll-locked",kr=function(e,t,n,r){var a=e.left,o=e.top,i=e.right,c=e.gap;return n===void 0&&(n="margin"),`
  .`.concat(Jn,` {
   overflow: hidden `).concat(r,`;
   padding-right: `).concat(c,"px ").concat(r,`;
  }
  body[`).concat(W,`] {
    overflow: hidden `).concat(r,`;
    overscroll-behavior: contain;
    `).concat([t&&"position: relative ".concat(r,";"),n==="margin"&&`
    padding-left: `.concat(a,`px;
    padding-top: `).concat(o,`px;
    padding-right: `).concat(i,`px;
    margin-left:0;
    margin-top:0;
    margin-right: `).concat(c,"px ").concat(r,`;
    `),n==="padding"&&"padding-right: ".concat(c,"px ").concat(r,";")].filter(Boolean).join(""),`
  }
  
  .`).concat(te,` {
    right: `).concat(c,"px ").concat(r,`;
  }
  
  .`).concat(ne,` {
    margin-right: `).concat(c,"px ").concat(r,`;
  }
  
  .`).concat(te," .").concat(te,` {
    right: 0 `).concat(r,`;
  }
  
  .`).concat(ne," .").concat(ne,` {
    margin-right: 0 `).concat(r,`;
  }
  
  body[`).concat(W,`] {
    `).concat(er,": ").concat(c,`px;
  }
`)},We=function(){var e=parseInt(document.body.getAttribute(W)||"0",10);return isFinite(e)?e:0},gr=function(){s.useEffect(function(){return document.body.setAttribute(W,(We()+1).toString()),function(){var e=We()-1;e<=0?document.body.removeAttribute(W):document.body.setAttribute(W,e.toString())}},[])},xr=function(e){var t=e.noRelative,n=e.noImportant,r=e.gapMode,a=r===void 0?"margin":r;gr();var o=s.useMemo(function(){return vr(a)},[a]);return s.createElement(mr,{styles:kr(o,!t,a,n?"":"!important")})},be=!1;if(typeof window<"u")try{var J=Object.defineProperty({},"passive",{get:function(){return be=!0,!0}});window.addEventListener("test",J,J),window.removeEventListener("test",J,J)}catch{be=!1}var H=be?{passive:!1}:!1,br=function(e){return e.tagName==="TEXTAREA"},dt=function(e,t){if(!(e instanceof Element))return!1;var n=window.getComputedStyle(e);return n[t]!=="hidden"&&!(n.overflowY===n.overflowX&&!br(e)&&n[t]==="visible")},Cr=function(e){return dt(e,"overflowY")},Mr=function(e){return dt(e,"overflowX")},Be=function(e,t){var n=t.ownerDocument,r=t;do{typeof ShadowRoot<"u"&&r instanceof ShadowRoot&&(r=r.host);var a=ft(e,r);if(a){var o=ht(e,r),i=o[1],c=o[2];if(i>c)return!0}r=r.parentNode}while(r&&r!==n.body);return!1},wr=function(e){var t=e.scrollTop,n=e.scrollHeight,r=e.clientHeight;return[t,n,r]},Er=function(e){var t=e.scrollLeft,n=e.scrollWidth,r=e.clientWidth;return[t,n,r]},ft=function(e,t){return e==="v"?Cr(t):Mr(t)},ht=function(e,t){return e==="v"?wr(t):Er(t)},Sr=function(e,t){return e==="h"&&t==="rtl"?-1:1},Ar=function(e,t,n,r,a){var o=Sr(e,window.getComputedStyle(t).direction),i=o*r,c=n.target,f=t.contains(c),u=!1,h=i>0,y=0,v=0;do{if(!c)break;var g=ht(e,c),w=g[0],d=g[1],m=g[2],x=d-m-o*w;(w||x)&&ft(e,c)&&(y+=x,v+=w);var k=c.parentNode;c=k&&k.nodeType===Node.DOCUMENT_FRAGMENT_NODE?k.host:k}while(!f&&c!==document.body||f&&(t.contains(c)||t===c));return(h&&Math.abs(y)<1||!h&&Math.abs(v)<1)&&(u=!0),u},ee=function(e){return"changedTouches"in e?[e.changedTouches[0].clientX,e.changedTouches[0].clientY]:[0,0]},$e=function(e){return[e.deltaX,e.deltaY]},Ue=function(e){return e&&"current"in e?e.current:e},Rr=function(e,t){return e[0]===t[0]&&e[1]===t[1]},Pr=function(e){return`
  .block-interactivity-`.concat(e,` {pointer-events: none;}
  .allow-interactivity-`).concat(e,` {pointer-events: all;}
`)},Nr=0,V=[];function Lr(e){var t=s.useRef([]),n=s.useRef([0,0]),r=s.useRef(),a=s.useState(Nr++)[0],o=s.useState(ut)[0],i=s.useRef(e);s.useEffect(function(){i.current=e},[e]),s.useEffect(function(){if(e.inert){document.body.classList.add("block-interactivity-".concat(a));var d=Qn([e.lockRef.current],(e.shards||[]).map(Ue),!0).filter(Boolean);return d.forEach(function(m){return m.classList.add("allow-interactivity-".concat(a))}),function(){document.body.classList.remove("block-interactivity-".concat(a)),d.forEach(function(m){return m.classList.remove("allow-interactivity-".concat(a))})}}},[e.inert,e.lockRef.current,e.shards]);var c=s.useCallback(function(d,m){if("touches"in d&&d.touches.length===2||d.type==="wheel"&&d.ctrlKey)return!i.current.allowPinchZoom;var x=ee(d),k=n.current,b="deltaX"in d?d.deltaX:k[0]-x[0],C="deltaY"in d?d.deltaY:k[1]-x[1],E,A=d.target,M=Math.abs(b)>Math.abs(C)?"h":"v";if("touches"in d&&M==="h"&&A.type==="range")return!1;var P=Be(M,A);if(!P)return!0;if(P?E=M:(E=M==="v"?"h":"v",P=Be(M,A)),!P)return!1;if(!r.current&&"changedTouches"in d&&(b||C)&&(r.current=E),!E)return!0;var T=r.current||E;return Ar(T,m,d,T==="h"?b:C)},[]),f=s.useCallback(function(d){var m=d;if(!(!V.length||V[V.length-1]!==o)){var x="deltaY"in m?$e(m):ee(m),k=t.current.filter(function(E){return E.name===m.type&&(E.target===m.target||m.target===E.shadowParent)&&Rr(E.delta,x)})[0];if(k&&k.should){m.cancelable&&m.preventDefault();return}if(!k){var b=(i.current.shards||[]).map(Ue).filter(Boolean).filter(function(E){return E.contains(m.target)}),C=b.length>0?c(m,b[0]):!i.current.noIsolation;C&&m.cancelable&&m.preventDefault()}}},[]),u=s.useCallback(function(d,m,x,k){var b={name:d,delta:m,target:x,should:k,shadowParent:Ir(x)};t.current.push(b),setTimeout(function(){t.current=t.current.filter(function(C){return C!==b})},1)},[]),h=s.useCallback(function(d){n.current=ee(d),r.current=void 0},[]),y=s.useCallback(function(d){u(d.type,$e(d),d.target,c(d,e.lockRef.current))},[]),v=s.useCallback(function(d){u(d.type,ee(d),d.target,c(d,e.lockRef.current))},[]);s.useEffect(function(){return V.push(o),e.setCallbacks({onScrollCapture:y,onWheelCapture:y,onTouchMoveCapture:v}),document.addEventListener("wheel",f,H),document.addEventListener("touchmove",f,H),document.addEventListener("touchstart",h,H),function(){V=V.filter(function(d){return d!==o}),document.removeEventListener("wheel",f,H),document.removeEventListener("touchmove",f,H),document.removeEventListener("touchstart",h,H)}},[]);var g=e.removeScrollBar,w=e.inert;return s.createElement(s.Fragment,null,w?s.createElement(o,{styles:Pr(a)}):null,g?s.createElement(xr,{noRelative:e.noRelative,gapMode:e.gapMode}):null)}function Ir(e){for(var t=null;e!==null;)e instanceof ShadowRoot&&(t=e.host,e=e.host),e=e.parentNode;return t}const Or=sr(lt,Lr);var yt=s.forwardRef(function(e,t){return s.createElement(se,O({},e,{ref:t,sideCar:Or}))});yt.classNames=se.classNames;var ie="Dialog",[pt,Vc]=Z(ie),[Dr,L]=pt(ie),vt=e=>{const{__scopeDialog:t,children:n,open:r,defaultOpen:a,onOpenChange:o,modal:i=!0}=e,c=s.useRef(null),f=s.useRef(null),[u,h]=ce({prop:r,defaultProp:a??!1,onChange:o,caller:ie});return p.jsx(Dr,{scope:t,triggerRef:c,contentRef:f,contentId:U(),titleId:U(),descriptionId:U(),open:u,onOpenChange:h,onOpenToggle:s.useCallback(()=>h(y=>!y),[h]),modal:i,children:n})};vt.displayName=ie;var mt="DialogTrigger",kt=s.forwardRef((e,t)=>{const{__scopeDialog:n,...r}=e,a=L(mt,n),o=N(t,a.triggerRef);return p.jsx(R.button,{type:"button","aria-haspopup":"dialog","aria-expanded":a.open,"aria-controls":a.contentId,"data-state":Se(a.open),...r,ref:o,onClick:D(e.onClick,a.onOpenToggle)})});kt.displayName=mt;var we="DialogPortal",[Tr,gt]=pt(we,{forceMount:void 0}),xt=e=>{const{__scopeDialog:t,forceMount:n,children:r,container:a}=e,o=L(we,t);return p.jsx(Tr,{scope:t,forceMount:n,children:s.Children.map(r,i=>p.jsx(K,{present:n||o.open,children:p.jsx(ot,{asChild:!0,container:a,children:i})}))})};xt.displayName=we;var re="DialogOverlay",bt=s.forwardRef((e,t)=>{const n=gt(re,e.__scopeDialog),{forceMount:r=n.forceMount,...a}=e,o=L(re,e.__scopeDialog);return o.modal?p.jsx(K,{present:r||o.open,children:p.jsx(jr,{...a,ref:t})}):null});bt.displayName=re;var _r=G("DialogOverlay.RemoveScroll"),jr=s.forwardRef((e,t)=>{const{__scopeDialog:n,...r}=e,a=L(re,n);return p.jsx(yt,{as:_r,allowPinchZoom:!0,shards:[a.contentRef],children:p.jsx(R.div,{"data-state":Se(a.open),...r,ref:t,style:{pointerEvents:"auto",...r.style}})})}),z="DialogContent",Ct=s.forwardRef((e,t)=>{const n=gt(z,e.__scopeDialog),{forceMount:r=n.forceMount,...a}=e,o=L(z,e.__scopeDialog);return p.jsx(K,{present:r||o.open,children:o.modal?p.jsx(zr,{...a,ref:t}):p.jsx(Fr,{...a,ref:t})})});Ct.displayName=z;var zr=s.forwardRef((e,t)=>{const n=L(z,e.__scopeDialog),r=s.useRef(null),a=N(t,n.contentRef,r);return s.useEffect(()=>{const o=r.current;if(o)return Yn(o)},[]),p.jsx(Mt,{...e,ref:a,trapFocus:n.open,disableOutsidePointerEvents:!0,onCloseAutoFocus:D(e.onCloseAutoFocus,o=>{var i;o.preventDefault(),(i=n.triggerRef.current)==null||i.focus()}),onPointerDownOutside:D(e.onPointerDownOutside,o=>{const i=o.detail.originalEvent,c=i.button===0&&i.ctrlKey===!0;(i.button===2||c)&&o.preventDefault()}),onFocusOutside:D(e.onFocusOutside,o=>o.preventDefault())})}),Fr=s.forwardRef((e,t)=>{const n=L(z,e.__scopeDialog),r=s.useRef(!1),a=s.useRef(!1);return p.jsx(Mt,{...e,ref:t,trapFocus:!1,disableOutsidePointerEvents:!1,onCloseAutoFocus:o=>{var i,c;(i=e.onCloseAutoFocus)==null||i.call(e,o),o.defaultPrevented||(r.current||(c=n.triggerRef.current)==null||c.focus(),o.preventDefault()),r.current=!1,a.current=!1},onInteractOutside:o=>{var f,u;(f=e.onInteractOutside)==null||f.call(e,o),o.defaultPrevented||(r.current=!0,o.detail.originalEvent.type==="pointerdown"&&(a.current=!0));const i=o.target;((u=n.triggerRef.current)==null?void 0:u.contains(i))&&o.preventDefault(),o.detail.originalEvent.type==="focusin"&&a.current&&o.preventDefault()}})}),Mt=s.forwardRef((e,t)=>{const{__scopeDialog:n,trapFocus:r,onOpenAutoFocus:a,onCloseAutoFocus:o,...i}=e,c=L(z,n),f=s.useRef(null),u=N(t,f);return Dn(),p.jsxs(p.Fragment,{children:[p.jsx(rt,{asChild:!0,loop:!0,trapped:r,onMountAutoFocus:a,onUnmountAutoFocus:o,children:p.jsx(Me,{role:"dialog",id:c.contentId,"aria-describedby":c.descriptionId,"aria-labelledby":c.titleId,"data-state":Se(c.open),...i,ref:u,onDismiss:()=>c.onOpenChange(!1)})}),p.jsxs(p.Fragment,{children:[p.jsx(qr,{titleId:c.titleId}),p.jsx(Vr,{contentRef:f,descriptionId:c.descriptionId})]})]})}),Ee="DialogTitle",wt=s.forwardRef((e,t)=>{const{__scopeDialog:n,...r}=e,a=L(Ee,n);return p.jsx(R.h2,{id:a.titleId,...r,ref:t})});wt.displayName=Ee;var Et="DialogDescription",St=s.forwardRef((e,t)=>{const{__scopeDialog:n,...r}=e,a=L(Et,n);return p.jsx(R.p,{id:a.descriptionId,...r,ref:t})});St.displayName=Et;var At="DialogClose",Rt=s.forwardRef((e,t)=>{const{__scopeDialog:n,...r}=e,a=L(At,n);return p.jsx(R.button,{type:"button",...r,ref:t,onClick:D(e.onClick,()=>a.onOpenChange(!1))})});Rt.displayName=At;function Se(e){return e?"open":"closed"}var Pt="DialogTitleWarning",[Wc,Nt]=mn(Pt,{contentName:z,titleName:Ee,docsSlug:"dialog"}),qr=({titleId:e})=>{const t=Nt(Pt),n=`\`${t.contentName}\` requires a \`${t.titleName}\` for the component to be accessible for screen reader users.

If you want to hide the \`${t.titleName}\`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/${t.docsSlug}`;return s.useEffect(()=>{e&&(document.getElementById(e)||console.error(n))},[n,e]),null},Hr="DialogDescriptionWarning",Vr=({contentRef:e,descriptionId:t})=>{const r=`Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {${Nt(Hr).contentName}}.`;return s.useEffect(()=>{var o;const a=(o=e.current)==null?void 0:o.getAttribute("aria-describedby");t&&a&&(document.getElementById(t)||console.warn(r))},[r,e,t]),null},Bc=vt,$c=kt,Uc=xt,Gc=bt,Zc=Ct,Kc=wt,Xc=St,Yc=Rt,Lt={exports:{}},It={};/**
 * @license React
 * use-sync-external-store-shim.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var $=s;function Wr(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var Br=typeof Object.is=="function"?Object.is:Wr,$r=$.useState,Ur=$.useEffect,Gr=$.useLayoutEffect,Zr=$.useDebugValue;function Kr(e,t){var n=t(),r=$r({inst:{value:n,getSnapshot:t}}),a=r[0].inst,o=r[1];return Gr(function(){a.value=n,a.getSnapshot=t,ge(a)&&o({inst:a})},[e,n,t]),Ur(function(){return ge(a)&&o({inst:a}),e(function(){ge(a)&&o({inst:a})})},[e]),Zr(n),n}function ge(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!Br(e,n)}catch{return!0}}function Xr(e,t){return t()}var Yr=typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"?Xr:Kr;It.useSyncExternalStore=$.useSyncExternalStore!==void 0?$.useSyncExternalStore:Yr;Lt.exports=It;var Qr=Lt.exports,le="Collapsible",[Jr,Ot]=Z(le),[ea,Ae]=Jr(le),Dt=s.forwardRef((e,t)=>{const{__scopeCollapsible:n,open:r,defaultOpen:a,disabled:o,onOpenChange:i,...c}=e,[f,u]=ce({prop:r,defaultProp:a??!1,onChange:i,caller:le});return p.jsx(ea,{scope:n,disabled:o,contentId:U(),open:f,onOpenToggle:s.useCallback(()=>u(h=>!h),[u]),children:p.jsx(R.div,{"data-state":Pe(f),"data-disabled":o?"":void 0,...c,ref:t})})});Dt.displayName=le;var Tt="CollapsibleTrigger",_t=s.forwardRef((e,t)=>{const{__scopeCollapsible:n,...r}=e,a=Ae(Tt,n);return p.jsx(R.button,{type:"button","aria-controls":a.contentId,"aria-expanded":a.open||!1,"data-state":Pe(a.open),"data-disabled":a.disabled?"":void 0,disabled:a.disabled,...r,ref:t,onClick:D(e.onClick,a.onOpenToggle)})});_t.displayName=Tt;var Re="CollapsibleContent",jt=s.forwardRef((e,t)=>{const{forceMount:n,...r}=e,a=Ae(Re,e.__scopeCollapsible);return p.jsx(K,{present:n||a.open,children:({present:o})=>p.jsx(ta,{...r,ref:t,present:o})})});jt.displayName=Re;var ta=s.forwardRef((e,t)=>{const{__scopeCollapsible:n,present:r,children:a,...o}=e,i=Ae(Re,n),[c,f]=s.useState(r),u=s.useRef(null),h=N(t,u),y=s.useRef(0),v=y.current,g=s.useRef(0),w=g.current,d=i.open||c,m=s.useRef(d),x=s.useRef(void 0);return s.useEffect(()=>{const k=requestAnimationFrame(()=>m.current=!1);return()=>cancelAnimationFrame(k)},[]),_(()=>{const k=u.current;if(k){x.current=x.current||{transitionDuration:k.style.transitionDuration,animationName:k.style.animationName},k.style.transitionDuration="0s",k.style.animationName="none";const b=k.getBoundingClientRect();y.current=b.height,g.current=b.width,m.current||(k.style.transitionDuration=x.current.transitionDuration,k.style.animationName=x.current.animationName),f(r)}},[i.open,r]),p.jsx(R.div,{"data-state":Pe(i.open),"data-disabled":i.disabled?"":void 0,id:i.contentId,hidden:!d,...o,ref:h,style:{"--radix-collapsible-content-height":v?`${v}px`:void 0,"--radix-collapsible-content-width":w?`${w}px`:void 0,...e.style},children:d&&a})});function Pe(e){return e?"open":"closed"}var na=Dt,ra=_t,aa=jt,I="Accordion",oa=["Home","End","ArrowDown","ArrowUp","ArrowLeft","ArrowRight"],[Ne,ca,sa]=wn(I),[ue]=Z(I,[sa,Ot]),Le=Ot(),zt=S.forwardRef((e,t)=>{const{type:n,...r}=e,a=r,o=r;return p.jsx(Ne.Provider,{scope:e.__scopeAccordion,children:n==="multiple"?p.jsx(da,{...o,ref:t}):p.jsx(ua,{...a,ref:t})})});zt.displayName=I;var[Ft,ia]=ue(I),[qt,la]=ue(I,{collapsible:!1}),ua=S.forwardRef((e,t)=>{const{value:n,defaultValue:r,onValueChange:a=()=>{},collapsible:o=!1,...i}=e,[c,f]=ce({prop:n,defaultProp:r??"",onChange:a,caller:I});return p.jsx(Ft,{scope:e.__scopeAccordion,value:S.useMemo(()=>c?[c]:[],[c]),onItemOpen:f,onItemClose:S.useCallback(()=>o&&f(""),[o,f]),children:p.jsx(qt,{scope:e.__scopeAccordion,collapsible:o,children:p.jsx(Ht,{...i,ref:t})})})}),da=S.forwardRef((e,t)=>{const{value:n,defaultValue:r,onValueChange:a=()=>{},...o}=e,[i,c]=ce({prop:n,defaultProp:r??[],onChange:a,caller:I}),f=S.useCallback(h=>c((y=[])=>[...y,h]),[c]),u=S.useCallback(h=>c((y=[])=>y.filter(v=>v!==h)),[c]);return p.jsx(Ft,{scope:e.__scopeAccordion,value:i,onItemOpen:f,onItemClose:u,children:p.jsx(qt,{scope:e.__scopeAccordion,collapsible:!0,children:p.jsx(Ht,{...o,ref:t})})})}),[fa,de]=ue(I),Ht=S.forwardRef((e,t)=>{const{__scopeAccordion:n,disabled:r,dir:a,orientation:o="vertical",...i}=e,c=S.useRef(null),f=N(c,t),u=ca(n),y=Sn(a)==="ltr",v=D(e.onKeyDown,g=>{var P;if(!oa.includes(g.key))return;const w=g.target,d=u().filter(T=>{var F;return!((F=T.ref.current)!=null&&F.disabled)}),m=d.findIndex(T=>T.ref.current===w),x=d.length;if(m===-1)return;g.preventDefault();let k=m;const b=0,C=x-1,E=()=>{k=m+1,k>C&&(k=b)},A=()=>{k=m-1,k<b&&(k=C)};switch(g.key){case"Home":k=b;break;case"End":k=C;break;case"ArrowRight":o==="horizontal"&&(y?E():A());break;case"ArrowDown":o==="vertical"&&E();break;case"ArrowLeft":o==="horizontal"&&(y?A():E());break;case"ArrowUp":o==="vertical"&&A();break}const M=k%x;(P=d[M].ref.current)==null||P.focus()});return p.jsx(fa,{scope:n,disabled:r,direction:a,orientation:o,children:p.jsx(Ne.Slot,{scope:n,children:p.jsx(R.div,{...i,"data-orientation":o,ref:f,onKeyDown:r?void 0:v})})})}),ae="AccordionItem",[ha,Ie]=ue(ae),Vt=S.forwardRef((e,t)=>{const{__scopeAccordion:n,value:r,...a}=e,o=de(ae,n),i=ia(ae,n),c=Le(n),f=U(),u=r&&i.value.includes(r)||!1,h=o.disabled||e.disabled;return p.jsx(ha,{scope:n,open:u,disabled:h,triggerId:f,children:p.jsx(na,{"data-orientation":o.orientation,"data-state":Zt(u),...c,...a,ref:t,disabled:h,open:u,onOpenChange:y=>{y?i.onItemOpen(r):i.onItemClose(r)}})})});Vt.displayName=ae;var Wt="AccordionHeader",Bt=S.forwardRef((e,t)=>{const{__scopeAccordion:n,...r}=e,a=de(I,n),o=Ie(Wt,n);return p.jsx(R.h3,{"data-orientation":a.orientation,"data-state":Zt(o.open),"data-disabled":o.disabled?"":void 0,...r,ref:t})});Bt.displayName=Wt;var Ce="AccordionTrigger",$t=S.forwardRef((e,t)=>{const{__scopeAccordion:n,...r}=e,a=de(I,n),o=Ie(Ce,n),i=la(Ce,n),c=Le(n);return p.jsx(Ne.ItemSlot,{scope:n,children:p.jsx(ra,{"aria-disabled":o.open&&!i.collapsible||void 0,"data-orientation":a.orientation,id:o.triggerId,...c,...r,ref:t})})});$t.displayName=Ce;var Ut="AccordionContent",Gt=S.forwardRef((e,t)=>{const{__scopeAccordion:n,...r}=e,a=de(I,n),o=Ie(Ut,n),i=Le(n);return p.jsx(aa,{role:"region","aria-labelledby":o.triggerId,"data-orientation":a.orientation,...i,...r,ref:t,style:{"--radix-accordion-content-height":"var(--radix-collapsible-content-height)","--radix-accordion-content-width":"var(--radix-collapsible-content-width)",...e.style}})});Gt.displayName=Ut;function Zt(e){return e?"open":"closed"}var Qc=zt,Jc=Vt,es=Bt,ts=$t,ns=Gt;function ya(){return Qr.useSyncExternalStore(pa,()=>!0,()=>!1)}function pa(){return()=>{}}var Oe="Avatar",[va]=Z(Oe),[ma,Kt]=va(Oe),Xt=s.forwardRef((e,t)=>{const{__scopeAvatar:n,...r}=e,[a,o]=s.useState("idle");return p.jsx(ma,{scope:n,imageLoadingStatus:a,onImageLoadingStatusChange:o,children:p.jsx(R.span,{...r,ref:t})})});Xt.displayName=Oe;var Yt="AvatarImage",Qt=s.forwardRef((e,t)=>{const{__scopeAvatar:n,src:r,onLoadingStatusChange:a=()=>{},...o}=e,i=Kt(Yt,n),c=ka(r,o),f=B(u=>{a(u),i.onImageLoadingStatusChange(u)});return _(()=>{c!=="idle"&&f(c)},[c,f]),c==="loaded"?p.jsx(R.img,{...o,ref:t,src:r}):null});Qt.displayName=Yt;var Jt="AvatarFallback",en=s.forwardRef((e,t)=>{const{__scopeAvatar:n,delayMs:r,...a}=e,o=Kt(Jt,n),[i,c]=s.useState(r===void 0);return s.useEffect(()=>{if(r!==void 0){const f=window.setTimeout(()=>c(!0),r);return()=>window.clearTimeout(f)}},[r]),i&&o.imageLoadingStatus!=="loaded"?p.jsx(R.span,{...a,ref:t}):null});en.displayName=Jt;function Ge(e,t){return e?t?(e.src!==t&&(e.src=t),e.complete&&e.naturalWidth>0?"loaded":"loading"):"error":"idle"}function ka(e,{referrerPolicy:t,crossOrigin:n}){const r=ya(),a=s.useRef(null),o=r?(a.current||(a.current=new window.Image),a.current):null,[i,c]=s.useState(()=>Ge(o,e));return _(()=>{c(Ge(o,e))},[o,e]),_(()=>{const f=y=>()=>{c(y)};if(!o)return;const u=f("loaded"),h=f("error");return o.addEventListener("load",u),o.addEventListener("error",h),t&&(o.referrerPolicy=t),typeof n=="string"&&(o.crossOrigin=n),()=>{o.removeEventListener("load",u),o.removeEventListener("error",h)}},[o,n,t]),i}var rs=Xt,as=Qt,os=en;export{qc as $,Sa as A,Ga as B,za as C,Me as D,Sc as E,rt as F,mo as G,Co as H,cc as I,Ra as J,Do as K,dc as L,Wo as M,lc as N,jo as O,R as P,vo as Q,yt as R,xa as S,bc as T,Lc as U,Nc as V,Po as W,_c as X,Io as Y,Wa as Z,Hc as _,N as a,Ja as a$,ba as a0,Oa as a1,xc as a2,gc as a3,Ya as a4,Mc as a5,Cc as a6,Ao as a7,Ic as a8,nc as a9,No as aA,ja as aB,qa as aC,Ha as aD,oo as aE,Jc as aF,es as aG,ts as aH,_a as aI,ns as aJ,Qc as aK,Vc as aL,Wc as aM,$c as aN,rs as aO,as as aP,os as aQ,wa as aR,to as aS,Fa as aT,Uo as aU,ho as aV,yo as aW,co as aX,xo as aY,Va as aZ,Qa as a_,Fo as aa,hc as ab,ko as ac,kc as ad,Xa as ae,Da as af,sc as ag,Ro as ah,So as ai,zo as aj,Gc as ak,Uc as al,Zc as am,Yc as an,Kc as ao,Xc as ap,Bc as aq,zc as ar,Fc as as,rc as at,ro as au,Qr as av,La as aw,Zo as ax,Na as ay,Pa as az,B as b,pc as b0,jc as b1,_o as b2,qo as b3,Ka as b4,Ac as b5,uc as b6,Eo as b7,Bo as b8,uo as b9,Ia as bA,Ec as bB,wc as bC,Oo as bD,To as bE,ao as bF,Mo as bG,Pc as bH,Go as bI,fc as bJ,oc as bK,Ho as bL,Dc as bM,Tc as bN,$o as bO,no as ba,ac as bb,Ba as bc,so as bd,io as be,Za as bf,wo as bg,tc as bh,go as bi,Yo as bj,Qo as bk,Jo as bl,Ko as bm,$a as bn,Xo as bo,vc as bp,Ma as bq,eo as br,Ca as bs,Aa as bt,fo as bu,po as bv,yc as bw,Oc as bx,Lo as by,ic as bz,Z as c,wn as d,U as e,D as f,Sn as g,ce as h,Ye as i,p as j,K as k,ot as l,Dn as m,G as n,Yn as o,Mn as p,Ta as q,Ua as r,mc as s,Vo as t,_ as u,Rc as v,ec as w,lo as x,Ea as y,bo as z};
