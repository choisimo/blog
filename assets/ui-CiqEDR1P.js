import{r as s,R as Ke,a as en,b as M,c as tn}from"./vendor-D9MDlKGr.js";var Ze={exports:{}},ae={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var nn=s,rn=Symbol.for("react.element"),on=Symbol.for("react.fragment"),an=Object.prototype.hasOwnProperty,cn=nn.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,sn={key:!0,ref:!0,__self:!0,__source:!0};function Xe(e,t,n){var r,o={},a=null,i=null;n!==void 0&&(a=""+n),t.key!==void 0&&(a=""+t.key),t.ref!==void 0&&(i=t.ref);for(r in t)an.call(t,r)&&!sn.hasOwnProperty(r)&&(o[r]=t[r]);if(e&&e.defaultProps)for(r in t=e.defaultProps,t)o[r]===void 0&&(o[r]=t[r]);return{$$typeof:rn,type:e,key:a,ref:i,props:o,_owner:cn.current}}ae.Fragment=on;ae.jsx=Xe;ae.jsxs=Xe;Ze.exports=ae;var v=Ze.exports;function De(e,t){if(typeof e=="function")return e(t);e!=null&&(e.current=t)}function Ye(...e){return t=>{let n=!1;const r=e.map(o=>{const a=De(o,t);return!n&&typeof a=="function"&&(n=!0),a});if(n)return()=>{for(let o=0;o<r.length;o++){const a=r[o];typeof a=="function"?a():De(e[o],null)}}}}function N(...e){return s.useCallback(Ye(...e),e)}function G(e){const t=ln(e),n=s.forwardRef((r,o)=>{const{children:a,...i}=r,c=s.Children.toArray(a),d=c.find(un);if(d){const l=d.props.children,f=c.map(p=>p===d?s.Children.count(l)>1?s.Children.only(null):s.isValidElement(l)?l.props.children:null:p);return v.jsx(t,{...i,ref:o,children:s.isValidElement(l)?s.cloneElement(l,void 0,f):null})}return v.jsx(t,{...i,ref:o,children:a})});return n.displayName=`${e}.Slot`,n}var Co=G("Slot");function ln(e){const t=s.forwardRef((n,r)=>{const{children:o,...a}=n;if(s.isValidElement(o)){const i=fn(o),c=dn(a,o.props);return o.type!==s.Fragment&&(c.ref=r?Ye(r,i):i),s.cloneElement(o,c)}return s.Children.count(o)>1?s.Children.only(null):null});return t.displayName=`${e}.SlotClone`,t}var Qe=Symbol("radix.slottable");function bo(e){const t=({children:n})=>v.jsx(v.Fragment,{children:n});return t.displayName=`${e}.Slottable`,t.__radixId=Qe,t}function un(e){return s.isValidElement(e)&&typeof e.type=="function"&&"__radixId"in e.type&&e.type.__radixId===Qe}function dn(e,t){const n={...t};for(const r in t){const o=e[r],a=t[r];/^on[A-Z]/.test(r)?o&&a?n[r]=(...c)=>{const d=a(...c);return o(...c),d}:o&&(n[r]=o):r==="style"?n[r]={...o,...a}:r==="className"&&(n[r]=[o,a].filter(Boolean).join(" "))}return{...e,...n}}function fn(e){var r,o;let t=(r=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:r.get,n=t&&"isReactWarning"in t&&t.isReactWarning;return n?e.ref:(t=(o=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:o.get,n=t&&"isReactWarning"in t&&t.isReactWarning,n?e.props.ref:e.props.ref||e.ref)}/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pn=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),Je=(...e)=>e.filter((t,n,r)=>!!t&&t.trim()!==""&&r.indexOf(t)===n).join(" ").trim();/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var vn={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const hn=s.forwardRef(({color:e="currentColor",size:t=24,strokeWidth:n=2,absoluteStrokeWidth:r,className:o="",children:a,iconNode:i,...c},d)=>s.createElement("svg",{ref:d,...vn,width:t,height:t,stroke:e,strokeWidth:r?Number(n)*24/Number(t):n,className:Je("lucide",o),...c},[...i.map(([l,f])=>s.createElement(l,f)),...Array.isArray(a)?a:[a]]));/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=(e,t)=>{const n=s.forwardRef(({className:r,...o},a)=>s.createElement(hn,{ref:a,iconNode:t,className:Je(`lucide-${pn(e)}`,r),...o}));return n.displayName=`${e}`,n};/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Eo=h("ArrowLeft",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wo=h("ArrowRight",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const So=h("ArrowUp",[["path",{d:"m5 12 7-7 7 7",key:"hav0vg"}],["path",{d:"M12 19V5",key:"x0mq9r"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Mo=h("BookOpen",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ao=h("Bot",[["path",{d:"M12 8V4H8",key:"hb8ula"}],["rect",{width:"16",height:"12",x:"4",y:"8",rx:"2",key:"enze0r"}],["path",{d:"M2 14h2",key:"vft8re"}],["path",{d:"M20 14h2",key:"4cs60a"}],["path",{d:"M15 13v2",key:"1xurst"}],["path",{d:"M9 13v2",key:"rq6x2g"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ro=h("Calendar",[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Po=h("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const No=h("ChevronDown",[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Io=h("ChevronLeft",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oo=h("ChevronRight",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Lo=h("ChevronUp",[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Do=h("Circle",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _o=h("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const To=h("CodeXml",[["path",{d:"m18 16 4-4-4-4",key:"1inbqp"}],["path",{d:"m6 8-4 4 4 4",key:"15zrgr"}],["path",{d:"m14.5 4-5 16",key:"e7oirm"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const jo=h("Copy",[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fo=h("Dot",[["circle",{cx:"12.1",cy:"12.1",r:"1",key:"18d7e5"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wo=h("Earth",[["path",{d:"M21.54 15H17a2 2 0 0 0-2 2v4.54",key:"1djwo0"}],["path",{d:"M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17",key:"1tzkfa"}],["path",{d:"M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05",key:"14pb5j"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Uo=h("EllipsisVertical",[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"12",cy:"5",r:"1",key:"gxeob9"}],["circle",{cx:"12",cy:"19",r:"1",key:"lyex9k"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $o=h("Ellipsis",[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"19",cy:"12",r:"1",key:"1wjl8i"}],["circle",{cx:"5",cy:"12",r:"1",key:"1pcz8c"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zo=h("ExternalLink",[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Bo=h("FileText",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Vo=h("Github",[["path",{d:"M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4",key:"tonef"}],["path",{d:"M9 18c-4.51 2-5-2-7-2",key:"9comsn"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qo=h("Globe",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",key:"13o1zl"}],["path",{d:"M2 12h20",key:"9i4pu4"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ho=h("House",[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"1d0kgt"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Go=h("Image",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2",key:"1m3agn"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",key:"1xmnt7"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ko=h("Languages",[["path",{d:"m5 8 6 6",key:"1wu5hv"}],["path",{d:"m4 14 6-6 2-3",key:"1k1g8d"}],["path",{d:"M2 5h12",key:"or177f"}],["path",{d:"M7 2h1",key:"1t2jsx"}],["path",{d:"m22 22-5-10-5 10",key:"don7ne"}],["path",{d:"M14 18h6",key:"1m8k6r"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zo=h("Layers",[["path",{d:"m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",key:"8b97xw"}],["path",{d:"m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65",key:"dd6zsq"}],["path",{d:"m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65",key:"ep9fru"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xo=h("Lightbulb",[["path",{d:"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",key:"1gvzjb"}],["path",{d:"M9 18h6",key:"x1upvd"}],["path",{d:"M10 22h4",key:"ceow96"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yo=h("Link2",[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qo=h("Linkedin",[["path",{d:"M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z",key:"c2jq9f"}],["rect",{width:"4",height:"12",x:"2",y:"9",key:"mk3on5"}],["circle",{cx:"4",cy:"4",r:"2",key:"bt5ra8"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Jo=h("LoaderCircle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ea=h("Mail",[["rect",{width:"20",height:"16",x:"2",y:"4",rx:"2",key:"18n3k1"}],["path",{d:"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7",key:"1ocrg3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ta=h("Map",[["path",{d:"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",key:"169xi5"}],["path",{d:"M15 5.764v15",key:"1pn4in"}],["path",{d:"M9 3.236v15",key:"1uimfh"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const na=h("Menu",[["line",{x1:"4",x2:"20",y1:"12",y2:"12",key:"1e0a9i"}],["line",{x1:"4",x2:"20",y1:"6",y2:"6",key:"1owob3"}],["line",{x1:"4",x2:"20",y1:"18",y2:"18",key:"yk5zj1"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ra=h("MessageCircle",[["path",{d:"M7.9 20A9 9 0 1 0 4 16.1L2 22Z",key:"vv11sd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oa=h("MessageSquare",[["path",{d:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",key:"1lielz"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const aa=h("MonitorUp",[["path",{d:"m9 10 3-3 3 3",key:"11gsxs"}],["path",{d:"M12 13V7",key:"h0r20n"}],["rect",{width:"20",height:"14",x:"2",y:"3",rx:"2",key:"48i651"}],["path",{d:"M12 17v4",key:"1riwvh"}],["path",{d:"M8 21h8",key:"1ev6f3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ca=h("Monitor",[["rect",{width:"20",height:"14",x:"2",y:"3",rx:"2",key:"48i651"}],["line",{x1:"8",x2:"16",y1:"21",y2:"21",key:"1svkeh"}],["line",{x1:"12",x2:"12",y1:"17",y2:"21",key:"vw1qmm"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sa=h("Moon",[["path",{d:"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",key:"a7tn18"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ia=h("Network",[["rect",{x:"16",y:"16",width:"6",height:"6",rx:"1",key:"4q2zg0"}],["rect",{x:"2",y:"16",width:"6",height:"6",rx:"1",key:"8cvhb9"}],["rect",{x:"9",y:"2",width:"6",height:"6",rx:"1",key:"1egb70"}],["path",{d:"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3",key:"1jsf9p"}],["path",{d:"M12 12V8",key:"2874zd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const la=h("NotebookPen",[["path",{d:"M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4",key:"re6nr2"}],["path",{d:"M2 6h4",key:"aawbzj"}],["path",{d:"M2 10h4",key:"l0bgd4"}],["path",{d:"M2 14h4",key:"1gsvsf"}],["path",{d:"M2 18h4",key:"1bu2t1"}],["path",{d:"M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",key:"pqwjuv"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ua=h("PanelLeft",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M9 3v18",key:"fh3hqa"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const da=h("PenLine",[["path",{d:"M12 20h9",key:"t2du7b"}],["path",{d:"M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",key:"1ykcvy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fa=h("RefreshCw",[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pa=h("RotateCcw",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const va=h("Search",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ha=h("Send",[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ya=h("Settings",[["path",{d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",key:"1qme2f"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ma=h("Share2",[["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}],["circle",{cx:"6",cy:"12",r:"3",key:"w7nqdw"}],["circle",{cx:"18",cy:"19",r:"3",key:"1xt0gg"}],["line",{x1:"8.59",x2:"15.42",y1:"13.51",y2:"17.49",key:"47mynk"}],["line",{x1:"15.41",x2:"8.59",y1:"6.51",y2:"10.49",key:"1n3mei"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ga=h("Shield",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ka=h("Sparkles",[["path",{d:"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",key:"4pj2yx"}],["path",{d:"M20 3v4",key:"1olli1"}],["path",{d:"M22 5h-4",key:"1gvqau"}],["path",{d:"M4 17v2",key:"vumght"}],["path",{d:"M5 18H3",key:"zchphs"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xa=h("Square",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ca=h("Sun",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ba=h("Tag",[["path",{d:"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",key:"vktsd0"}],["circle",{cx:"7.5",cy:"7.5",r:".5",fill:"currentColor",key:"kqv944"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ea=h("Terminal",[["polyline",{points:"4 17 10 11 4 5",key:"akl6gq"}],["line",{x1:"12",x2:"20",y1:"19",y2:"19",key:"q2wloq"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const wa=h("ThumbsDown",[["path",{d:"M17 14V2",key:"8ymqnk"}],["path",{d:"M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z",key:"m61m77"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sa=h("ThumbsUp",[["path",{d:"M7 10v12",key:"1qc93n"}],["path",{d:"M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",key:"emmmcr"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ma=h("TrendingUp",[["polyline",{points:"22 7 13.5 15.5 8.5 10.5 2 17",key:"126l90"}],["polyline",{points:"16 7 22 7 22 13",key:"kwv8wd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Aa=h("Twitter",[["path",{d:"M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z",key:"pff0z6"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ra=h("User",[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pa=h("Users",[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["path",{d:"M22 21v-2a4 4 0 0 0-3-3.87",key:"kshegd"}],["path",{d:"M16 3.13a4 4 0 0 1 0 7.75",key:"1da9ce"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Na=h("WifiOff",[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}],["path",{d:"M5 12.859a10 10 0 0 1 5.17-2.69",key:"1dl1wf"}],["path",{d:"M19 12.859a10 10 0 0 0-2.007-1.523",key:"4k23kn"}],["path",{d:"M2 8.82a15 15 0 0 1 4.177-2.643",key:"1grhjp"}],["path",{d:"M22 8.82a15 15 0 0 0-11.288-3.764",key:"z3jwby"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ia=h("Wifi",[["path",{d:"M12 20h.01",key:"zekei9"}],["path",{d:"M2 8.82a15 15 0 0 1 20 0",key:"dnpr2z"}],["path",{d:"M5 12.859a10 10 0 0 1 14 0",key:"1x1e6c"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0",key:"1bycff"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oa=h("X",[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const La=h("ZoomIn",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"11",x2:"11",y1:"8",y2:"14",key:"1vmskp"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Da=h("ZoomOut",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]]);function D(e,t,{checkForDefaultPrevented:n=!0}={}){return function(o){if(e==null||e(o),n===!1||!o.defaultPrevented)return t==null?void 0:t(o)}}function yn(e,t){const n=s.createContext(t),r=a=>{const{children:i,...c}=a,d=s.useMemo(()=>c,Object.values(c));return v.jsx(n.Provider,{value:d,children:i})};r.displayName=e+"Provider";function o(a){const i=s.useContext(n);if(i)return i;if(t!==void 0)return t;throw new Error(`\`${a}\` must be used within \`${e}\``)}return[r,o]}function K(e,t=[]){let n=[];function r(a,i){const c=s.createContext(i),d=n.length;n=[...n,i];const l=p=>{var x;const{scope:y,children:k,...w}=p,u=((x=y==null?void 0:y[e])==null?void 0:x[d])||c,m=s.useMemo(()=>w,Object.values(w));return v.jsx(u.Provider,{value:m,children:k})};l.displayName=a+"Provider";function f(p,y){var u;const k=((u=y==null?void 0:y[e])==null?void 0:u[d])||c,w=s.useContext(k);if(w)return w;if(i!==void 0)return i;throw new Error(`\`${p}\` must be used within \`${a}\``)}return[l,f]}const o=()=>{const a=n.map(i=>s.createContext(i));return function(c){const d=(c==null?void 0:c[e])||a;return s.useMemo(()=>({[`__scope${e}`]:{...c,[e]:d}}),[c,d])}};return o.scopeName=e,[r,mn(o,...t)]}function mn(...e){const t=e[0];if(e.length===1)return t;const n=()=>{const r=e.map(o=>({useScope:o(),scopeName:o.scopeName}));return function(a){const i=r.reduce((c,{useScope:d,scopeName:l})=>{const p=d(a)[`__scope${l}`];return{...c,...p}},{});return s.useMemo(()=>({[`__scope${t.scopeName}`]:i}),[i])}};return n.scopeName=t.scopeName,n}var T=globalThis!=null&&globalThis.document?s.useLayoutEffect:()=>{},gn=Ke[" useInsertionEffect ".trim().toString()]||T;function ce({prop:e,defaultProp:t,onChange:n=()=>{},caller:r}){const[o,a,i]=kn({defaultProp:t,onChange:n}),c=e!==void 0,d=c?e:o;{const f=s.useRef(e!==void 0);s.useEffect(()=>{const p=f.current;p!==c&&console.warn(`${r} is changing from ${p?"controlled":"uncontrolled"} to ${c?"controlled":"uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`),f.current=c},[c,r])}const l=s.useCallback(f=>{var p;if(c){const y=xn(f)?f(e):f;y!==e&&((p=i.current)==null||p.call(i,y))}else a(f)},[c,e,a,i]);return[d,l]}function kn({defaultProp:e,onChange:t}){const[n,r]=s.useState(e),o=s.useRef(n),a=s.useRef(t);return gn(()=>{a.current=t},[t]),s.useEffect(()=>{var i;o.current!==n&&((i=a.current)==null||i.call(a,n),o.current=n)},[n,o]),[n,r,a]}function xn(e){return typeof e=="function"}var Cn=["a","button","div","form","h2","h3","img","input","label","li","nav","ol","p","select","span","svg","ul"],R=Cn.reduce((e,t)=>{const n=G(`Primitive.${t}`),r=s.forwardRef((o,a)=>{const{asChild:i,...c}=o,d=i?n:t;return typeof window<"u"&&(window[Symbol.for("radix-ui")]=!0),v.jsx(d,{...c,ref:a})});return r.displayName=`Primitive.${t}`,{...e,[t]:r}},{});function bn(e,t){e&&en.flushSync(()=>e.dispatchEvent(t))}function En(e){const t=e+"CollectionProvider",[n,r]=K(t),[o,a]=n(t,{collectionRef:{current:null},itemMap:new Map}),i=u=>{const{scope:m,children:x}=u,g=M.useRef(null),C=M.useRef(new Map).current;return v.jsx(o,{scope:m,itemMap:C,collectionRef:g,children:x})};i.displayName=t;const c=e+"CollectionSlot",d=G(c),l=M.forwardRef((u,m)=>{const{scope:x,children:g}=u,C=a(c,x),b=N(m,C.collectionRef);return v.jsx(d,{ref:b,children:g})});l.displayName=c;const f=e+"CollectionItemSlot",p="data-radix-collection-item",y=G(f),k=M.forwardRef((u,m)=>{const{scope:x,children:g,...C}=u,b=M.useRef(null),S=N(m,b),A=a(f,x);return M.useEffect(()=>(A.itemMap.set(b,{ref:b,...C}),()=>void A.itemMap.delete(b))),v.jsx(y,{[p]:"",ref:S,children:g})});k.displayName=f;function w(u){const m=a(e+"CollectionConsumer",u);return M.useCallback(()=>{const g=m.collectionRef.current;if(!g)return[];const C=Array.from(g.querySelectorAll(`[${p}]`));return Array.from(m.itemMap.values()).sort((A,E)=>C.indexOf(A.ref.current)-C.indexOf(E.ref.current))},[m.collectionRef,m.itemMap])}return[{Provider:i,Slot:l,ItemSlot:k},w,r]}var wn=s.createContext(void 0);function Sn(e){const t=s.useContext(wn);return e||t||"ltr"}function V(e){const t=s.useRef(e);return s.useEffect(()=>{t.current=e}),s.useMemo(()=>(...n)=>{var r;return(r=t.current)==null?void 0:r.call(t,...n)},[])}function Mn(e,t=globalThis==null?void 0:globalThis.document){const n=V(e);s.useEffect(()=>{const r=o=>{o.key==="Escape"&&n(o)};return t.addEventListener("keydown",r,{capture:!0}),()=>t.removeEventListener("keydown",r,{capture:!0})},[n,t])}var An="DismissableLayer",xe="dismissableLayer.update",Rn="dismissableLayer.pointerDownOutside",Pn="dismissableLayer.focusOutside",_e,et=s.createContext({layers:new Set,layersWithOutsidePointerEventsDisabled:new Set,branches:new Set}),Ee=s.forwardRef((e,t)=>{const{disableOutsidePointerEvents:n=!1,onEscapeKeyDown:r,onPointerDownOutside:o,onFocusOutside:a,onInteractOutside:i,onDismiss:c,...d}=e,l=s.useContext(et),[f,p]=s.useState(null),y=(f==null?void 0:f.ownerDocument)??(globalThis==null?void 0:globalThis.document),[,k]=s.useState({}),w=N(t,E=>p(E)),u=Array.from(l.layers),[m]=[...l.layersWithOutsidePointerEventsDisabled].slice(-1),x=u.indexOf(m),g=f?u.indexOf(f):-1,C=l.layersWithOutsidePointerEventsDisabled.size>0,b=g>=x,S=In(E=>{const P=E.target,_=[...l.branches].some(W=>W.contains(P));!b||_||(o==null||o(E),i==null||i(E),E.defaultPrevented||c==null||c())},y),A=On(E=>{const P=E.target;[...l.branches].some(W=>W.contains(P))||(a==null||a(E),i==null||i(E),E.defaultPrevented||c==null||c())},y);return Mn(E=>{g===l.layers.size-1&&(r==null||r(E),!E.defaultPrevented&&c&&(E.preventDefault(),c()))},y),s.useEffect(()=>{if(f)return n&&(l.layersWithOutsidePointerEventsDisabled.size===0&&(_e=y.body.style.pointerEvents,y.body.style.pointerEvents="none"),l.layersWithOutsidePointerEventsDisabled.add(f)),l.layers.add(f),Te(),()=>{n&&l.layersWithOutsidePointerEventsDisabled.size===1&&(y.body.style.pointerEvents=_e)}},[f,y,n,l]),s.useEffect(()=>()=>{f&&(l.layers.delete(f),l.layersWithOutsidePointerEventsDisabled.delete(f),Te())},[f,l]),s.useEffect(()=>{const E=()=>k({});return document.addEventListener(xe,E),()=>document.removeEventListener(xe,E)},[]),v.jsx(R.div,{...d,ref:w,style:{pointerEvents:C?b?"auto":"none":void 0,...e.style},onFocusCapture:D(e.onFocusCapture,A.onFocusCapture),onBlurCapture:D(e.onBlurCapture,A.onBlurCapture),onPointerDownCapture:D(e.onPointerDownCapture,S.onPointerDownCapture)})});Ee.displayName=An;var Nn="DismissableLayerBranch",tt=s.forwardRef((e,t)=>{const n=s.useContext(et),r=s.useRef(null),o=N(t,r);return s.useEffect(()=>{const a=r.current;if(a)return n.branches.add(a),()=>{n.branches.delete(a)}},[n.branches]),v.jsx(R.div,{...e,ref:o})});tt.displayName=Nn;function In(e,t=globalThis==null?void 0:globalThis.document){const n=V(e),r=s.useRef(!1),o=s.useRef(()=>{});return s.useEffect(()=>{const a=c=>{if(c.target&&!r.current){let d=function(){nt(Rn,n,l,{discrete:!0})};const l={originalEvent:c};c.pointerType==="touch"?(t.removeEventListener("click",o.current),o.current=d,t.addEventListener("click",o.current,{once:!0})):d()}else t.removeEventListener("click",o.current);r.current=!1},i=window.setTimeout(()=>{t.addEventListener("pointerdown",a)},0);return()=>{window.clearTimeout(i),t.removeEventListener("pointerdown",a),t.removeEventListener("click",o.current)}},[t,n]),{onPointerDownCapture:()=>r.current=!0}}function On(e,t=globalThis==null?void 0:globalThis.document){const n=V(e),r=s.useRef(!1);return s.useEffect(()=>{const o=a=>{a.target&&!r.current&&nt(Pn,n,{originalEvent:a},{discrete:!1})};return t.addEventListener("focusin",o),()=>t.removeEventListener("focusin",o)},[t,n]),{onFocusCapture:()=>r.current=!0,onBlurCapture:()=>r.current=!1}}function Te(){const e=new CustomEvent(xe);document.dispatchEvent(e)}function nt(e,t,n,{discrete:r}){const o=n.originalEvent.target,a=new CustomEvent(e,{bubbles:!1,cancelable:!0,detail:n});t&&o.addEventListener(e,t,{once:!0}),r?bn(o,a):o.dispatchEvent(a)}var _a=Ee,Ta=tt,fe=0;function Ln(){s.useEffect(()=>{const e=document.querySelectorAll("[data-radix-focus-guard]");return document.body.insertAdjacentElement("afterbegin",e[0]??je()),document.body.insertAdjacentElement("beforeend",e[1]??je()),fe++,()=>{fe===1&&document.querySelectorAll("[data-radix-focus-guard]").forEach(t=>t.remove()),fe--}},[])}function je(){const e=document.createElement("span");return e.setAttribute("data-radix-focus-guard",""),e.tabIndex=0,e.style.outline="none",e.style.opacity="0",e.style.position="fixed",e.style.pointerEvents="none",e}var pe="focusScope.autoFocusOnMount",ve="focusScope.autoFocusOnUnmount",Fe={bubbles:!1,cancelable:!0},Dn="FocusScope",rt=s.forwardRef((e,t)=>{const{loop:n=!1,trapped:r=!1,onMountAutoFocus:o,onUnmountAutoFocus:a,...i}=e,[c,d]=s.useState(null),l=V(o),f=V(a),p=s.useRef(null),y=N(t,u=>d(u)),k=s.useRef({paused:!1,pause(){this.paused=!0},resume(){this.paused=!1}}).current;s.useEffect(()=>{if(r){let u=function(C){if(k.paused||!c)return;const b=C.target;c.contains(b)?p.current=b:j(p.current,{select:!0})},m=function(C){if(k.paused||!c)return;const b=C.relatedTarget;b!==null&&(c.contains(b)||j(p.current,{select:!0}))},x=function(C){if(document.activeElement===document.body)for(const S of C)S.removedNodes.length>0&&j(c)};document.addEventListener("focusin",u),document.addEventListener("focusout",m);const g=new MutationObserver(x);return c&&g.observe(c,{childList:!0,subtree:!0}),()=>{document.removeEventListener("focusin",u),document.removeEventListener("focusout",m),g.disconnect()}}},[r,c,k.paused]),s.useEffect(()=>{if(c){Ue.add(k);const u=document.activeElement;if(!c.contains(u)){const x=new CustomEvent(pe,Fe);c.addEventListener(pe,l),c.dispatchEvent(x),x.defaultPrevented||(_n(Un(ot(c)),{select:!0}),document.activeElement===u&&j(c))}return()=>{c.removeEventListener(pe,l),setTimeout(()=>{const x=new CustomEvent(ve,Fe);c.addEventListener(ve,f),c.dispatchEvent(x),x.defaultPrevented||j(u??document.body,{select:!0}),c.removeEventListener(ve,f),Ue.remove(k)},0)}}},[c,l,f,k]);const w=s.useCallback(u=>{if(!n&&!r||k.paused)return;const m=u.key==="Tab"&&!u.altKey&&!u.ctrlKey&&!u.metaKey,x=document.activeElement;if(m&&x){const g=u.currentTarget,[C,b]=Tn(g);C&&b?!u.shiftKey&&x===b?(u.preventDefault(),n&&j(C,{select:!0})):u.shiftKey&&x===C&&(u.preventDefault(),n&&j(b,{select:!0})):x===g&&u.preventDefault()}},[n,r,k.paused]);return v.jsx(R.div,{tabIndex:-1,...i,ref:y,onKeyDown:w})});rt.displayName=Dn;function _n(e,{select:t=!1}={}){const n=document.activeElement;for(const r of e)if(j(r,{select:t}),document.activeElement!==n)return}function Tn(e){const t=ot(e),n=We(t,e),r=We(t.reverse(),e);return[n,r]}function ot(e){const t=[],n=document.createTreeWalker(e,NodeFilter.SHOW_ELEMENT,{acceptNode:r=>{const o=r.tagName==="INPUT"&&r.type==="hidden";return r.disabled||r.hidden||o?NodeFilter.FILTER_SKIP:r.tabIndex>=0?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP}});for(;n.nextNode();)t.push(n.currentNode);return t}function We(e,t){for(const n of e)if(!jn(n,{upTo:t}))return n}function jn(e,{upTo:t}){if(getComputedStyle(e).visibility==="hidden")return!0;for(;e;){if(t!==void 0&&e===t)return!1;if(getComputedStyle(e).display==="none")return!0;e=e.parentElement}return!1}function Fn(e){return e instanceof HTMLInputElement&&"select"in e}function j(e,{select:t=!1}={}){if(e&&e.focus){const n=document.activeElement;e.focus({preventScroll:!0}),e!==n&&Fn(e)&&t&&e.select()}}var Ue=Wn();function Wn(){let e=[];return{add(t){const n=e[0];t!==n&&(n==null||n.pause()),e=$e(e,t),e.unshift(t)},remove(t){var n;e=$e(e,t),(n=e[0])==null||n.resume()}}}function $e(e,t){const n=[...e],r=n.indexOf(t);return r!==-1&&n.splice(r,1),n}function Un(e){return e.filter(t=>t.tagName!=="A")}var $n=Ke[" useId ".trim().toString()]||(()=>{}),zn=0;function H(e){const[t,n]=s.useState($n());return T(()=>{n(r=>r??String(zn++))},[e]),t?`radix-${t}`:""}var Bn="Portal",at=s.forwardRef((e,t)=>{var c;const{container:n,...r}=e,[o,a]=s.useState(!1);T(()=>a(!0),[]);const i=n||o&&((c=globalThis==null?void 0:globalThis.document)==null?void 0:c.body);return i?tn.createPortal(v.jsx(R.div,{...r,ref:t}),i):null});at.displayName=Bn;function Vn(e,t){return s.useReducer((n,r)=>t[n][r]??n,e)}var Z=e=>{const{present:t,children:n}=e,r=qn(t),o=typeof n=="function"?n({present:r.isPresent}):s.Children.only(n),a=N(r.ref,Hn(o));return typeof n=="function"||r.isPresent?s.cloneElement(o,{ref:a}):null};Z.displayName="Presence";function qn(e){const[t,n]=s.useState(),r=s.useRef(null),o=s.useRef(e),a=s.useRef("none"),i=e?"mounted":"unmounted",[c,d]=Vn(i,{mounted:{UNMOUNT:"unmounted",ANIMATION_OUT:"unmountSuspended"},unmountSuspended:{MOUNT:"mounted",ANIMATION_END:"unmounted"},unmounted:{MOUNT:"mounted"}});return s.useEffect(()=>{const l=X(r.current);a.current=c==="mounted"?l:"none"},[c]),T(()=>{const l=r.current,f=o.current;if(f!==e){const y=a.current,k=X(l);e?d("MOUNT"):k==="none"||(l==null?void 0:l.display)==="none"?d("UNMOUNT"):d(f&&y!==k?"ANIMATION_OUT":"UNMOUNT"),o.current=e}},[e,d]),T(()=>{if(t){let l;const f=t.ownerDocument.defaultView??window,p=k=>{const u=X(r.current).includes(CSS.escape(k.animationName));if(k.target===t&&u&&(d("ANIMATION_END"),!o.current)){const m=t.style.animationFillMode;t.style.animationFillMode="forwards",l=f.setTimeout(()=>{t.style.animationFillMode==="forwards"&&(t.style.animationFillMode=m)})}},y=k=>{k.target===t&&(a.current=X(r.current))};return t.addEventListener("animationstart",y),t.addEventListener("animationcancel",p),t.addEventListener("animationend",p),()=>{f.clearTimeout(l),t.removeEventListener("animationstart",y),t.removeEventListener("animationcancel",p),t.removeEventListener("animationend",p)}}else d("ANIMATION_END")},[t,d]),{isPresent:["mounted","unmountSuspended"].includes(c),ref:s.useCallback(l=>{r.current=l?getComputedStyle(l):null,n(l)},[])}}function X(e){return(e==null?void 0:e.animationName)||"none"}function Hn(e){var r,o;let t=(r=Object.getOwnPropertyDescriptor(e.props,"ref"))==null?void 0:r.get,n=t&&"isReactWarning"in t&&t.isReactWarning;return n?e.ref:(t=(o=Object.getOwnPropertyDescriptor(e,"ref"))==null?void 0:o.get,n=t&&"isReactWarning"in t&&t.isReactWarning,n?e.props.ref:e.props.ref||e.ref)}var Gn=function(e){if(typeof document>"u")return null;var t=Array.isArray(e)?e[0]:e;return t.ownerDocument.body},U=new WeakMap,Y=new WeakMap,Q={},he=0,ct=function(e){return e&&(e.host||ct(e.parentNode))},Kn=function(e,t){return t.map(function(n){if(e.contains(n))return n;var r=ct(n);return r&&e.contains(r)?r:(console.error("aria-hidden",n,"in not contained inside",e,". Doing nothing"),null)}).filter(function(n){return!!n})},Zn=function(e,t,n,r){var o=Kn(t,Array.isArray(e)?e:[e]);Q[n]||(Q[n]=new WeakMap);var a=Q[n],i=[],c=new Set,d=new Set(o),l=function(p){!p||c.has(p)||(c.add(p),l(p.parentNode))};o.forEach(l);var f=function(p){!p||d.has(p)||Array.prototype.forEach.call(p.children,function(y){if(c.has(y))f(y);else try{var k=y.getAttribute(r),w=k!==null&&k!=="false",u=(U.get(y)||0)+1,m=(a.get(y)||0)+1;U.set(y,u),a.set(y,m),i.push(y),u===1&&w&&Y.set(y,!0),m===1&&y.setAttribute(n,"true"),w||y.setAttribute(r,"true")}catch(x){console.error("aria-hidden: cannot operate on ",y,x)}})};return f(t),c.clear(),he++,function(){i.forEach(function(p){var y=U.get(p)-1,k=a.get(p)-1;U.set(p,y),a.set(p,k),y||(Y.has(p)||p.removeAttribute(r),Y.delete(p)),k||p.removeAttribute(n)}),he--,he||(U=new WeakMap,U=new WeakMap,Y=new WeakMap,Q={})}},Xn=function(e,t,n){n===void 0&&(n="data-aria-hidden");var r=Array.from(Array.isArray(e)?e:[e]),o=Gn(e);return o?(r.push.apply(r,Array.from(o.querySelectorAll("[aria-live], script"))),Zn(r,o,n,"aria-hidden")):function(){return null}},L=function(){return L=Object.assign||function(t){for(var n,r=1,o=arguments.length;r<o;r++){n=arguments[r];for(var a in n)Object.prototype.hasOwnProperty.call(n,a)&&(t[a]=n[a])}return t},L.apply(this,arguments)};function st(e,t){var n={};for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&t.indexOf(r)<0&&(n[r]=e[r]);if(e!=null&&typeof Object.getOwnPropertySymbols=="function")for(var o=0,r=Object.getOwnPropertySymbols(e);o<r.length;o++)t.indexOf(r[o])<0&&Object.prototype.propertyIsEnumerable.call(e,r[o])&&(n[r[o]]=e[r[o]]);return n}function Yn(e,t,n){if(n||arguments.length===2)for(var r=0,o=t.length,a;r<o;r++)(a||!(r in t))&&(a||(a=Array.prototype.slice.call(t,0,r)),a[r]=t[r]);return e.concat(a||Array.prototype.slice.call(t))}var te="right-scroll-bar-position",ne="width-before-scroll-bar",Qn="with-scroll-bars-hidden",Jn="--removed-body-scroll-bar-size";function ye(e,t){return typeof e=="function"?e(t):e&&(e.current=t),e}function er(e,t){var n=s.useState(function(){return{value:e,callback:t,facade:{get current(){return n.value},set current(r){var o=n.value;o!==r&&(n.value=r,n.callback(r,o))}}}})[0];return n.callback=t,n.facade}var tr=typeof window<"u"?s.useLayoutEffect:s.useEffect,ze=new WeakMap;function nr(e,t){var n=er(null,function(r){return e.forEach(function(o){return ye(o,r)})});return tr(function(){var r=ze.get(n);if(r){var o=new Set(r),a=new Set(e),i=n.current;o.forEach(function(c){a.has(c)||ye(c,null)}),a.forEach(function(c){o.has(c)||ye(c,i)})}ze.set(n,e)},[e]),n}function rr(e){return e}function or(e,t){t===void 0&&(t=rr);var n=[],r=!1,o={read:function(){if(r)throw new Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");return n.length?n[n.length-1]:e},useMedium:function(a){var i=t(a,r);return n.push(i),function(){n=n.filter(function(c){return c!==i})}},assignSyncMedium:function(a){for(r=!0;n.length;){var i=n;n=[],i.forEach(a)}n={push:function(c){return a(c)},filter:function(){return n}}},assignMedium:function(a){r=!0;var i=[];if(n.length){var c=n;n=[],c.forEach(a),i=n}var d=function(){var f=i;i=[],f.forEach(a)},l=function(){return Promise.resolve().then(d)};l(),n={push:function(f){i.push(f),l()},filter:function(f){return i=i.filter(f),n}}}};return o}function ar(e){e===void 0&&(e={});var t=or(null);return t.options=L({async:!0,ssr:!1},e),t}var it=function(e){var t=e.sideCar,n=st(e,["sideCar"]);if(!t)throw new Error("Sidecar: please provide `sideCar` property to import the right car");var r=t.read();if(!r)throw new Error("Sidecar medium not found");return s.createElement(r,L({},n))};it.isSideCarExport=!0;function cr(e,t){return e.useMedium(t),it}var lt=ar(),me=function(){},se=s.forwardRef(function(e,t){var n=s.useRef(null),r=s.useState({onScrollCapture:me,onWheelCapture:me,onTouchMoveCapture:me}),o=r[0],a=r[1],i=e.forwardProps,c=e.children,d=e.className,l=e.removeScrollBar,f=e.enabled,p=e.shards,y=e.sideCar,k=e.noRelative,w=e.noIsolation,u=e.inert,m=e.allowPinchZoom,x=e.as,g=x===void 0?"div":x,C=e.gapMode,b=st(e,["forwardProps","children","className","removeScrollBar","enabled","shards","sideCar","noRelative","noIsolation","inert","allowPinchZoom","as","gapMode"]),S=y,A=nr([n,t]),E=L(L({},b),o);return s.createElement(s.Fragment,null,f&&s.createElement(S,{sideCar:lt,removeScrollBar:l,shards:p,noRelative:k,noIsolation:w,inert:u,setCallbacks:a,allowPinchZoom:!!m,lockRef:n,gapMode:C}),i?s.cloneElement(s.Children.only(c),L(L({},E),{ref:A})):s.createElement(g,L({},E,{className:d,ref:A}),c))});se.defaultProps={enabled:!0,removeScrollBar:!0,inert:!1};se.classNames={fullWidth:ne,zeroRight:te};var sr=function(){if(typeof __webpack_nonce__<"u")return __webpack_nonce__};function ir(){if(!document)return null;var e=document.createElement("style");e.type="text/css";var t=sr();return t&&e.setAttribute("nonce",t),e}function lr(e,t){e.styleSheet?e.styleSheet.cssText=t:e.appendChild(document.createTextNode(t))}function ur(e){var t=document.head||document.getElementsByTagName("head")[0];t.appendChild(e)}var dr=function(){var e=0,t=null;return{add:function(n){e==0&&(t=ir())&&(lr(t,n),ur(t)),e++},remove:function(){e--,!e&&t&&(t.parentNode&&t.parentNode.removeChild(t),t=null)}}},fr=function(){var e=dr();return function(t,n){s.useEffect(function(){return e.add(t),function(){e.remove()}},[t&&n])}},ut=function(){var e=fr(),t=function(n){var r=n.styles,o=n.dynamic;return e(r,o),null};return t},pr={left:0,top:0,right:0,gap:0},ge=function(e){return parseInt(e||"",10)||0},vr=function(e){var t=window.getComputedStyle(document.body),n=t[e==="padding"?"paddingLeft":"marginLeft"],r=t[e==="padding"?"paddingTop":"marginTop"],o=t[e==="padding"?"paddingRight":"marginRight"];return[ge(n),ge(r),ge(o)]},hr=function(e){if(e===void 0&&(e="margin"),typeof window>"u")return pr;var t=vr(e),n=document.documentElement.clientWidth,r=window.innerWidth;return{left:t[0],top:t[1],right:t[2],gap:Math.max(0,r-n+t[2]-t[0])}},yr=ut(),B="data-scroll-locked",mr=function(e,t,n,r){var o=e.left,a=e.top,i=e.right,c=e.gap;return n===void 0&&(n="margin"),`
  .`.concat(Qn,` {
   overflow: hidden `).concat(r,`;
   padding-right: `).concat(c,"px ").concat(r,`;
  }
  body[`).concat(B,`] {
    overflow: hidden `).concat(r,`;
    overscroll-behavior: contain;
    `).concat([t&&"position: relative ".concat(r,";"),n==="margin"&&`
    padding-left: `.concat(o,`px;
    padding-top: `).concat(a,`px;
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
  
  body[`).concat(B,`] {
    `).concat(Jn,": ").concat(c,`px;
  }
`)},Be=function(){var e=parseInt(document.body.getAttribute(B)||"0",10);return isFinite(e)?e:0},gr=function(){s.useEffect(function(){return document.body.setAttribute(B,(Be()+1).toString()),function(){var e=Be()-1;e<=0?document.body.removeAttribute(B):document.body.setAttribute(B,e.toString())}},[])},kr=function(e){var t=e.noRelative,n=e.noImportant,r=e.gapMode,o=r===void 0?"margin":r;gr();var a=s.useMemo(function(){return hr(o)},[o]);return s.createElement(yr,{styles:mr(a,!t,o,n?"":"!important")})},Ce=!1;if(typeof window<"u")try{var J=Object.defineProperty({},"passive",{get:function(){return Ce=!0,!0}});window.addEventListener("test",J,J),window.removeEventListener("test",J,J)}catch{Ce=!1}var $=Ce?{passive:!1}:!1,xr=function(e){return e.tagName==="TEXTAREA"},dt=function(e,t){if(!(e instanceof Element))return!1;var n=window.getComputedStyle(e);return n[t]!=="hidden"&&!(n.overflowY===n.overflowX&&!xr(e)&&n[t]==="visible")},Cr=function(e){return dt(e,"overflowY")},br=function(e){return dt(e,"overflowX")},Ve=function(e,t){var n=t.ownerDocument,r=t;do{typeof ShadowRoot<"u"&&r instanceof ShadowRoot&&(r=r.host);var o=ft(e,r);if(o){var a=pt(e,r),i=a[1],c=a[2];if(i>c)return!0}r=r.parentNode}while(r&&r!==n.body);return!1},Er=function(e){var t=e.scrollTop,n=e.scrollHeight,r=e.clientHeight;return[t,n,r]},wr=function(e){var t=e.scrollLeft,n=e.scrollWidth,r=e.clientWidth;return[t,n,r]},ft=function(e,t){return e==="v"?Cr(t):br(t)},pt=function(e,t){return e==="v"?Er(t):wr(t)},Sr=function(e,t){return e==="h"&&t==="rtl"?-1:1},Mr=function(e,t,n,r,o){var a=Sr(e,window.getComputedStyle(t).direction),i=a*r,c=n.target,d=t.contains(c),l=!1,f=i>0,p=0,y=0;do{if(!c)break;var k=pt(e,c),w=k[0],u=k[1],m=k[2],x=u-m-a*w;(w||x)&&ft(e,c)&&(p+=x,y+=w);var g=c.parentNode;c=g&&g.nodeType===Node.DOCUMENT_FRAGMENT_NODE?g.host:g}while(!d&&c!==document.body||d&&(t.contains(c)||t===c));return(f&&Math.abs(p)<1||!f&&Math.abs(y)<1)&&(l=!0),l},ee=function(e){return"changedTouches"in e?[e.changedTouches[0].clientX,e.changedTouches[0].clientY]:[0,0]},qe=function(e){return[e.deltaX,e.deltaY]},He=function(e){return e&&"current"in e?e.current:e},Ar=function(e,t){return e[0]===t[0]&&e[1]===t[1]},Rr=function(e){return`
  .block-interactivity-`.concat(e,` {pointer-events: none;}
  .allow-interactivity-`).concat(e,` {pointer-events: all;}
`)},Pr=0,z=[];function Nr(e){var t=s.useRef([]),n=s.useRef([0,0]),r=s.useRef(),o=s.useState(Pr++)[0],a=s.useState(ut)[0],i=s.useRef(e);s.useEffect(function(){i.current=e},[e]),s.useEffect(function(){if(e.inert){document.body.classList.add("block-interactivity-".concat(o));var u=Yn([e.lockRef.current],(e.shards||[]).map(He),!0).filter(Boolean);return u.forEach(function(m){return m.classList.add("allow-interactivity-".concat(o))}),function(){document.body.classList.remove("block-interactivity-".concat(o)),u.forEach(function(m){return m.classList.remove("allow-interactivity-".concat(o))})}}},[e.inert,e.lockRef.current,e.shards]);var c=s.useCallback(function(u,m){if("touches"in u&&u.touches.length===2||u.type==="wheel"&&u.ctrlKey)return!i.current.allowPinchZoom;var x=ee(u),g=n.current,C="deltaX"in u?u.deltaX:g[0]-x[0],b="deltaY"in u?u.deltaY:g[1]-x[1],S,A=u.target,E=Math.abs(C)>Math.abs(b)?"h":"v";if("touches"in u&&E==="h"&&A.type==="range")return!1;var P=Ve(E,A);if(!P)return!0;if(P?S=E:(S=E==="v"?"h":"v",P=Ve(E,A)),!P)return!1;if(!r.current&&"changedTouches"in u&&(C||b)&&(r.current=S),!S)return!0;var _=r.current||S;return Mr(_,m,u,_==="h"?C:b)},[]),d=s.useCallback(function(u){var m=u;if(!(!z.length||z[z.length-1]!==a)){var x="deltaY"in m?qe(m):ee(m),g=t.current.filter(function(S){return S.name===m.type&&(S.target===m.target||m.target===S.shadowParent)&&Ar(S.delta,x)})[0];if(g&&g.should){m.cancelable&&m.preventDefault();return}if(!g){var C=(i.current.shards||[]).map(He).filter(Boolean).filter(function(S){return S.contains(m.target)}),b=C.length>0?c(m,C[0]):!i.current.noIsolation;b&&m.cancelable&&m.preventDefault()}}},[]),l=s.useCallback(function(u,m,x,g){var C={name:u,delta:m,target:x,should:g,shadowParent:Ir(x)};t.current.push(C),setTimeout(function(){t.current=t.current.filter(function(b){return b!==C})},1)},[]),f=s.useCallback(function(u){n.current=ee(u),r.current=void 0},[]),p=s.useCallback(function(u){l(u.type,qe(u),u.target,c(u,e.lockRef.current))},[]),y=s.useCallback(function(u){l(u.type,ee(u),u.target,c(u,e.lockRef.current))},[]);s.useEffect(function(){return z.push(a),e.setCallbacks({onScrollCapture:p,onWheelCapture:p,onTouchMoveCapture:y}),document.addEventListener("wheel",d,$),document.addEventListener("touchmove",d,$),document.addEventListener("touchstart",f,$),function(){z=z.filter(function(u){return u!==a}),document.removeEventListener("wheel",d,$),document.removeEventListener("touchmove",d,$),document.removeEventListener("touchstart",f,$)}},[]);var k=e.removeScrollBar,w=e.inert;return s.createElement(s.Fragment,null,w?s.createElement(a,{styles:Rr(o)}):null,k?s.createElement(kr,{noRelative:e.noRelative,gapMode:e.gapMode}):null)}function Ir(e){for(var t=null;e!==null;)e instanceof ShadowRoot&&(t=e.host,e=e.host),e=e.parentNode;return t}const Or=cr(lt,Nr);var vt=s.forwardRef(function(e,t){return s.createElement(se,L({},e,{ref:t,sideCar:Or}))});vt.classNames=se.classNames;var ie="Collapsible",[Lr,ht]=K(ie),[Dr,we]=Lr(ie),yt=s.forwardRef((e,t)=>{const{__scopeCollapsible:n,open:r,defaultOpen:o,disabled:a,onOpenChange:i,...c}=e,[d,l]=ce({prop:r,defaultProp:o??!1,onChange:i,caller:ie});return v.jsx(Dr,{scope:n,disabled:a,contentId:H(),open:d,onOpenToggle:s.useCallback(()=>l(f=>!f),[l]),children:v.jsx(R.div,{"data-state":Me(d),"data-disabled":a?"":void 0,...c,ref:t})})});yt.displayName=ie;var mt="CollapsibleTrigger",gt=s.forwardRef((e,t)=>{const{__scopeCollapsible:n,...r}=e,o=we(mt,n);return v.jsx(R.button,{type:"button","aria-controls":o.contentId,"aria-expanded":o.open||!1,"data-state":Me(o.open),"data-disabled":o.disabled?"":void 0,disabled:o.disabled,...r,ref:t,onClick:D(e.onClick,o.onOpenToggle)})});gt.displayName=mt;var Se="CollapsibleContent",kt=s.forwardRef((e,t)=>{const{forceMount:n,...r}=e,o=we(Se,e.__scopeCollapsible);return v.jsx(Z,{present:n||o.open,children:({present:a})=>v.jsx(_r,{...r,ref:t,present:a})})});kt.displayName=Se;var _r=s.forwardRef((e,t)=>{const{__scopeCollapsible:n,present:r,children:o,...a}=e,i=we(Se,n),[c,d]=s.useState(r),l=s.useRef(null),f=N(t,l),p=s.useRef(0),y=p.current,k=s.useRef(0),w=k.current,u=i.open||c,m=s.useRef(u),x=s.useRef(void 0);return s.useEffect(()=>{const g=requestAnimationFrame(()=>m.current=!1);return()=>cancelAnimationFrame(g)},[]),T(()=>{const g=l.current;if(g){x.current=x.current||{transitionDuration:g.style.transitionDuration,animationName:g.style.animationName},g.style.transitionDuration="0s",g.style.animationName="none";const C=g.getBoundingClientRect();p.current=C.height,k.current=C.width,m.current||(g.style.transitionDuration=x.current.transitionDuration,g.style.animationName=x.current.animationName),d(r)}},[i.open,r]),v.jsx(R.div,{"data-state":Me(i.open),"data-disabled":i.disabled?"":void 0,id:i.contentId,hidden:!u,...a,ref:f,style:{"--radix-collapsible-content-height":y?`${y}px`:void 0,"--radix-collapsible-content-width":w?`${w}px`:void 0,...e.style},children:u&&o})});function Me(e){return e?"open":"closed"}var Tr=yt,jr=gt,Fr=kt,I="Accordion",Wr=["Home","End","ArrowDown","ArrowUp","ArrowLeft","ArrowRight"],[Ae,Ur,$r]=En(I),[le]=K(I,[$r,ht]),Re=ht(),zr=M.forwardRef((e,t)=>{const{type:n,...r}=e,o=r,a=r;return v.jsx(Ae.Provider,{scope:e.__scopeAccordion,children:n==="multiple"?v.jsx(Hr,{...a,ref:t}):v.jsx(qr,{...o,ref:t})})});zr.displayName=I;var[xt,Br]=le(I),[Ct,Vr]=le(I,{collapsible:!1}),qr=M.forwardRef((e,t)=>{const{value:n,defaultValue:r,onValueChange:o=()=>{},collapsible:a=!1,...i}=e,[c,d]=ce({prop:n,defaultProp:r??"",onChange:o,caller:I});return v.jsx(xt,{scope:e.__scopeAccordion,value:M.useMemo(()=>c?[c]:[],[c]),onItemOpen:d,onItemClose:M.useCallback(()=>a&&d(""),[a,d]),children:v.jsx(Ct,{scope:e.__scopeAccordion,collapsible:a,children:v.jsx(bt,{...i,ref:t})})})}),Hr=M.forwardRef((e,t)=>{const{value:n,defaultValue:r,onValueChange:o=()=>{},...a}=e,[i,c]=ce({prop:n,defaultProp:r??[],onChange:o,caller:I}),d=M.useCallback(f=>c((p=[])=>[...p,f]),[c]),l=M.useCallback(f=>c((p=[])=>p.filter(y=>y!==f)),[c]);return v.jsx(xt,{scope:e.__scopeAccordion,value:i,onItemOpen:d,onItemClose:l,children:v.jsx(Ct,{scope:e.__scopeAccordion,collapsible:!0,children:v.jsx(bt,{...a,ref:t})})})}),[Gr,ue]=le(I),bt=M.forwardRef((e,t)=>{const{__scopeAccordion:n,disabled:r,dir:o,orientation:a="vertical",...i}=e,c=M.useRef(null),d=N(c,t),l=Ur(n),p=Sn(o)==="ltr",y=D(e.onKeyDown,k=>{var P;if(!Wr.includes(k.key))return;const w=k.target,u=l().filter(_=>{var W;return!((W=_.ref.current)!=null&&W.disabled)}),m=u.findIndex(_=>_.ref.current===w),x=u.length;if(m===-1)return;k.preventDefault();let g=m;const C=0,b=x-1,S=()=>{g=m+1,g>b&&(g=C)},A=()=>{g=m-1,g<C&&(g=b)};switch(k.key){case"Home":g=C;break;case"End":g=b;break;case"ArrowRight":a==="horizontal"&&(p?S():A());break;case"ArrowDown":a==="vertical"&&S();break;case"ArrowLeft":a==="horizontal"&&(p?A():S());break;case"ArrowUp":a==="vertical"&&A();break}const E=g%x;(P=u[E].ref.current)==null||P.focus()});return v.jsx(Gr,{scope:n,disabled:r,direction:o,orientation:a,children:v.jsx(Ae.Slot,{scope:n,children:v.jsx(R.div,{...i,"data-orientation":a,ref:d,onKeyDown:r?void 0:y})})})}),re="AccordionItem",[Kr,Pe]=le(re),Et=M.forwardRef((e,t)=>{const{__scopeAccordion:n,value:r,...o}=e,a=ue(re,n),i=Br(re,n),c=Re(n),d=H(),l=r&&i.value.includes(r)||!1,f=a.disabled||e.disabled;return v.jsx(Kr,{scope:n,open:l,disabled:f,triggerId:d,children:v.jsx(Tr,{"data-orientation":a.orientation,"data-state":Pt(l),...c,...o,ref:t,disabled:f,open:l,onOpenChange:p=>{p?i.onItemOpen(r):i.onItemClose(r)}})})});Et.displayName=re;var wt="AccordionHeader",St=M.forwardRef((e,t)=>{const{__scopeAccordion:n,...r}=e,o=ue(I,n),a=Pe(wt,n);return v.jsx(R.h3,{"data-orientation":o.orientation,"data-state":Pt(a.open),"data-disabled":a.disabled?"":void 0,...r,ref:t})});St.displayName=wt;var be="AccordionTrigger",Mt=M.forwardRef((e,t)=>{const{__scopeAccordion:n,...r}=e,o=ue(I,n),a=Pe(be,n),i=Vr(be,n),c=Re(n);return v.jsx(Ae.ItemSlot,{scope:n,children:v.jsx(jr,{"aria-disabled":a.open&&!i.collapsible||void 0,"data-orientation":o.orientation,id:a.triggerId,...c,...r,ref:t})})});Mt.displayName=be;var At="AccordionContent",Rt=M.forwardRef((e,t)=>{const{__scopeAccordion:n,...r}=e,o=ue(I,n),a=Pe(At,n),i=Re(n);return v.jsx(Fr,{role:"region","aria-labelledby":a.triggerId,"data-orientation":o.orientation,...i,...r,ref:t,style:{"--radix-accordion-content-height":"var(--radix-collapsible-content-height)","--radix-accordion-content-width":"var(--radix-collapsible-content-width)",...e.style}})});Rt.displayName=At;function Pt(e){return e?"open":"closed"}var ja=Et,Fa=St,Wa=Mt,Ua=Rt,de="Dialog",[Nt,$a]=K(de),[Zr,O]=Nt(de),It=e=>{const{__scopeDialog:t,children:n,open:r,defaultOpen:o,onOpenChange:a,modal:i=!0}=e,c=s.useRef(null),d=s.useRef(null),[l,f]=ce({prop:r,defaultProp:o??!1,onChange:a,caller:de});return v.jsx(Zr,{scope:t,triggerRef:c,contentRef:d,contentId:H(),titleId:H(),descriptionId:H(),open:l,onOpenChange:f,onOpenToggle:s.useCallback(()=>f(p=>!p),[f]),modal:i,children:n})};It.displayName=de;var Ot="DialogTrigger",Lt=s.forwardRef((e,t)=>{const{__scopeDialog:n,...r}=e,o=O(Ot,n),a=N(t,o.triggerRef);return v.jsx(R.button,{type:"button","aria-haspopup":"dialog","aria-expanded":o.open,"aria-controls":o.contentId,"data-state":Oe(o.open),...r,ref:a,onClick:D(e.onClick,o.onOpenToggle)})});Lt.displayName=Ot;var Ne="DialogPortal",[Xr,Dt]=Nt(Ne,{forceMount:void 0}),_t=e=>{const{__scopeDialog:t,forceMount:n,children:r,container:o}=e,a=O(Ne,t);return v.jsx(Xr,{scope:t,forceMount:n,children:s.Children.map(r,i=>v.jsx(Z,{present:n||a.open,children:v.jsx(at,{asChild:!0,container:o,children:i})}))})};_t.displayName=Ne;var oe="DialogOverlay",Tt=s.forwardRef((e,t)=>{const n=Dt(oe,e.__scopeDialog),{forceMount:r=n.forceMount,...o}=e,a=O(oe,e.__scopeDialog);return a.modal?v.jsx(Z,{present:r||a.open,children:v.jsx(Qr,{...o,ref:t})}):null});Tt.displayName=oe;var Yr=G("DialogOverlay.RemoveScroll"),Qr=s.forwardRef((e,t)=>{const{__scopeDialog:n,...r}=e,o=O(oe,n);return v.jsx(vt,{as:Yr,allowPinchZoom:!0,shards:[o.contentRef],children:v.jsx(R.div,{"data-state":Oe(o.open),...r,ref:t,style:{pointerEvents:"auto",...r.style}})})}),F="DialogContent",jt=s.forwardRef((e,t)=>{const n=Dt(F,e.__scopeDialog),{forceMount:r=n.forceMount,...o}=e,a=O(F,e.__scopeDialog);return v.jsx(Z,{present:r||a.open,children:a.modal?v.jsx(Jr,{...o,ref:t}):v.jsx(eo,{...o,ref:t})})});jt.displayName=F;var Jr=s.forwardRef((e,t)=>{const n=O(F,e.__scopeDialog),r=s.useRef(null),o=N(t,n.contentRef,r);return s.useEffect(()=>{const a=r.current;if(a)return Xn(a)},[]),v.jsx(Ft,{...e,ref:o,trapFocus:n.open,disableOutsidePointerEvents:!0,onCloseAutoFocus:D(e.onCloseAutoFocus,a=>{var i;a.preventDefault(),(i=n.triggerRef.current)==null||i.focus()}),onPointerDownOutside:D(e.onPointerDownOutside,a=>{const i=a.detail.originalEvent,c=i.button===0&&i.ctrlKey===!0;(i.button===2||c)&&a.preventDefault()}),onFocusOutside:D(e.onFocusOutside,a=>a.preventDefault())})}),eo=s.forwardRef((e,t)=>{const n=O(F,e.__scopeDialog),r=s.useRef(!1),o=s.useRef(!1);return v.jsx(Ft,{...e,ref:t,trapFocus:!1,disableOutsidePointerEvents:!1,onCloseAutoFocus:a=>{var i,c;(i=e.onCloseAutoFocus)==null||i.call(e,a),a.defaultPrevented||(r.current||(c=n.triggerRef.current)==null||c.focus(),a.preventDefault()),r.current=!1,o.current=!1},onInteractOutside:a=>{var d,l;(d=e.onInteractOutside)==null||d.call(e,a),a.defaultPrevented||(r.current=!0,a.detail.originalEvent.type==="pointerdown"&&(o.current=!0));const i=a.target;((l=n.triggerRef.current)==null?void 0:l.contains(i))&&a.preventDefault(),a.detail.originalEvent.type==="focusin"&&o.current&&a.preventDefault()}})}),Ft=s.forwardRef((e,t)=>{const{__scopeDialog:n,trapFocus:r,onOpenAutoFocus:o,onCloseAutoFocus:a,...i}=e,c=O(F,n),d=s.useRef(null),l=N(t,d);return Ln(),v.jsxs(v.Fragment,{children:[v.jsx(rt,{asChild:!0,loop:!0,trapped:r,onMountAutoFocus:o,onUnmountAutoFocus:a,children:v.jsx(Ee,{role:"dialog",id:c.contentId,"aria-describedby":c.descriptionId,"aria-labelledby":c.titleId,"data-state":Oe(c.open),...i,ref:l,onDismiss:()=>c.onOpenChange(!1)})}),v.jsxs(v.Fragment,{children:[v.jsx(to,{titleId:c.titleId}),v.jsx(ro,{contentRef:d,descriptionId:c.descriptionId})]})]})}),Ie="DialogTitle",Wt=s.forwardRef((e,t)=>{const{__scopeDialog:n,...r}=e,o=O(Ie,n);return v.jsx(R.h2,{id:o.titleId,...r,ref:t})});Wt.displayName=Ie;var Ut="DialogDescription",$t=s.forwardRef((e,t)=>{const{__scopeDialog:n,...r}=e,o=O(Ut,n);return v.jsx(R.p,{id:o.descriptionId,...r,ref:t})});$t.displayName=Ut;var zt="DialogClose",Bt=s.forwardRef((e,t)=>{const{__scopeDialog:n,...r}=e,o=O(zt,n);return v.jsx(R.button,{type:"button",...r,ref:t,onClick:D(e.onClick,()=>o.onOpenChange(!1))})});Bt.displayName=zt;function Oe(e){return e?"open":"closed"}var Vt="DialogTitleWarning",[za,qt]=yn(Vt,{contentName:F,titleName:Ie,docsSlug:"dialog"}),to=({titleId:e})=>{const t=qt(Vt),n=`\`${t.contentName}\` requires a \`${t.titleName}\` for the component to be accessible for screen reader users.

If you want to hide the \`${t.titleName}\`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/${t.docsSlug}`;return s.useEffect(()=>{e&&(document.getElementById(e)||console.error(n))},[n,e]),null},no="DialogDescriptionWarning",ro=({contentRef:e,descriptionId:t})=>{const r=`Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {${qt(no).contentName}}.`;return s.useEffect(()=>{var a;const o=(a=e.current)==null?void 0:a.getAttribute("aria-describedby");t&&o&&(document.getElementById(t)||console.warn(r))},[r,e,t]),null},Ba=It,Va=Lt,qa=_t,Ha=Tt,Ga=jt,Ka=Wt,Za=$t,Xa=Bt,Ht={exports:{}},Gt={};/**
 * @license React
 * use-sync-external-store-shim.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var q=s;function oo(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var ao=typeof Object.is=="function"?Object.is:oo,co=q.useState,so=q.useEffect,io=q.useLayoutEffect,lo=q.useDebugValue;function uo(e,t){var n=t(),r=co({inst:{value:n,getSnapshot:t}}),o=r[0].inst,a=r[1];return io(function(){o.value=n,o.getSnapshot=t,ke(o)&&a({inst:o})},[e,n,t]),so(function(){return ke(o)&&a({inst:o}),e(function(){ke(o)&&a({inst:o})})},[e]),lo(n),n}function ke(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!ao(e,n)}catch{return!0}}function fo(e,t){return t()}var po=typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"?fo:uo;Gt.useSyncExternalStore=q.useSyncExternalStore!==void 0?q.useSyncExternalStore:po;Ht.exports=Gt;var vo=Ht.exports;function ho(){return vo.useSyncExternalStore(yo,()=>!0,()=>!1)}function yo(){return()=>{}}var Le="Avatar",[mo]=K(Le),[go,Kt]=mo(Le),Zt=s.forwardRef((e,t)=>{const{__scopeAvatar:n,...r}=e,[o,a]=s.useState("idle");return v.jsx(go,{scope:n,imageLoadingStatus:o,onImageLoadingStatusChange:a,children:v.jsx(R.span,{...r,ref:t})})});Zt.displayName=Le;var Xt="AvatarImage",Yt=s.forwardRef((e,t)=>{const{__scopeAvatar:n,src:r,onLoadingStatusChange:o=()=>{},...a}=e,i=Kt(Xt,n),c=ko(r,a),d=V(l=>{o(l),i.onImageLoadingStatusChange(l)});return T(()=>{c!=="idle"&&d(c)},[c,d]),c==="loaded"?v.jsx(R.img,{...a,ref:t,src:r}):null});Yt.displayName=Xt;var Qt="AvatarFallback",Jt=s.forwardRef((e,t)=>{const{__scopeAvatar:n,delayMs:r,...o}=e,a=Kt(Qt,n),[i,c]=s.useState(r===void 0);return s.useEffect(()=>{if(r!==void 0){const d=window.setTimeout(()=>c(!0),r);return()=>window.clearTimeout(d)}},[r]),i&&a.imageLoadingStatus!=="loaded"?v.jsx(R.span,{...o,ref:t}):null});Jt.displayName=Qt;function Ge(e,t){return e?t?(e.src!==t&&(e.src=t),e.complete&&e.naturalWidth>0?"loaded":"loading"):"error":"idle"}function ko(e,{referrerPolicy:t,crossOrigin:n}){const r=ho(),o=s.useRef(null),a=r?(o.current||(o.current=new window.Image),o.current):null,[i,c]=s.useState(()=>Ge(a,e));return T(()=>{c(Ge(a,e))},[a,e]),T(()=>{const d=p=>()=>{c(p)};if(!a)return;const l=d("loaded"),f=d("error");return a.addEventListener("load",l),a.addEventListener("error",f),t&&(a.referrerPolicy=t),typeof n=="string"&&(a.crossOrigin=n),()=>{a.removeEventListener("load",l),a.removeEventListener("error",f)}},[a,n,t]),i}var Ya=Zt,Qa=Yt,Ja=Jt;export{pa as $,So as A,Mo as B,Oo as C,Ee as D,Aa as E,rt as F,qo as G,Ho as H,Ta as I,_a as J,bo as K,Qo as L,sa as M,Ro as N,ba as O,R as P,_o as Q,vt as R,Co as S,Ea as T,Ra as U,wo as V,Sa as W,Oa as X,wa as Y,Xo as Z,Pa as _,N as a,oa as a0,Jo as a1,ha as a2,ka as a3,Yo as a4,Zo as a5,ra as a6,jo as a7,Wo as a8,Ao as a9,To as aA,Ma as aB,ma as aC,Ko as aD,Da as aE,La as aF,Bo as aG,ia as aH,zo as aI,ta as aJ,Uo as aK,Go as aL,xa as aM,vo as aN,aa as aO,fa as aP,Na as aQ,Ia as aR,la as aS,da as aa,va as ab,Io as ac,$o as ad,ja as ae,Fa as af,Wa as ag,No as ah,Ua as ai,$a as aj,Ha as ak,qa as al,za as am,Ga as an,Ka as ao,Za as ap,Xa as aq,Va as ar,Ya as as,Qa as at,Ja as au,Eo as av,Ba as aw,Fo as ax,Lo as ay,ua as az,V as b,K as c,En as d,H as e,D as f,Sn as g,ce as h,Ye as i,v as j,Z as k,at as l,Ln as m,G as n,Xn as o,bn as p,Po as q,Do as r,Ca as s,ca as t,T as u,ea as v,ga as w,ya as x,na as y,Vo as z};
