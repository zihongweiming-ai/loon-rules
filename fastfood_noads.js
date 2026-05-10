/*
麦当劳 / 肯德基去广告净化脚本
用途：清理接口返回里的开屏、弹窗、banner、营销推荐、广告字段。
说明：尽量只处理广告字段，不主动改订单、支付、会员、优惠券核心字段。
*/

function isAdKey(key) {
  if (!key) return false;
  const k = String(key).toLowerCase();

  return /(advert|advertise|advertisement|adlist|ad_list|adinfo|ad_info|ads|^ad$|banner|banners|splash|launch|startup|popup|popups|popbox|pop_layer|float|floating|marketing|promotion|promote|recommendad|materialad|material_ad|loadingpicture|loading_picture|feedad|feed_ad|campaign|activitybanner|homebanner|topbanner|screenad|openad|startupad|guidead|guide_ad)/.test(k);
}

function isRiskBusinessKey(key) {
  if (!key) return false;
  const k = String(key).toLowerCase();

  // 不动这些业务字段，减少影响点餐、支付、会员、券
  return /(order|payment|pay|coupon|voucher|member|login|token|cart|checkout|delivery|address|store|menu|product|goods|sku|price|amount|invoice|pickup|takeout|takeaway)/.test(k);
}

function isAdString(value) {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();

  return /(splash|startup|openad|advert|advertise|advertisement|popup|popbox|banner|marketing|promotion|campaign|activitybanner|homebanner|feedad|loadingpicture)/.test(v);
}

function shouldDropObject(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;

  const keys = Object.keys(obj);
  const keyText = keys.join("|").toLowerCase();

  // 如果是订单、支付、券、菜单对象，不直接整块删除，只进入字段级清理
  if (/(order|payment|pay|coupon|voucher|member|cart|checkout|menu|product|goods|sku|price)/.test(keyText)) {
    return false;
  }

  // 明显广告对象
  if (/(adid|ad_id|adtype|ad_type|advertid|advert_id|materialid|material_id|creativeid|creative_id|exposureurl|clickurl|click_url|monitorurl|trackurl|track_url|popupid|popboxid|campaignid)/.test(keyText)) {
    return true;
  }

  // 弹窗、开屏、营销位对象
  if (/(splash|startup|popup|popbox|pop|banner|float|marketing|promotion|advert|ad|campaign|activity|guide)/.test(keyText)) {
    const text = JSON.stringify(obj).toLowerCase();
    if (/(image|img|pic|url|jump|link|show|close|countdown|button|expo|track|monitor|redirect|deeplink)/.test(text)) {
      return true;
    }
  }

  for (const k of keys) {
    if (isAdString(obj[k]) && !isRiskBusinessKey(k)) return true;
  }

  return false;
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
      // 不直接删除订单/支付/券等核心业务字段
      if (isRiskBusinessKey(key)) {
        obj[key] = clean(obj[key], key);
        continue;
      }

      if (isAdKey(key)) {
        if (Array.isArray(obj[key])) obj[key] = [];
        else if (obj[key] && typeof obj[key] === "object") obj[key] = {};
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
        else if (typeof obj[key] === "object") obj[key] = {};
        else delete obj[key];
      } else {
        obj[key] = cleaned;
      }
    }

    // 尝试关闭广告展示开关
    for (const k of Object.keys(obj)) {
      if (isRiskBusinessKey(k)) continue;

      const lk = k.toLowerCase();
      if (/(isshow|show|display|visible|enable|enabled|needshow|need_show|showflag|popupshow|adshow)/.test(lk)) {
        const text = JSON.stringify(obj).toLowerCase();
        if (/(splash|startup|popup|popbox|advert|ad|banner|marketing|promotion|campaign|activity|guide)/.test(text)) {
          obj[k] = false;
        }
      }

      if (/(countdown|duration|interval|showtime|show_time|delaytime|delay_time)/.test(lk)) {
        const text = JSON.stringify(obj).toLowerCase();
        if (/(splash|startup|popup|popbox|advert|ad|banner)/.test(text)) {
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
