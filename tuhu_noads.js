/*
途虎养车 App 去广告净化脚本
目标：清理开屏、弹窗、Banner、营销推荐字段。
尽量不碰：登录、订单、支付、优惠券、门店、保养预约、车辆信息、车型车牌等核心字段。
*/

function lower(s) {
  return String(s || "").toLowerCase();
}

function isCoreBusinessKey(key) {
  const k = lower(key);
  return /(order|payment|pay|coupon|voucher|member|login|token|cart|checkout|delivery|address|store|shop|garage|reservation|reserve|appoint|appointment|maintain|maintenance|repair|install|installation|service|product|goods|sku|price|amount|invoice|car|vehicle|plate|license|model|vin|tire|tyre|battery|oil|user|account|profile|phone|mobile|idcard)/.test(k);
}

function isAdKey(key) {
  const k = lower(key);
  return /(advert|advertise|advertisement|adlist|ad_list|adinfo|ad_info|ads|^ad$|banner|banners|splash|launch|startup|openad|screenad|popup|popups|popbox|pop_layer|float|floating|marketing|promotion|promote|recommendad|materialad|material_ad|loadingpicture|loading_picture|feedad|feed_ad|campaign|activitybanner|homebanner|topbanner|guidead|guide_ad|interstitial|toastad|windowad|modalad|operationbanner|operation_ad)/.test(k);
}

function isAdString(value) {
  if (typeof value !== "string") return false;
  const v = lower(value);
  return /(splash|startup|openad|screenad|advert|advertise|advertisement|popup|popbox|banner|marketing|promotion|campaign|activitybanner|homebanner|topbanner|feedad|loadingpicture|interstitial|toastad|windowad|modalad|operationbanner)/.test(v);
}

function shouldDropObject(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;

  const keys = Object.keys(obj);
  const keyText = lower(keys.join("|"));

  // 核心业务对象不整块删，只做字段级清理
  if (/(order|payment|pay|coupon|voucher|member|cart|checkout|product|goods|sku|price|store|shop|garage|reservation|appoint|maintenance|repair|install|service|car|vehicle|plate|model|vin|tire|tyre|battery|oil)/.test(keyText)) {
    return false;
  }

  // 明显广告对象
  if (/(adid|ad_id|adtype|ad_type|advertid|advert_id|materialid|material_id|creativeid|creative_id|exposureurl|clickurl|click_url|monitorurl|trackurl|track_url|popupid|popboxid|campaignid|slotid|slot_id)/.test(keyText)) {
    return true;
  }

  // 弹窗、开屏、营销位对象
  if (/(splash|startup|openad|screenad|popup|popbox|pop|banner|float|marketing|promotion|advert|ad|campaign|activity|guide|modal|toast|operation)/.test(keyText)) {
    const text = lower(JSON.stringify(obj));
    if (/(image|img|pic|url|jump|link|show|close|countdown|button|expo|track|monitor|redirect|deeplink|click)/.test(text)) {
      return true;
    }
  }

  // 对象里的值出现明显广告词，但不能是核心业务字段
  for (const k of keys) {
    if (!isCoreBusinessKey(k) && isAdString(obj[k])) return true;
  }

  return false;
}

function emptyByType(value) {
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object") return {};
  return undefined;
}

function clean(obj, parentKey = "") {
  if (Array.isArray(obj)) {
    const arr = [];
    for (const item of obj) {
      if (shouldDropObject(item)) continue;
      const cleaned = clean(item, parentKey);
      if (cleaned !== undefined && cleaned !== null) arr.push(cleaned);
    }
    return arr;
  }

  if (obj && typeof obj === "object") {
    if (shouldDropObject(obj)) return null;

    for (const key of Object.keys(obj)) {
      // 核心业务字段：不删除字段名，只递归清理内部广告
      if (isCoreBusinessKey(key)) {
        obj[key] = clean(obj[key], key);
        continue;
      }

      if (isAdKey(key)) {
        const empty = emptyByType(obj[key]);
        if (empty !== undefined) obj[key] = empty;
        else delete obj[key];
        continue;
      }

      if (isAdString(obj[key])) {
        delete obj[key];
        continue;
      }

      const cleaned = clean(obj[key], key);
      if (cleaned === null) {
        if (Array.isArray(obj[key])) obj[key] = [];
        else if (obj[key] && typeof obj[key] === "object") obj[key] = {};
        else delete obj[key];
      } else {
        obj[key] = cleaned;
      }
    }

    // 关闭广告展示开关
    const snapshot = lower(JSON.stringify(obj));
    for (const k of Object.keys(obj)) {
      if (isCoreBusinessKey(k)) continue;

      const lk = lower(k);
      if (/(isshow|show|display|visible|enable|enabled|needshow|need_show|showflag|popupshow|adshow|isopen|openflag)/.test(lk)) {
        if (/(splash|startup|openad|screenad|popup|popbox|advert|ad|banner|marketing|promotion|campaign|activity|guide|modal|toast|operation)/.test(snapshot)) {
          obj[k] = false;
        }
      }

      if (/(countdown|duration|interval|showtime|show_time|delaytime|delay_time|waittime|wait_time)/.test(lk)) {
        if (/(splash|startup|openad|screenad|popup|popbox|advert|ad|banner)/.test(snapshot)) {
          obj[k] = 0;
        }
      }
    }

    return obj;
  }

  return obj;
}

let body = $response.body;

try {
  if (body && typeof body === "string") {
    let data = JSON.parse(body);
    data = clean(data);
    body = JSON.stringify(data);
  }
} catch (e) {
  // 非 JSON 不处理
}

$done({ body });
