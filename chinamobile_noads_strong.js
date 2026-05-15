/*
中国移动 / 10086 App 去广告增强版
目标：开屏、弹窗、悬浮窗、运营位、首页 Banner、营销推荐。
尽量保护：登录、充值、账单、套餐、流量、手机号、验证码、实名认证等。
*/

function L(s){return String(s||"").toLowerCase();}

const CORE = /(login|auth|token|user|account|profile|phone|mobile|msisdn|idcard|realname|cert|verify|captcha|sms|password|security|safe|risk|bill|fee|balance|amount|price|payment|pay|wallet|bank|card|order|trade|transaction|recharge|charge|package|plan|flow|data|traffic|voice|rights|benefit|coupon|voucher|point|score|member|invoice|address|qrcode|code|barcode|scan|query|service|business|net|network|sim|esim|number|province|city|area|bind|unbind)/;
const ADKEY = /(advert|advertise|advertisement|adlist|ad_list|adinfo|ad_info|ads|^ad$|adbanner|bannerad|recommendad|operationad|marketingad|splash|launch|startup|openad|screenad|loadingad|popup|popups|popbox|pop_box|poplayer|pop_layer|float|floating|floatwindow|marketing|promotion|promote|materialad|material_ad|feedad|feed_ad|campaign|activitybanner|homebanner|topbanner|guidead|guide_ad|interstitial|toastad|windowad|modalad|poster|noticebar|activitybar|marketingbar)/;
const ADSTR = /(splash|startup|openad|screenad|loadingad|advert|advertise|advertisement|popup|popbox|poplayer|floatwindow|bannerad|adbanner|marketingad|operationad|recommendad|activitybanner|homebanner|feedad|interstitial|toastad|windowad|modalad|poster|noticebar|activitybar|marketingbar)/;

function isCore(k){return CORE.test(L(k));}
function isAdKey(k){return ADKEY.test(L(k));}
function isAdString(v){return typeof v==="string" && ADSTR.test(L(v));}

function looksCoreObject(o){
  if(!o || typeof o!=="object" || Array.isArray(o)) return false;
  const kt = L(Object.keys(o).join("|"));
  return /(login|auth|token|user|account|phone|mobile|bill|fee|balance|payment|pay|order|trade|recharge|package|plan|flow|traffic|rights|coupon|member|query|service|sim|number|province|city)/.test(kt);
}

function shouldDrop(o){
  if(!o || typeof o!=="object" || Array.isArray(o)) return false;

  const ks = Object.keys(o);
  const kt = L(ks.join("|"));
  const txt = L(JSON.stringify(o));

  if(looksCoreObject(o)) return false;

  // 明确广告对象
  if(/(adid|ad_id|adtype|ad_type|advertid|advert_id|materialid|material_id|creativeid|creative_id|exposureurl|clickurl|click_url|monitorurl|trackurl|track_url|popupid|popboxid|campaignid|slotid|slot_id|pageid|positionid)/.test(kt)) {
    return true;
  }

  // 开屏、弹窗、悬浮窗、运营广告对象
  if(/(splash|startup|openad|screenad|loadingad|popup|popbox|poplayer|float|floating|floatwindow|bannerad|adbanner|marketingad|operationad|recommendad|advert|campaign|activitybanner|homebanner|interstitial|modal|toast|poster|noticebar|activitybar|marketingbar)/.test(kt)) {
    if(/(url|jump|link|show|close|countdown|button|expo|track|monitor|redirect|deeplink|click|duration|image|img|pic|title|subtitle|content|desc)/.test(txt)) return true;
  }

  // value 明确广告字样
  for(const k of ks){
    if(!isCore(k) && isAdString(o[k])) return true;
  }

  return false;
}

function empty(v){
  if(Array.isArray(v)) return [];
  if(v && typeof v==="object") return {};
  return undefined;
}

function clean(o){
  if(Array.isArray(o)){
    const a=[];
    for(const item of o){
      if(shouldDrop(item)) continue;
      const c=clean(item);
      if(c!==undefined && c!==null) a.push(c);
    }
    return a;
  }

  if(o && typeof o==="object"){
    if(shouldDrop(o)) return null;

    for(const k of Object.keys(o)){
      if(isCore(k)){
        o[k]=clean(o[k]);
        continue;
      }

      if(isAdKey(k)){
        const e=empty(o[k]);
        if(e!==undefined) o[k]=e;
        else delete o[k];
        continue;
      }

      if(isAdString(o[k])){
        delete o[k];
        continue;
      }

      const c=clean(o[k]);
      if(c===null){
        if(Array.isArray(o[k])) o[k]=[];
        else if(o[k] && typeof o[k]==="object") o[k]={};
        else delete o[k];
      } else {
        o[k]=c;
      }
    }

    const snap=L(JSON.stringify(o));
    for(const k of Object.keys(o)){
      if(isCore(k)) continue;
      const lk=L(k);

      if(/(isshow|show|display|visible|enable|enabled|needshow|need_show|showflag|popupshow|adshow|isopen|openflag|canclose|closable)/.test(lk)){
        if(/(splash|startup|openad|screenad|loadingad|popup|popbox|poplayer|advert|bannerad|adbanner|marketingad|operationad|campaign|activitybanner|floatwindow|interstitial|modal|toast|poster)/.test(snap)) {
          o[k]=false;
        }
      }

      if(/(countdown|count_down|duration|interval|showtime|show_time|delaytime|delay_time|waittime|wait_time|remain|lefttime|seconds|second)/.test(lk)){
        if(/(splash|startup|openad|screenad|loadingad|popup|popbox|advert|bannerad|adbanner|floatwindow)/.test(snap)) {
          o[k]=0;
        }
      }
    }

    return o;
  }

  return o;
}

let body = $response.body;
try {
  if(body && typeof body === "string"){
    let data = JSON.parse(body);
    data = clean(data);
    body = JSON.stringify(data);
  }
} catch(e) {}

$done({body});
