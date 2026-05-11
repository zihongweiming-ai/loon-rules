/*
12306 开屏直进主界面净化脚本
目标：
1. 清理开屏广告、启动页、弹窗、Banner、引导页字段
2. 把 countdown / duration / showTime / delayTime 等倒计时改成 0
3. 尽量不碰登录、购票、订单、支付、乘车人等核心字段
*/

function lower(s) {
  return String(s || "").toLowerCase();
}

function isCoreBusinessKey(key) {
  const k = lower(key);
  return /(login|auth|token|user|passenger|ticket|train|station|order|pay|payment|refund|resign|queue|seat|contact|idcard|certificate|captcha|verify|sms|phone|mobile|bank|price|amount|queryleftticket|leftticket|confirm|submit)/.test(k);
}

function isSplashAdKey(key) {
  const k = lower(key);
  return /(splash|startup|launch|openad|screenad|advert|advertise|advertisement|adlist|ad_list|adinfo|ad_info|ads|^ad$|popup|popups|popbox|banner|guide|loading|welcome|float|floating|activitybanner|homebanner|feedad|materialad|operationad|operation_ad)/.test(k);
}

function isAdString(value) {
  if (typeof value !== "string") return false;
  const v = lower(value);
  return /(splash|startup|launch|openad|screenad|advert|advertise|advertisement|popup|popbox|banner|guide|loading|welcome|activitybanner|feedad|materialad)/.test(v);
}

function shouldDropObject(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;

  const keys = Object.keys(obj);
  const keyText = lower(keys.join("|"));

  // 核心业务对象不整块删除
  if (/(login|auth|token|user|passenger|ticket|train|station|order|pay|payment|refund|queue|seat|captcha|verify)/.test(keyText)) {
    return false;
  }

  // 明显广告对象
  if (/(adid|ad_id|adtype|ad_type|advertid|advert_id|materialid|material_id|creativeid|creative_id|exposureurl|clickurl|click_url|monitorurl|trackurl|track_url|popupid|popboxid|slotid|slot_id)/.test(keyText)) {
    return true;
  }

  // 开屏、弹窗、引导页对象
  if (/(splash|startup|launch|openad|screenad|popup|popbox|banner|guide|loading|welcome|advert|ad|float|operation)/.test(keyText)) {
    const text = lower(JSON.stringify(obj));
    if (/(image|img|pic|url|jump|link|show|close|countdown|button|track|monitor|redirect|deeplink|duration)/.test(text)) {
      return true;
    }
  }

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

function clean(obj) {
  if (Array.isArray(obj)) {
    const arr = [];
    for (const item of obj) {
      if (shouldDropObject(item)) continue;
      const cleaned = clean(item);
      if (cleaned !== undefined && cleaned !== null) arr.push(cleaned);
    }
    return arr;
  }

  if (obj && typeof obj === "object") {
    if (shouldDropObject(obj)) return null;

    for (const key of Object.keys(obj)) {
      if (isCoreBusinessKey(key)) {
        obj[key] = clean(obj[key]);
        continue;
      }

      if (isSplashAdKey(key)) {
        const empty = emptyByType(obj[key]);
        if (empty !== undefined) obj[key] = empty;
        else delete obj[key];
        continue;
      }

      if (isAdString(obj[key])) {
        delete obj[key];
        continue;
      }

      const cleaned = clean(obj[key]);
      if (cleaned === null) {
        if (Array.isArray(obj[key])) obj[key] = [];
        else if (obj[key] && typeof obj[key] === "object") obj[key] = {};
        else delete obj[key];
      } else {
        obj[key] = cleaned;
      }
    }

    // 把开屏/弹窗倒计时归零
    const snapshot = lower(JSON.stringify(obj));
    for (const k of Object.keys(obj)) {
      if (isCoreBusinessKey(k)) continue;

      const lk = lower(k);

      if (/(isshow|show|display|visible|enable|enabled|needshow|need_show|showflag|popupshow|adshow|isopen|openflag)/.test(lk)) {
        if (/(splash|startup|launch|openad|screenad|popup|popbox|advert|ad|banner|guide|loading|welcome)/.test(snapshot)) {
          obj[k] = false;
        }
      }

      if (/(countdown|count_down|duration|interval|showtime|show_time|delaytime|delay_time|waittime|wait_time|seconds|second|time)/.test(lk)) {
        if (/(splash|startup|launch|openad|screenad|popup|popbox|advert|ad|banner|guide|loading|welcome)/.test(snapshot)) {
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

    // 有些接口需要保持成功结构
    if (data && typeof data === "object") {
      if ("data" in data && data.data && typeof data.data === "object") {
        data.data = clean(data.data);
      }
      if ("result" in data && data.result && typeof data.result === "object") {
        data.result = clean(data.result);
      }
      if ("success" in data && typeof data.success === "boolean") {
        data.success = true;
      }
      if ("status" in data && (data.status === 0 || data.status === "0" || data.status === "success")) {
        data.status = data.status;
      }
    }

    body = JSON.stringify(data);
  }
} catch (e) {
  // 非 JSON 不处理
}

$done({ body });
