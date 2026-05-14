/*
肯德基 / KFC 去广告平衡版
清理开屏、首页弹窗、浮层、Banner、营销推荐字段；
保留菜单、商品图、价格、优惠券、订单、支付、取餐码等核心数据。
*/

function lower(s){return String(s||"").toLowerCase();}

function isCoreBusinessKey(key){
  const k=lower(key);
  return /(order|payment|pay|coupon|voucher|member|login|token|cart|checkout|delivery|deliver|address|store|restaurant|menu|product|goods|sku|price|amount|invoice|pickup|takeout|takeaway|food|combo|meal|item|category|point|score|account|profile|phone|mobile|user|code|qrcode|pickupcode|takecode|trade|balance|wallet|image|img|pic|photo|cover|thumb|name|title|spec|stock|sale)/.test(k);
}

function isAdKey(key){
  const k=lower(key);
  return /(advert|advertise|advertisement|adlist|ad_list|adinfo|ad_info|ads|^ad$|adbanner|bannerad|recommendad|operationad|marketingad|splash|launch|startup|openad|screenad|loadingad|popup|popups|popbox|pop_layer|float|floating|poplayer|marketing|promotion|promote|materialad|material_ad|feedad|feed_ad|campaign|activitybanner|homebanner|topbanner|guidead|guide_ad|interstitial|toastad|windowad|modalad)/.test(k);
}

function isAdString(value){
  if(typeof value!=="string")return false;
  const v=lower(value);
  return /(splash|startup|openad|screenad|loadingad|advert|advertise|advertisement|popup|popbox|poplayer|bannerad|adbanner|marketingad|operationad|recommendad|campaignad|activitybanner|homebanner|feedad|interstitial|toastad|windowad|modalad)/.test(v);
}

function looksLikeMenuOrProduct(obj){
  if(!obj||typeof obj!=="object"||Array.isArray(obj))return false;
  const keys=Object.keys(obj).map(lower).join("|");
  return /(menu|product|goods|sku|price|food|combo|meal|item|category|restaurant|store|image|img|pic|photo|cover|thumb|name|title|spec|stock|sale)/.test(keys);
}

function shouldDropObject(obj){
  if(!obj||typeof obj!=="object"||Array.isArray(obj))return false;
  const keys=Object.keys(obj);
  const keyText=lower(keys.join("|"));
  const text=lower(JSON.stringify(obj));

  if(looksLikeMenuOrProduct(obj))return false;
  if(/(order|payment|pay|coupon|voucher|member|cart|checkout|menu|product|goods|sku|price|store|restaurant|address|delivery|pickup|code|qrcode|food|combo|meal|item)/.test(keyText))return false;

  if(/(adid|ad_id|adtype|ad_type|advertid|advert_id|materialid|material_id|creativeid|creative_id|exposureurl|clickurl|click_url|monitorurl|trackurl|track_url|popupid|popboxid|campaignid|slotid|slot_id)/.test(keyText))return true;

  if(/(splash|startup|openad|screenad|loadingad|popup|popbox|poplayer|float|floating|bannerad|adbanner|marketingad|operationad|recommendad|advert|campaign|activity|interstitial|modal|toast)/.test(keyText)){
    if(/(url|jump|link|show|close|countdown|button|expo|track|monitor|redirect|deeplink|click|duration)/.test(text))return true;
  }

  for(const k of keys){
    if(!isCoreBusinessKey(k)&&isAdString(obj[k]))return true;
  }
  return false;
}

function emptyByType(value){
  if(Array.isArray(value))return [];
  if(value&&typeof value==="object")return {};
  return undefined;
}

function clean(obj){
  if(Array.isArray(obj)){
    const arr=[];
    for(const item of obj){
      if(shouldDropObject(item))continue;
      const cleaned=clean(item);
      if(cleaned!==undefined&&cleaned!==null)arr.push(cleaned);
    }
    return arr;
  }

  if(obj&&typeof obj==="object"){
    if(shouldDropObject(obj))return null;

    for(const key of Object.keys(obj)){
      if(isCoreBusinessKey(key)){
        obj[key]=clean(obj[key]);
        continue;
      }

      if(isAdKey(key)){
        const empty=emptyByType(obj[key]);
        if(empty!==undefined)obj[key]=empty;
        else delete obj[key];
        continue;
      }

      if(isAdString(obj[key])){
        delete obj[key];
        continue;
      }

      const cleaned=clean(obj[key]);
      if(cleaned===null){
        if(Array.isArray(obj[key]))obj[key]=[];
        else if(obj[key]&&typeof obj[key]==="object")obj[key]={};
        else delete obj[key];
      }else{
        obj[key]=cleaned;
      }
    }

    const snapshot=lower(JSON.stringify(obj));
    for(const k of Object.keys(obj)){
      if(isCoreBusinessKey(k))continue;
      const lk=lower(k);
      if(/(isshow|show|display|visible|enable|enabled|needshow|need_show|showflag|popupshow|adshow|isopen|openflag)/.test(lk)){
        if(/(splash|startup|openad|screenad|loadingad|popup|popbox|poplayer|advert|bannerad|adbanner|marketingad|operationad|campaign|activity|interstitial|modal|toast)/.test(snapshot))obj[k]=false;
      }
      if(/(countdown|duration|interval|showtime|show_time|delaytime|delay_time|waittime|wait_time|remain|lefttime)/.test(lk)){
        if(/(splash|startup|openad|screenad|loadingad|popup|popbox|advert|bannerad|adbanner)/.test(snapshot))obj[k]=0;
      }
    }
    return obj;
  }
  return obj;
}

let body=$response.body;
try{
  if(body&&typeof body==="string"){
    let data=JSON.parse(body);
    data=clean(data);
    body=JSON.stringify(data);
  }
}catch(e){}
$done({body});
